# Requête / Réponse avec defer()

TelepathyMQ fournit un mécanisme de communication asynchrone permettant à un nœud de demander l'exécution d'une tâche à un autre nœud et d'en recevoir le résultat.

## La méthode defer() prend en charge trois types de communication
Des notifications intermédiaires de progression.
Un résultat final en cas de succès.
Un rejet lorsque l'opération échoue.

Ce mécanisme repose sur Asynk, la bibliothèque utilitaire asynchrone utilisée en interne par TelepathyMQ.

1. Vue d'ensemble

Le nœud demandeur démarre une opération à l'aide de :

```javascript
const operation = client.defer(identity, eventName, data);
```

Le nœud distant reçoit un événement dont le premier argument est un objet différé (deferred object) :

```javascript
server.on(eventName, (defer, data) => {
  // Traiter la requête
});
```

Le premier argument, defer, permet de contrôler l'opération.

Le second argument, data, contient les données envoyées par le nœud demandeur.

2. Cycle de vie d'une opération

Une opération différée suit généralement les étapes suivantes :

Le client appelle defer().
TelepathyMQ génère un identifiant unique pour la requête.
Le serveur reçoit l'événement correspondant.
Le serveur traite la requête.
Le serveur peut envoyer zéro ou plusieurs notifications de progression.
Le serveur termine l'opération à l'aide de resolve() ou reject().
Le client reçoit le résultat final ou le rejet.

Les notifications de progression ne terminent pas l'opération.

3. Nœud demandeur : defer()

**Signature**

```javascript
node.defer(identity, eventName, data)
```

**Paramètre**	**Type**	**Description**
identity	String	Identité du nœud distant
eventName	String	Nom de l'événement à déclencher
data	Any	Données envoyées au nœud distant. Le paramètre est facultatif.

**Valeur de retour**

La méthode retourne un objet Promise d'Asynk permettant de suivre l'exécution de l'opération distante.

Cet objet expose les méthodes suivantes :

progress(callback)
done(callback)
fail(callback)

**Exemple**

```javascript
const operation = client.defer('server', 'calculate', {
  a: 10,
  b: 20
});

operation.progress((data) => {
  console.log('Progression :', data);
});

operation.done((result) => {
  console.log('Résultat :', result);
});

operation.fail((error) => {
  console.error('Erreur :', error);
});
```

4. Nœud récepteur : traitement de la requête

Le nœud récepteur doit écouter l'événement correspondant.

Signature du gestionnaire

```javascript
node.on(eventName, (defer, data) => {
  // Traiter la requête
});
```

Deux arguments sont transmis :

**Argument**	**Description**
defer	Objet permettant de contrôler l'opération différée
data	Données envoyées par le nœud demandeur

L'objet defer expose trois méthodes principales.

**defer.notify(data)**

Envoie une notification intermédiaire au nœud demandeur.

```javascript
defer.notify({
  status: 'processing',
  message: 'Calculation started'
});
```

Cette méthode ne termine pas l'opération.

Plusieurs notifications peuvent être envoyées pendant le traitement de la requête.

**defer.resolve(data)**

Termine l'opération avec succès.

```javascript
defer.resolve({
  result: 30
});
```

Les données fournies sont transmises au callback done() du nœud demandeur.

**defer.reject(reason)**

Rejette l'opération.

```javascript
defer.reject(new Error('Calculation failed'));
```

La valeur fournie est transmise au callback fail() du nœud demandeur.

L'utilisation d'un objet Error est recommandée afin de fournir une raison d'échec explicite.

5. Exemple complet

L'exemple suivant utilise deux processus Node.js indépendants.

**Serveur**

```javascript
const TelepathyMQ = require('telepathymq');

const server = new TelepathyMQ('server');

server.on('calculate', (defer, data) => {
  const { a, b } = data;

  console.log('Demande de calcul reçue');

  defer.notify({
    status: 'started'
  });

  setTimeout(() => {
    if (typeof a !== 'number' || typeof b !== 'number') {
      defer.reject(new Error('Invalid parameters'));
      return;
    }

    const result = a + b;

    defer.resolve({ result });
  }, 2000);
});

server.listen(8060, () => {
  console.log('Serveur en écoute sur le port 8060');
});
```

**Client**

```javascript
const TelepathyMQ = require('telepathymq');

const client = new TelepathyMQ('client');

client.on('register', (identity) => {
  console.log(`Connecté à ${identity}`);

  const operation = client.defer('server', 'calculate', {
    a: 10,
    b: 20
  });

  operation.progress((data) => {
    console.log('Progression :', data);
  });

  operation.done((result) => {
    console.log('Résultat :', result);
  });

  operation.fail((error) => {
    console.error('Échec de l’opération :', error);
  });
});

client.register('server', 'tcp://127.0.0.1:8060');
```

6. Gestion des erreurs

Si le nœud de destination n'est pas enregistré, defer() rejette immédiatement l'opération avec une erreur indiquant que l'identité distante n'est pas enregistrée.

Il est donc recommandé de toujours prévoir un gestionnaire fail().

```javascript
const operation = client.defer('server', 'calculate', {
  a: 10,
  b: 20
});

operation.done((result) => {
  console.log(result);
});

operation.fail((error) => {
  console.error('Échec de la requête :', error);
});
```

Les erreurs liées au traitement de la requête doivent également être gérées par le nœud récepteur.

7. Exécutions concurrentes multiples

TelepathyMQ attribue un UUID à chaque opération différée.

Cela permet d'exécuter plusieurs requêtes simultanément sans mélanger leurs réponses.

```javascript
const first = client.defer('server', 'calculate', {
  a: 10,
  b: 20
});

const second = client.defer('server', 'calculate', {
  a: 50,
  b: 30
});

first.done((result) => {
  console.log('Premier résultat :', result);
});

second.done((result) => {
  console.log('Second résultat :', result);
});
```

Chaque opération possède son propre cycle de vie indépendant.

8. Délais d'attente et déconnexions

La méthode defer() ne fournit pas de mécanisme intégré de gestion des délais d'attente (timeouts) ou d'annulation.

La déconnexion d'un nœud distant n'entraîne pas automatiquement le rejet des opérations en attente dans l'implémentation actuelle.

Les applications qui nécessitent des délais de réponse garantis doivent mettre en place leur propre stratégie de gestion des délais d'attente et gérer explicitement les déconnexions.

9. Bonnes pratiques
- Toujours enregistrer les gestionnaires done() et fail().
- Utiliser notify() pour signaler les étapes significatives du traitement.
- Privilégier les objets structurés plutôt que les chaînes de caractères ambiguës.
- Utiliser des objets Error lors du rejet d'une opération.
- Mettre en place des délais d'attente au niveau applicatif lorsque cela est nécessaire.
- Éviter de laisser des opérations en attente indéfiniment.
- Ne pas confondre resolve() et done() : le premier termine l'opération sur le nœud distant, tandis que le second reçoit son résultat sur le nœud demandeur.

10. Récapitulatif de l'API

**Méthode**	**Rôle**	**Côté**
identity	Identité du nœud distant	—
node.defer()	Démarre une opération distante	Nœud demandeur
defer.notify()	Envoie une notification de progression	Nœud récepteur
defer.resolve()	Termine l'opération avec succès	Nœud récepteur
defer.reject()	Rejette l'opération	Nœud récepteur
promise.progress()	Reçoit les notifications	Nœud demandeur
promise.done()	Reçoit le résultat final	Nœud demandeur
promise.fail()	Reçoit le rejet	Nœud demandeur

Retour à la documentation anglaise · Documentation française

11. Pourquoi TelepathyMQ utilise Asynk

TelepathyMQ utilise Asynk pour gérer les opérations distantes asynchrones.

Bien que Node.js fournisse des Promises natives, TelepathyMQ nécessite une fonctionnalité supplémentaire : la possibilité d'envoyer des notifications intermédiaires pendant qu'une opération est toujours en cours d'exécution.

Une Promise JavaScript native fournit deux issues finales possibles :

- resolve() pour signaler une exécution réussie.
- reject() pour signaler un échec.

Cependant, les Promises natives ne disposent d'aucun mécanisme intégré permettant de transmettre des notifications intermédiaires de progression.

Asynk apporte cette fonctionnalité supplémentaire grâce à trois méthodes complémentaires :

- notify() envoie une notification intermédiaire sans terminer l'opération.
- resolve() termine l'opération avec succès.
- reject() termine l'opération en signalant une erreur.

Cela permet à TelepathyMQ de proposer un mécanisme de communication requête/réponse plus complet, particulièrement adapté aux opérations longues et aux traitements distribués.

**Exemple**

```javascript
const operation = client.defer('server', 'process', data);

operation.progress((notification) => {
  console.log('Progression :', notification);
});

operation.done((result) => {
  console.log('Terminé :', result);
});

operation.fail((error) => {
  console.error('Échec :', error);
});
```

Le mécanisme de notification constitue une fonctionnalité importante du modèle de communication asynchrone de TelepathyMQ et l'une des raisons pour lesquelles Asynk est conservé comme dépendance.

12. Points importants à prendre en compte

Opérations en attente lors de la déconnexion d'un nœud distant

Lorsqu'un nœud distant devient indisponible pendant l'exécution d'une opération defer(), le nœud demandeur peut conserver cette opération en attente indéfiniment.

Actuellement, TelepathyMQ ne rejette pas automatiquement les opérations différées en attente lorsque la connexion distante est perdue.

Par conséquent :

- Le callback done() peut ne jamais être appelé.
- Le callback fail() peut ne jamais être appelé.
- L'opération peut rester en attente jusqu'à ce que l'application intervienne.

**Recommandation**

Les applications doivent implémenter leurs propres mécanismes de gestion des délais d'attente et de surveillance des connexions lorsque les opérations doivent se terminer dans un délai déterminé.

Ce comportement constitue une limitation connue de l'implémentation actuelle et pourra être pris en charge dans une version future de TelepathyMQ.
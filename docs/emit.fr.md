# Envoyer un événement à un nœud distant avec emit()

TelepathyMQ fournit un mécanisme permettant à un nœud d'envoyer un événement à un autre nœud distant.

La méthode emit() permet à une application de transmettre un événement et les données associées à un nœud distant identifié par son identité.

Elle fournit un mécanisme simple de communication asynchrone entre les nœuds, sans nécessiter de réponse.

La méthode offre notamment les fonctionnalités suivantes :

- Envoyer des événements à des nœuds distants.
- Transmettre des données structurées.
- Identifier le nœud destinataire à l'aide de son identité.
- Distribuer les événements reçus aux gestionnaires d'événements enregistrés.
- Vérifier si une relation avec le nœud destinataire est disponible.

La méthode s'appuie sur les mécanismes internes de communication de TelepathyMQ pour transmettre les événements entre les nœuds.

1. Vue d'ensemble

Un nœud envoie un événement à un nœud distant à l'aide de :

```javascript
client.emit('server', 'message', {
  text: 'Hello from client'
});
```

Trois informations sont fournies :

- L'identité du nœud destinataire.
- Le nom de l'événement à déclencher.
- Les données associées à l'événement.

Du côté du destinataire, le nœud distant écoute l'événement correspondant :

```javascript
server.on('message', data => {
  console.log('Message received:', data);
});
```

Lorsque l'événement arrive, TelepathyMQ le distribue au gestionnaire d'événements correspondant.

Contrairement à defer(), la méthode emit() ne fournit aucun mécanisme permettant de recevoir un résultat ou des notifications de progression intermédiaires.

2. Signature de la méthode

**Signature**

```javascript
node.emit(identity, eventName, data)
```

**Paramètre**	**Type**	**Description**
identity	String	Identité du nœud distant destinataire de l'événement
eventName	String	Nom de l'événement à déclencher
data	Any	Données transmises au nœud distant

Le paramètre data peut contenir n'importe quelle valeur prise en charge par la couche de communication sous-jacente.

**Exemple**

```javascript
client.emit('server', 'message', {
  text: 'Hello from client',
  timestamp: Date.now()
});
```

Dans cet exemple :

- server identifie le nœud destinataire.
- message spécifie le nom de l'événement.
- L'objet contient les données transmises au nœud distant.

3. Valeur de retour

La méthode emit() retourne un booléen indiquant si une relation avec le nœud destinataire est actuellement disponible.

Deux valeurs sont possibles :

**Valeur de retour**	**Description**
true	Une relation avec le nœud destinataire existe et l'événement a été soumis à l'émetteur pour transmission
false	Le nœud destinataire n'est pas enregistré ou sa relation est indisponible

**Exemple**

```javascript
const sent = client.emit('server', 'message', {
  text: 'Hello from client'
});

if (sent) {
  console.log('Event submitted');
} else {
  console.log('Remote node is not registered');
}
```

**Important**

Une valeur de retour égale à true ne garantit pas que le nœud distant a reçu ou traité l'événement.

Elle indique uniquement que TelepathyMQ a trouvé une relation disponible et a soumis l'événement à son émetteur.

4. Vérification de la relation distante

Avant d'envoyer un événement, TelepathyMQ récupère la relation associée à l'identité du nœud destinataire.

```javascript
const emitter = this.relations[identity];
```

La relation est enregistrée dans l'objet interne relations lorsqu'un nœud distant est correctement enregistré.

Si aucune relation n'est disponible, la méthode retourne immédiatement false.

```javascript
if (!emitter) {
  return false;
}
```

Cela évite à TelepathyMQ de tenter d'envoyer un événement à travers une relation indisponible.

Par exemple :

```javascript
const result = client.emit('server', 'message', {
  text: 'Hello'
});

if (!result) {
  console.error('Unable to send event: server is not registered');
}
```

Les applications doivent vérifier la valeur de retour lorsque la disponibilité du nœud destinataire est importante.

5. Envoi de l'événement

Une fois la relation trouvée, TelepathyMQ construit un objet représentant l'événement :

```javascript
const event = {
  name: eventName,
  data
};
```

Cet objet contient :

- name : le nom de l'événement.
- data : les données associées à l'événement.

L'événement est ensuite transmis à travers l'émetteur distant :

```javascript
emitter.emit('event.emit', event);
```

Le nom d'événement interne event.emit permet à TelepathyMQ de distinguer les événements distants classiques des autres tâches de communication.

La méthode retourne finalement true.

6. Réception et distribution de l'événement

Du côté du destinataire, le socket écoute les messages entrants.

Lorsqu'un message associé à la tâche event.emit arrive, TelepathyMQ le traite à travers son gestionnaire interne eventHandler().

```javascript
const eventHandler = (self, task, event) => {
  switch (task) {
    case 'event.emit':
      EventEmitter.prototype.emit.call(
        self,
        event.name,
        event.data
      );
      break;
  }
};
```

L'événement reçu est distribué à l'aide de l'implémentation native de Node.js EventEmitter.

Cela signifie que les applications peuvent recevoir les événements distants à l'aide de la méthode standard .on().

**Exemple**

```javascript
server.on('message', data => {
  console.log('Message received:', data);
});
```

Le gestionnaire de réception reçoit les données transmises comme premier argument.

L'événement distant est ainsi intégré au système d'événements standard fourni par Node.js.

7. Utilisation de données structurées

La méthode emit() accepte un paramètre data de type quelconque.

Les applications peuvent transmettre des chaînes de caractères, des nombres, des tableaux ou des objets structurés, à condition que ces valeurs soient prises en charge par la couche de communication sous-jacente.

**Envoi d'un objet**

```javascript
client.emit('server', 'user.created', {
  id: 123,
  username: 'john',
  email: 'john@example.com'
});
```

**Réception de l'objet**

```javascript
server.on('user.created', user => {
  console.log('New user:', user.username);
  console.log('User ID:', user.id);
});
```

**Envoi d'un tableau**

```javascript
client.emit('server', 'items.updated', [
  'item-1',
  'item-2',
  'item-3'
]);
```

**Réception du tableau**

```javascript
server.on('items.updated', items => {
  console.log('Updated items:', items);
});
```

L'utilisation d'objets structurés est généralement recommandée, car elle facilite la compréhension et l'évolution des données transmises.

8. Différence entre emit() et defer()

TelepathyMQ propose deux mécanismes complémentaires pour la communication distante.

La méthode emit() est destinée à l'envoi d'événements sans attendre de réponse.

La méthode defer() est destinée aux opérations distantes nécessitant un résultat, des notifications de progression ou un rejet explicite.

**Fonctionnalité**	**emit()**	**defer()**
Envoie des données à un nœud distant	Oui	Oui
Déclenche un événement distant	Oui	Oui
Retourne un résultat	Non	Oui
Prend en charge les notifications de progression	Non	Oui
Prend en charge le rejet distant	Non	Oui
Retourne un booléen	Oui	Non
Prend en charge les opérations concurrentes	Sans objet	Oui

**Utilisation de emit()**

```javascript
client.emit('server', 'notification', {
  message: 'A new user has connected'
});
```

**Utilisation de defer()**

```javascript
const operation = client.defer('server', 'calculate', {
  a: 10,
  b: 20
});

operation.done(result => {
  console.log('Result:', result);
});

operation.fail(error => {
  console.error('Operation failed:', error);
});
```

En règle générale :

- Utiliser emit() pour les notifications, événements et messages ne nécessitant pas de réponse.
- Utiliser defer() pour les requêtes nécessitant un résultat ou un suivi de progression.

9. Exemple complet

L'exemple suivant illustre la communication entre deux instances TelepathyMQ indépendantes à l'aide de emit().

**Serveur**

```javascript
const TelepathyMQ = require('telepathymq');

const server = new TelepathyMQ('server');

server.on('register', identity => {
  console.log('Node connected:', identity);
});

server.on('unregister', identity => {
  console.log('Node disconnected:', identity);
});

server.on('message', data => {
  console.log('Message received:', data);

  console.log('Sender:', data.sender);
  console.log('Content:', data.message);
});

server.on('user.created', user => {
  console.log('New user created:', user);
});

server.listen(8060, () => {
  console.log('Server listening on port 8060');
});
```

**Client**

```javascript
const TelepathyMQ = require('telepathymq');

const client = new TelepathyMQ('client');

client.on('register', identity => {
  console.log('Connected to:', identity);

  const sent = client.emit('server', 'message', {
    sender: 'client',
    message: 'Hello from client'
  });

  if (!sent) {
    console.error('Unable to send message');
    return;
  }

  client.emit('server', 'user.created', {
    id: 123,
    username: 'john'
  });
});

client.on('unregister', identity => {
  console.log('Disconnected from:', identity);
});

client.register('server', 'tcp://127.0.0.1:8060');
```

Dans cet exemple :

- Le serveur démarre l'écoute sur le port 8060.
- Le client se connecte au serveur à l'aide de register().
- Le client reçoit l'événement register.
- Le client envoie un événement message à l'aide de emit().
- Le serveur reçoit et traite l'événement.
- Le client envoie un second événement nommé user.created.
- Le serveur reçoit ce nouvel événement et traite ses données.

10. Gestion des erreurs

La méthode emit() dispose d'un mécanisme simple de gestion des erreurs basé sur la disponibilité de la relation distante.

**Nœud destinataire non enregistré**

Si le nœud destinataire n'est pas enregistré, la méthode retourne false.

```javascript
const sent = client.emit('server', 'message', {
  text: 'Hello'
});

if (!sent) {
  console.error('Destination node is not registered');
}
```

Cette situation peut se produire lorsque :

- Le client ne s'est pas encore enregistré auprès du serveur distant.
- Le nœud distant s'est déconnecté.
- La relation correspondante a été définie à null.

**Déconnexion du nœud distant**

Lorsqu'un nœud distant se déconnecte, TelepathyMQ définit sa relation à null.

Les appels suivants à emit() ciblant ce nœud retourneront false.

Les applications doivent écouter l'événement unregister pour détecter cette situation.

**Absence de confirmation de livraison**

La méthode emit() ne fournit aucune confirmation de livraison.

Une fois l'émetteur interne appelé, la méthode retourne true sans attendre que le nœud distant reçoive ou traite l'événement.

Les applications nécessitant une confirmation de livraison ou une réponse doivent utiliser defer() ou implémenter un mécanisme d'accusé de réception au niveau applicatif.

11. Bonnes pratiques

- Utiliser des noms d'événements explicites qui décrivent clairement leur fonction.
- Préférer les objets structurés aux chaînes de caractères ambiguës.
- Vérifier la valeur de retour booléenne lorsque la disponibilité du nœud destinataire est importante.
- Écouter les événements register et unregister pour surveiller les connexions distantes.
- Utiliser emit() pour les notifications et les messages ne nécessitant pas de réponse.
- Utiliser defer() lorsqu'une opération distante nécessite un résultat ou des notifications de progression.
- Ne pas supposer qu'un appel réussi à emit() garantit la livraison de l'événement.
- Implémenter un mécanisme d'accusé de réception lorsque la fiabilité de la livraison des événements est nécessaire.
- Valider les données reçues avant de les traiter.
- Conserver une convention cohérente pour les noms d'événements entre les nœuds communicants.

12. Récapitulatif de l'API

**Méthode / Événement**	**Rôle**	**Côté**
node.emit()	Envoie un événement à un nœud distant	Nœud émetteur
event.emit	Tâche interne utilisée pour transmettre les événements classiques	Couche de communication interne
node.on()	Enregistre un gestionnaire d'événements	Nœud récepteur
register	Signale qu'un nœud distant s'est connecté	Nœud local
unregister	Signale qu'un nœud distant s'est déconnecté	Nœud local
node.defer()	Démarre une opération distante	Nœud demandeur
node.close()	Ferme les sockets ouverts	Nœud local

13. Points importants à prendre en compte

**Absence de confirmation de livraison**

La méthode emit() ne garantit pas que l'événement a été reçu ou traité par le nœud distant.

Une valeur de retour égale à true indique uniquement qu'une relation avec le nœud destinataire était disponible et que l'événement a été soumis à son émetteur.

Par conséquent :

- Le nœud distant peut ne pas avoir traité l'événement lorsque emit() retourne.
- L'émetteur ne reçoit aucune confirmation de livraison réussie.
- L'émetteur ne peut pas déterminer si le gestionnaire d'événements distant a terminé son traitement avec succès.

Les applications nécessitant des garanties de livraison doivent implémenter un mécanisme d'accusé de réception au niveau applicatif ou utiliser defer() lorsqu'une réponse est nécessaire.

**Absence de mécanisme automatique de nouvelle tentative**

L'implémentation actuelle ne prévoit pas explicitement de mécanisme applicatif de nouvelle tentative pour les événements classiques envoyés avec emit().

Si le nœud destinataire est indisponible, emit() retourne false.

Les applications nécessitant une transmission fiable des événements doivent implémenter leur propre stratégie de nouvelle tentative.

**Surveillance des connexions distantes**

La disponibilité d'un nœud distant dépend de la présence de sa relation dans this.relations.

Lorsqu'un nœud distant se déconnecte, cette relation est définie à null.

Les applications doivent écouter les événements register et unregister pour surveiller la disponibilité des connexions.

**Gestion des données**

Le paramètre data est transmis à travers la couche de communication interne.

Les applications doivent utiliser des structures de données prises en charge par le transport sous-jacent et éviter de dépendre de valeurs non prises en charge ou ambiguës.

**Recommandation générale**

La méthode emit() est particulièrement adaptée aux notifications et aux messages asynchrones ne nécessitant pas de réponse.

Pour les opérations nécessitant une confirmation, des notifications de progression intermédiaires ou un résultat final, defer() est le mécanisme recommandé.

Ces deux méthodes sont complémentaires et constituent la base du modèle de communication distante de TelepathyMQ.
# Écoute des connexions entrantes avec listen()

TelepathyMQ fournit un mécanisme permettant à un nœud de démarrer un serveur et d'accepter les connexions entrantes provenant d'autres nœuds.

La méthode listen() permet de mettre un nœud en écoute sur un port réseau afin que d'autres instances de TelepathyMQ puissent s'y connecter.

Elle constitue le point d'entrée du mécanisme de communication entre les nœuds et permet notamment :

- D'accepter les connexions entrantes.
- D'identifier les nœuds qui se connectent.
- De maintenir les relations avec les nœuds distants.
- De détecter les connexions et les déconnexions.
- De recevoir et de distribuer les événements distants.
- De prendre en charge les opérations différées (defer()).

La méthode repose sur le module interne socket de TelepathyMQ, qui assure la gestion des communications réseau.

1. Vue d'ensemble

Un nœud démarre l'écoute des connexions entrantes à l'aide de :

```
server.listen(8060, () => {
  console.log('Server listening on port 8060');
});
```

Lorsqu'un autre nœud se connecte, TelepathyMQ établit une relation avec ce nœud et émet un événement register.

Le nœud serveur peut alors communiquer avec le nœud distant à l'aide des méthodes emit() et defer().

La méthode listen() accepte également une adresse réseau et des options TLS.

2. Signature de la méthode

**Signature**

```
node.listen(port, host, fn)
```

**Paramètre**	**Type**	**Description**
port	Number / String	Port réseau ou chaîne de connexion utilisée pour démarrer l'écoute
host	Object / Function	Adresse ou configuration TLS selon le mode utilisé
fn	Function	Callback appelé lorsque l'opération de démarrage de l'écoute est terminée

Les paramètres host et fn dépendent du mode d'utilisation.

**Utilisation avec un port**

```
server.listen(8060, callback);
```

Dans cette configuration :

- port correspond au port réseau.
- host reçoit le callback.
- Le callback est transmis au mécanisme bind() du socket.

**Utilisation avec un port et une adresse**
javascript
server.listen(8060, '127.0.0.1', callback);


Dans cette configuration :

- port correspond au port réseau.
- host correspond à l'adresse d'écoute.
- fn est le callback de démarrage.

**Utilisation avec TLS**

Lorsque le premier argument est une chaîne commençant par tls et que le deuxième argument est un objet, TelepathyMQ active la configuration TLS.

```
server.listen('tls://0.0.0.0:8060', tlsOptions, callback);
```

Dans cette configuration :

- Le premier argument contient la chaîne de connexion TLS.
- Le deuxième argument contient les options TLS.
- Le troisième argument est le callback de démarrage.

Les options TLS sont transmises au socket interne à l'aide de sock.set('tls', host).

3. Valeur de retour

La méthode retourne l'objet socket créé pour gérer les connexions entrantes.

```
const socket = server.listen(8060, () => {
  console.log('Server listening');
});
```

Cet objet est également conservé dans le tableau interne this.socks.

Cela permet à TelepathyMQ de suivre les sockets créés et de les fermer ultérieurement à l'aide de close().

Chaque appel à listen() crée une nouvelle instance de socket.

Il est donc possible de démarrer plusieurs points d'écoute au sein d'une même instance de TelepathyMQ.

4. Gestion des connexions entrantes

Lorsqu'un nœud distant se connecte, le socket interne émet un événement register.

TelepathyMQ intercepte cet événement et enregistre la relation avec le nœud distant.

```
sock.on('register', (identity, emitter) => {
  this.relations[identity] = emitter;

  EventEmitter.prototype.emit.call(
    this,
    'register',
    identity,
    emitter
  );
});
```

Deux informations sont alors disponibles :

**Argument**	**Description**
identity	Identité du nœud distant
emitter	Objet permettant de communiquer avec le nœud distant

La relation est enregistrée dans this.relations, en utilisant l'identité distante comme clé.

TelepathyMQ émet ensuite un événement public register.

L'application peut écouter cet événement :

```
server.on('register', (identity, emitter) => {
  console.log('Node registered:', identity);
});
```

Cet événement permet à l'application de détecter l'arrivée d'un nouveau nœud.

5. Gestion des déconnexions

Lorsqu'un nœud distant se déconnecte, le socket interne émet un événement socket close.

TelepathyMQ intercepte cet événement :

```
sock.on('socket close', identity => {
  this.relations[identity] = null;

  EventEmitter.prototype.emit.call(
    this,
    'unregister',
    identity
  );
});
```

La relation correspondante est alors mise à null.

TelepathyMQ émet ensuite un événement public unregister.

L'application peut écouter cet événement :

```
server.on('unregister', identity => {
  console.log('Node unregistered:', identity);
});
```

Cet événement permet à l'application de détecter la déconnexion d'un nœud distant.

**Important**

La relation n'est pas supprimée du tableau relations : sa valeur est simplement remplacée par null.

6. Réception et distribution des événements

Lorsqu'un message arrive sur un socket, TelepathyMQ le transmet aux gestionnaires internes :

```
sock.on('message', (task, event, emitter) => {
  deferHandler(this, task, event, emitter);
  eventHandler(this, task, event);
});
```

Deux mécanismes sont utilisés :

- deferHandler() traite les messages associés aux opérations différées.
- eventHandler() traite les événements classiques.

Pour les événements classiques, TelepathyMQ utilise :

```
EventEmitter.prototype.emit.call(
  self,
  event.name,
  event.data
);
```

L'événement reçu est ainsi distribué aux gestionnaires enregistrés sur l'instance TelepathyMQ.

Par exemple :

```
server.on('message', data => {
  console.log('Message received:', data);
});
```

Un événement distant nommé message déclenchera ce gestionnaire.

Les événements classiques sont transmis avec un seul argument contenant les données de l'événement.

7. Utilisation avec les opérations différées

La méthode listen() prend également en charge la réception des opérations initiées avec defer().

Lorsqu'une requête différée arrive, TelepathyMQ crée un objet différé Asynk et transmet cet objet au gestionnaire correspondant.

Exemple côté serveur :

```
server.on('calculate', (defer, data) => {
  const { a, b } = data;

  console.log('Calculation requested');

  const result = a + b;

  defer.resolve({ result });
});
```

Le gestionnaire reçoit deux arguments :

**Argument**	**Description**
defer	Objet Asynk permettant de notifier, résoudre ou rejeter l'opération
data	Données transmises par le nœud demandeur

Le nœud serveur peut alors utiliser :

- defer.notify() pour envoyer une notification intermédiaire.
- defer.resolve() pour terminer l'opération avec succès.
- defer.reject() pour signaler un échec.

Pour plus de détails, consulter la documentation de defer().

8. Exemple complet

L'exemple suivant montre comment démarrer un serveur TelepathyMQ, accepter les connexions entrantes et traiter des événements provenant d'un client.

Serveur

```
const TelepathyMQ = require('telepathymq');

const server = new TelepathyMQ('server');

server.on('register', identity => {
  console.log('Connected to:', identity);
});

server.on('unregister', identity => {
  console.log('Disconnected from:', identity);
});

server.on('message', data => {
  console.log('Message received:', data);
});

server.on('calculate', (defer, data) => {
  const { a, b } = data;

  defer.notify({
    status: 'processing'
  });

  const result = a + b;

  defer.resolve({ result });
});

server.listen(8060, () => {
  console.log('Server listening on port 8060');
});
```

Client

```
const TelepathyMQ = require('telepathymq');

const client = new TelepathyMQ('client');

client.on('register', identity => {
  console.log('Connected to:', identity);

  client.emit('server', 'message', {
    text: 'Hello from client'
  });

  const operation = client.defer('server', 'calculate', {
    a: 10,
    b: 20
  });

  operation.progress(data => {
    console.log('Progress:', data);
  });

  operation.done(result => {
    console.log('Result:', result);
  });

  operation.fail(error => {
    console.error('Operation failed:', error);
  });
});

client.register('server', 'tcp://127.0.0.1:8060');
```
Dans cet exemple :

- Le serveur démarre l'écoute sur le port 8060.
- Le client se connecte au serveur.
- Le serveur reçoit l'événement register.
- Le client envoie un événement classique message.
- Le serveur reçoit et traite cet événement.
- Le client démarre une opération différée avec defer().
- Le serveur traite la requête et retourne le résultat.

9. Utilisation avec plusieurs points d'écoute
Chaque appel à listen() crée un nouveau socket et l'ajoute au tableau interne socks.

Il est donc possible de démarrer plusieurs points d'écoute avec une seule instance TelepathyMQ.


```
const TelepathyMQ = require('telepathymq');

const server = new TelepathyMQ('server');

server.listen(8060, () => {
  console.log('Listener 1 started on port 8060');
});

server.listen(8061, () => {
  console.log('Listener 2 started on port 8061');
});
```

Les différents sockets sont conservés par TelepathyMQ et pourront être fermés ensemble à l'aide de close().

10. Fermeture des connexions
La méthode listen() ne fournit pas directement de méthode de fermeture.

Pour fermer les sockets créés par TelepathyMQ, il faut utiliser la méthode close().

```
server.close(error => {
  if (error) {
    console.error('Error closing sockets:', error);
    return;
  }

  console.log('All sockets closed');
});
```

La méthode close() :

- Parcourt les sockets enregistrés dans this.socks.
- Demande la fermeture de chaque socket.
- Attend la fin de toutes les opérations de fermeture.
- Appelle le callback avec la première erreur rencontrée, le cas échéant.

La fermeture utilise Promise.allSettled(), ce qui permet d'attendre la fin de toutes les tentatives de fermeture, même lorsqu'une ou plusieurs échouent.

11. Bonnes pratiques

- Démarrer le serveur avant de permettre aux clients de s'y connecter.
- Toujours fournir un callback lorsque l'application doit détecter la fin du démarrage de l'écoute.
- Écouter les événements register et unregister pour suivre l'état des connexions.
- Vérifier l'identité des nœuds distants avant de leur confier des opérations sensibles.
- Utiliser TLS lorsque les communications nécessitent une connexion sécurisée.
- Utiliser defer() pour les opérations distantes nécessitant un résultat ou des notifications de progression.
- Utiliser emit() pour les événements classiques ne nécessitant pas de réponse.
- Utiliser close() pour fermer proprement les sockets lorsque le serveur doit s'arrêter.
- Éviter de multiplier inutilement les points d'écoute.

12. Récapitulatif de l'API

**Méthode / Événement**	**Rôle**	**Côté**
node.listen()	Démarre l'écoute des connexions entrantes	Nœud serveur
register	Signale l'arrivée d'un nœud distant	Nœud serveur
unregister	Signale la déconnexion d'un nœud distant	Nœud serveur
message	Reçoit un message provenant d'un nœud distant	Nœud serveur
defer.notify()	Envoie une notification intermédiaire	Nœud récepteur
defer.resolve()	Termine une opération avec succès	Nœud récepteur
defer.reject()	Rejette une opération	Nœud récepteur
node.close()	Ferme les sockets ouverts	Nœud serveur
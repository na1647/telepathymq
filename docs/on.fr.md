# Écouter les événements locaux et les messages entrants avec on()

TelepathyMQ utilise le système d'événements natif de Node.js pour permettre aux applications d'écouter et de traiter les événements.

La méthode on() est héritée de la classe EventEmitter de Node.js, dont Telepathymq est une extension.

Elle permet d'enregistrer des gestionnaires d'événements qui seront exécutés lorsqu'un événement correspondant est émis sur l'instance.

Dans TelepathyMQ, ce mécanisme est notamment utilisé pour :

- Écouter les événements système de TelepathyMQ.
- Recevoir les événements transmis par des nœuds distants.
- Traiter les messages entrants.
- Réagir aux connexions et déconnexions des nœuds.
- Organiser la communication événementielle entre les différentes parties d'une application.

La méthode on() constitue ainsi l'un des éléments fondamentaux du système de communication événementielle de TelepathyMQ.

1. Vue d'ensemble

La méthode on() permet d'enregistrer un gestionnaire associé à un nom d'événement.

**Exemple**

```javascript
node.on('message', data => {
  console.log('Message received:', data);
});
```

Dans cet exemple :

message correspond au nom de l'événement écouté.
La fonction représente le gestionnaire appelé lorsque l'événement est émis.
data contient les données transmises avec l'événement.

Lorsqu'un événement correspondant est émis, le gestionnaire est automatiquement exécuté.

Dans TelepathyMQ, les événements peuvent notamment provenir :

- Du fonctionnement interne de l'instance TelepathyMQ.
- D'un autre nœud connecté.
- De mécanismes internes de communication.

La méthode on() repose sur le système EventEmitter natif de Node.js.

2. Signature de la méthode

**Signature**

```javascript
node.on(eventName, listener)
```

**Paramètre**	**Type**	**Description**
eventName	String	Nom de l'événement à écouter
listener	Function	Fonction appelée lorsque l'événement est émis

La méthode retourne l'instance EventEmitter, ce qui permet de chaîner plusieurs appels.

**Exemple**

```javascript
node
  .on('message', data => {
    console.log('Message:', data);
  })
  .on('notification', data => {
    console.log('Notification:', data);
  });
```

3. Écouter les événements locaux

La méthode on() permet d'écouter les événements émis directement sur l'instance TelepathyMQ.

Ces événements peuvent être utilisés pour organiser les différents composants d'une application.

**Exemple**

```javascript
node.on('task.completed', data => {
  console.log('Task completed:', data);
});
```

Lorsqu'un événement task.completed est émis sur l'instance, le gestionnaire correspondant est exécuté.

**Important**

TelepathyMQ redéfinit la méthode publique emit() pour envoyer des événements à des nœuds distants.

Par conséquent, l'appel suivant ne représente pas une émission locale classique :

```javascript
node.emit('task.completed', data);
```

La méthode interprète le premier argument comme une identité distante.

Pour déclencher explicitement un événement local avec le mécanisme natif de Node.js, il est possible d'utiliser :

```javascript
const EventEmitter = require('node:events');

EventEmitter.prototype.emit.call(
  node,
  'task.completed',
  data
);
```

Cette distinction est importante pour éviter toute confusion entre la communication locale et la communication distante.

4. Recevoir les événements provenant d'un nœud distant

La méthode on() est également utilisée pour recevoir les événements transmis par les autres nœuds TelepathyMQ.

Lorsqu'un nœud distant utilise emit(), l'événement est transmis au destinataire puis distribué localement à travers son système EventEmitter.

**Côté serveur**

```javascript
const TelepathyMQ = require('telepathymq');

const server = new TelepathyMQ('server');

server.on('message', data => {
  console.log('Message received:', data);
});

server.listen(8060);
```

**Côté client**

```javascript
const TelepathyMQ = require('telepathymq');

const client = new TelepathyMQ('client');

client.on('register', identity => {
  console.log('Connected to:', identity);

  client.emit('server', 'message', {
    text: 'Hello from client'
  });
});

client.register('server', 'tcp://127.0.0.1:8060');
```

Dans cet exemple :

- Le serveur démarre l'écoute sur le port 8060.
- Le client établit une connexion avec le serveur.
- Le client envoie un événement message.
- Le serveur reçoit l'événement.
- Le gestionnaire enregistré avec on() est exécuté.

Du côté du serveur, l'événement distant est distribué comme un événement local classique par le mécanisme interne de TelepathyMQ.

5. Réception des données

Lorsqu'un événement est émis, les données associées sont transmises aux gestionnaires enregistrés.

Le premier argument du gestionnaire correspond aux données reçues.

**Exemple avec un objet**

```javascript
server.on('user.created', user => {
  console.log('New user:', user.username);
  console.log('User ID:', user.id);
});
```

Le nœud distant peut envoyer les données suivantes :

```javascript
client.emit('server', 'user.created', {
  id: 123,
  username: 'john',
  email: 'john@example.com'
});
```

Le gestionnaire reçoit directement l'objet transmis.

**Exemple avec plusieurs arguments**

Dans le cas de la réception d'événements TelepathyMQ, les données transmises par node.emit() sont regroupées dans un seul objet ou une seule valeur, passée comme premier argument au gestionnaire.

Il ne faut donc pas confondre ce fonctionnement avec une émission native EventEmitter comportant plusieurs arguments.

6. Écouter les événements système de TelepathyMQ

TelepathyMQ émet plusieurs événements internes destinés à informer les applications de l'évolution de ses connexions.

Les principaux événements publics sont register et unregister.

**Événement register**

L'événement register est émis lorsqu'un nœud distant est enregistré.

```javascript
node.on('register', (identity, emitter) => {
  console.log('Node registered:', identity);
});
```

Selon le contexte, les arguments peuvent varier :

Du côté du nœud serveur utilisant listen(), l'événement transmet l'identité distante et l'objet emitter.
Du côté du nœud client utilisant register(), l'événement transmet uniquement l'identité distante.

Il est donc préférable de ne pas supposer que le deuxième argument est systématiquement disponible.

**Événement unregister**

L'événement unregister est émis lorsqu'une connexion distante est fermée.

```javascript
node.on('unregister', identity => {
  console.log('Node disconnected:', identity);
});
```

Il permet notamment de surveiller les déconnexions et de mettre à jour l'état de l'application.

**Exemple combiné**

```javascript
node.on('register', identity => {
  console.log('Connected to:', identity);
});

node.on('unregister', identity => {
  console.log('Disconnected from:', identity);
});
```

Ces événements permettent de suivre les changements d'état des relations avec les autres nœuds.

7. Écouter plusieurs événements

Une même instance TelepathyMQ peut écouter plusieurs événements simultanément.

Chaque événement peut disposer de son propre gestionnaire.

**Exemple**

```javascript
node.on('message', data => {
  console.log('Message received:', data);
});

node.on('notification', data => {
  console.log('Notification received:', data);
});

node.on('user.created', user => {
  console.log('New user:', user);
});

node.on('user.deleted', user => {
  console.log('Deleted user:', user);
});
```

Chaque gestionnaire est exécuté uniquement lorsque l'événement correspondant est émis.

Il est également possible d'enregistrer plusieurs gestionnaires pour un même événement.

```javascript
node.on('message', data => {
  console.log('Handler 1:', data);
});

node.on('message', data => {
  console.log('Handler 2:', data);
});
```

Dans ce cas, les deux gestionnaires sont exécutés lors de l'émission de l'événement, dans leur ordre d'enregistrement.

8. Utilisation des autres méthodes EventEmitter

Puisque TelepathyMQ hérite de EventEmitter, les applications peuvent également utiliser les autres méthodes natives de gestion des événements.

Parmi les principales méthodes disponibles :

**Méthode**           **Description**
on()	              Enregistre un gestionnaire d'événements
addListener()	      Alias de on()
once()	              Enregistre un gestionnaire exécuté une seule fois
off()	              Supprime un gestionnaire d'événements
removeListener()	  Supprime un gestionnaire spécifique
removeAllListeners()  Supprime les gestionnaires associés à un événement ou tous les gestionnaires
listeners()	          Retourne les gestionnaires enregistrés pour un événement
listenerCount()       Retourne le nombre de gestionnaires enregistrés

**Utilisation de once()**

La méthode once() permet d'enregistrer un gestionnaire qui sera automatiquement supprimé après sa première exécution.

```javascript
node.once('ready', () => {
  console.log('Node is ready');
});
```

Cet événement ne déclenchera ce gestionnaire qu'une seule fois.

**Suppression d'un gestionnaire**

La méthode off() permet de supprimer un gestionnaire précédemment enregistré.

```javascript
const handler = data => {
  console.log('Message:', data);
};

node.on('message', handler);

// Later
node.off('message', handler);
```

Ces fonctionnalités permettent de contrôler précisément le cycle de vie des gestionnaires d'événements.

9. Exemple complet

L'exemple suivant montre comment utiliser on() pour écouter les événements système et recevoir les messages provenant d'un nœud distant.

**Serveur**

```javascript
const TelepathyMQ = require('telepathymq');

const server = new TelepathyMQ('server');

// Remote node registration
server.on('register', (identity, emitter) => {
  console.log('Node connected:', identity);
});

// Remote node disconnection
server.on('unregister', identity => {
  console.log('Node disconnected:', identity);
});

// Incoming messages
server.on('message', data => {
  console.log('Message received:', data);
});

// Incoming notifications
server.on('notification', data => {
  console.log('Notification received:', data);
});

// Incoming user events
server.on('user.created', user => {
  console.log('New user:', user);
});

server.listen(8060, () => {
  console.log('Server listening on port 8060');
});
```

**Client**

```javascript
const TelepathyMQ = require('telepathymq');

const client = new TelepathyMQ('client');

// Registration confirmation
client.on('register', identity => {
  console.log('Connected to:', identity);

  // Send a message
  client.emit('server', 'message', {
    text: 'Hello from client'
  });

  // Send a notification
  client.emit('server', 'notification', {
    type: 'info',
    message: 'Client is ready'
  });

  // Send a user event
  client.emit('server', 'user.created', {
    id: 123,
    username: 'john'
  });
});

// Disconnection monitoring
client.on('unregister', identity => {
  console.log('Disconnected from:', identity);
});

// Establish connection
client.register('server', 'tcp://127.0.0.1:8060');
```

Dans cet exemple :

- Le serveur démarre l'écoute sur le port 8060.
- Le serveur enregistre plusieurs gestionnaires d'événements avec on().
- Le client établit une connexion avec le serveur.
- Le client reçoit l'événement register.
- Le client transmet plusieurs événements au serveur avec emit().
- Le serveur reçoit chaque événement et exécute le gestionnaire correspondant.
- Les événements register et unregister permettent de suivre l'état de la connexion.

10. Gestion des erreurs

La méthode on() hérite du comportement de EventEmitter de Node.js.

Elle ne fournit pas de mécanisme spécifique de gestion des erreurs liées à la communication distante.

**Gestionnaire non enregistré**

Si aucun gestionnaire n'est enregistré pour un événement donné, celui-ci ne déclenche aucun traitement applicatif.

L'événement peut néanmoins être distribué normalement par le système interne de TelepathyMQ.

**Exceptions dans les gestionnaires**

Les gestionnaires d'événements sont exécutés de manière synchrone par EventEmitter.

Si un gestionnaire déclenche une exception, celle-ci peut interrompre le traitement en cours et remonter dans la pile d'appels.

Il est donc recommandé de protéger les traitements susceptibles de provoquer des erreurs.

```javascript
node.on('message', data => {
  try {
    processMessage(data);
  } catch (error) {
    console.error('Message processing failed:', error);
  }
});
```

**Événement error**

Comme TelepathyMQ hérite de EventEmitter, il conserve également le comportement particulier de l'événement error de Node.js.

Lorsqu'un événement error est émis sans gestionnaire correspondant, Node.js déclenche une exception.

Il est donc recommandé d'enregistrer un gestionnaire lorsque l'application utilise cet événement.

```javascript
node.on('error', error => {
  console.error('TelepathyMQ error:', error);
});
```

**Important**

L'enregistrement d'un gestionnaire error ne signifie pas que toutes les erreurs de connexion ou de communication seront automatiquement transmises à cet événement.

Seules les erreurs explicitement émises sur l'instance seront traitées par ce gestionnaire.

11. Bonnes pratiques

- Utiliser des noms d'événements explicites et cohérents.
- Préférer des objets structurés pour transmettre les données.
- Enregistrer les gestionnaires avant de démarrer les communications.
- Écouter les événements register et unregister pour surveiller les connexions.
- Utiliser once() lorsque le traitement d'un événement ne doit avoir lieu qu'une seule fois.
- Supprimer les gestionnaires devenus inutiles avec off().
- Éviter d'enregistrer plusieurs fois le même gestionnaire involontairement.
- Protéger les traitements susceptibles de déclencher des exceptions.
- Enregistrer un gestionnaire error lorsque l'application utilise cet événement.
- Distinguer les événements système des événements applicatifs afin d'éviter les collisions de noms.
- Ne pas confondre on() avec la réception d'un accusé de réception réseau : l'écoute d'un événement ne garantit pas sa livraison.

12. Récapitulatif de l'API

**Méthode / Événement**	**Rôle**	**Côté**
node.on()	Enregistre un gestionnaire d'événements	Nœud local
node.once()	Enregistre un gestionnaire exécuté une seule fois	Nœud local
node.off()	Supprime un gestionnaire d'événements	Nœud local
node.emit()	Envoie un événement à un nœud distant	Nœud émetteur
register	Signale l'enregistrement d'un nœud distant	Nœud local
unregister	Signale la fermeture d'une connexion distante	Nœud local
error	Signale une erreur explicitement émise sur l'instance	Nœud local
message	Exemple d'événement applicatif reçu	Nœud récepteur
EventEmitter.prototype.emit()	Déclenche un événement local avec le mécanisme natif	Nœud local

13. Points importants à prendre en compte

**Héritage de EventEmitter**

La méthode on() n'est pas une implémentation spécifique à TelepathyMQ.

Elle est directement héritée de EventEmitter de Node.js.

Elle conserve donc les caractéristiques du système natif, notamment l'exécution synchrone des gestionnaires, l'ordre d'enregistrement et la possibilité d'enregistrer plusieurs gestionnaires pour un même événement.

**Redéfinition de emit()**

TelepathyMQ redéfinit la méthode publique emit() afin de permettre l'envoi d'événements à des nœuds distants.

Cette redéfinition modifie la signature et le comportement habituels de EventEmitter.emit().

Par conséquent :

- node.emit(identity, eventName, data) est utilisé pour envoyer un événement distant.
- node.on(eventName, listener) reste utilisé pour écouter les événements.
- Pour déclencher explicitement un événement local avec le mécanisme natif, il faut utiliser EventEmitter.prototype.emit.call().

Cette distinction est essentielle pour comprendre le fonctionnement du système événementiel de TelepathyMQ.

**Événements distants et événements locaux**

Les événements reçus depuis un nœud distant sont distribués localement à l'aide de l'implémentation native de EventEmitter.

Ils sont donc traités par les mêmes gestionnaires que les événements locaux portant le même nom.

Il est recommandé de distinguer les noms des événements système et applicatifs afin d'éviter les collisions.

**Absence de garantie de livraison**

L'enregistrement d'un gestionnaire avec on() ne garantit pas qu'un événement distant sera reçu.

La méthode emit() ne fournit pas de confirmation de livraison.

Les applications nécessitant une confirmation doivent mettre en place un mécanisme d'accusé de réception ou utiliser defer() lorsqu'une réponse est nécessaire.

**Gestion du cycle de vie des gestionnaires**

Les gestionnaires enregistrés restent actifs jusqu'à leur suppression ou jusqu'à ce qu'ils soient automatiquement supprimés dans le cas de once().

Dans les applications comportant de nombreux événements ou des connexions dynamiques, il est recommandé de gérer explicitement le cycle de vie des gestionnaires afin d'éviter les accumulations inutiles.

**Recommandation générale**

La méthode on() constitue le mécanisme central d'écoute des événements dans TelepathyMQ.

Elle permet de construire une architecture événementielle dans laquelle les différentes parties d'une application peuvent communiquer sans être directement dépendantes les unes des autres.

Pour une utilisation correcte, il est important de bien distinguer l'écoute des événements avec on(), l'émission locale avec le mécanisme natif de EventEmitter et l'envoi d'événements distants avec la méthode emit() de TelepathyMQ.
# Créer un nœud de communication avec new TelepathyMQ(identity)

TelepathyMQ permet de créer des nœuds de communication indépendants qui peuvent échanger des événements et exécuter des opérations asynchrones à travers un réseau.

Le constructeur new TelepathyMQ(identity) permet de créer une nouvelle instance TelepathyMQ et de lui attribuer une identité unique au sein de l'architecture de communication.

Chaque instance représente un nœud capable de :

- Établir des connexions avec des nœuds distants.
- Accepter des connexions entrantes.
- Envoyer et recevoir des événements.
- Exécuter des opérations distantes avec defer().
- Écouter les événements de connexion et de déconnexion.
- Gérer plusieurs connexions simultanément.
- Fermer les connexions qu'elle a créées.

L'identité attribuée à chaque instance permet aux autres nœuds de l'identifier et de communiquer avec elle.

1. Vue d'ensemble

La création d'un nœud TelepathyMQ s'effectue à l'aide du constructeur suivant :

```javascript
const TelepathyMQ = require('telepathymq');

const node = new TelepathyMQ('server');
```

Dans cet exemple :

- TelepathyMQ représente le constructeur de la bibliothèque.
- server correspond à l'identité attribuée au nouveau nœud.
- node représente l'instance créée.

Une fois l'instance créée, elle peut être configurée pour accepter des connexions entrantes ou établir des connexions avec d'autres nœuds.

La création d'une instance ne démarre pas automatiquement un serveur et n'établit aucune connexion réseau.

Ces opérations doivent être réalisées explicitement à l'aide des méthodes listen() et register().

2. Signature du constructeur

**Signature**

```javascript
new TelepathyMQ(identity, debugFunction)
```

**Paramètre**	**Type**	**Description**
identity	String	Identité attribuée au nœud TelepathyMQ
debugFunction	Function	Fonction facultative utilisée pour transmettre les informations de débogage

Le premier paramètre est obligatoire.

Le second paramètre est facultatif.

**identity**

L'identité représente le nom sous lequel le nœud sera connu dans le réseau TelepathyMQ.

Elle est notamment utilisée pour identifier les destinations lors des appels à emit() et defer().

**Exemple**

```javascript
const server = new TelepathyMQ('server');
const client = new TelepathyMQ('client');
```

Les deux instances possèdent des identités distinctes :

- server
- client

Le client pourra ensuite communiquer avec le serveur en utilisant son identité.

```javascript
client.emit('server', 'message', {
  text: 'Hello from client'
});
```

**debugFunction**

Le second paramètre permet de fournir une fonction de débogage personnalisée.

Cette fonction est stockée dans la propriété interne this.debug et est transmise aux sockets créés par l'instance.

Si aucune fonction n'est fournie, TelepathyMQ utilise une fonction vide.

```javascript
this.debug = debugFunction || (() => {});
```

Cela permet de désactiver les sorties de débogage par défaut ou de fournir son propre mécanisme de journalisation.

3. Initialisation de l'instance

Lors de sa création, le constructeur initialise plusieurs propriétés internes nécessaires au fonctionnement de TelepathyMQ.

Voici l'implémentation du constructeur :

```javascript
class Telepathymq extends EventEmitter {

  constructor(identity, debugFunction) {
    super();

    this.identity = identity;
    this.relations = {};
    this.debug = debugFunction || (() => {});
    this.defers = {};
    this.socks = [];
  }

}
```

Chaque propriété joue un rôle spécifique.

**Propriété**	**Type**	**Description**
identity	String	Identité du nœud
relations	Object	Contient les relations avec les nœuds distants
debug	Function	Fonction de débogage
defers	Object	Stocke les opérations différées en attente
socks	Array	Contient les sockets gérés par l'instance

Le constructeur appelle également super() afin d'initialiser la classe parente EventEmitter.

Cela permet à chaque instance TelepathyMQ de bénéficier du système natif de gestion des événements de Node.js.

4. Héritage de EventEmitter

TelepathyMQ étend la classe native EventEmitter de Node.js.

```javascript
const { EventEmitter } = require('node:events');

class Telepathymq extends EventEmitter {
  constructor(identity, debugFunction) {
    super();

    // Initialization
  }
}
```

Cet héritage permet à chaque instance de disposer des fonctionnalités natives de gestion des événements.

Parmi les méthodes disponibles :

- on() : écouter un événement.
- once() : écouter un événement une seule fois.
- off() : supprimer un gestionnaire d'événement.
- addListener() : ajouter un gestionnaire d'événement.
- removeListener() : supprimer un gestionnaire spécifique.
- removeAllListeners() : supprimer les gestionnaires d'événements.

**Exemple**

```javascript
const node = new TelepathyMQ('server');

node.on('register', identity => {
  console.log('Remote node registered:', identity);
});

node.on('unregister', identity => {
  console.log('Remote node disconnected:', identity);
});
```

Ces gestionnaires permettent de réagir aux événements émis par le fonctionnement interne de TelepathyMQ.

**Important**

TelepathyMQ redéfinit également la méthode publique emit() pour permettre l'envoi d'événements vers des nœuds distants.

Il existe donc une distinction entre l'écoute des événements avec on() et l'émission d'événements avec emit().

5. Attribution d'une identité

Chaque instance TelepathyMQ possède une identité définie lors de sa création.

Cette identité est utilisée par les autres nœuds pour identifier la destination de leurs communications.

**Exemple**

```javascript
const server = new TelepathyMQ('server');
const client = new TelepathyMQ('client');
const worker = new TelepathyMQ('worker');
```

Dans cet exemple, trois nœuds indépendants sont créés.

Chaque instance possède sa propre identité.

Le client peut ensuite envoyer un événement au serveur :

```javascript
client.emit('server', 'message', {
  text: 'Hello server'
});
```

Le serveur peut également envoyer un événement au worker, à condition qu'une relation avec celui-ci ait été établie.

```javascript
server.emit('worker', 'task', {
  action: 'process'
});
```

L'identité est donc un élément central du mécanisme de communication de TelepathyMQ.

**Remarque**

Le constructeur stocke directement la valeur fournie dans this.identity. Il ne réalise pas de vérification explicite de son type, de son format ou de son unicité.

6. Fonction de débogage

Le constructeur accepte une fonction facultative permettant de personnaliser le traitement des informations de débogage.

Cette fonction est stockée dans this.debug.

**Exemple avec une fonction personnalisée**

```javascript
const TelepathyMQ = require('telepathymq');

const debug = (level, message) => {
  console.log(`[${level}] ${message}`);
};

const node = new TelepathyMQ('server', debug);
```

La fonction de débogage est ensuite transmise aux instances de sockets créées par listen() et register().

Cela permet de centraliser les informations de diagnostic provenant de la couche réseau.

**Utilisation sans fonction de débogage**

```javascript
const node = new TelepathyMQ('server');
```

Dans ce cas, le constructeur utilise automatiquement une fonction vide :

```javascript
() => {}
```

Aucune sortie de débogage n'est donc produite par l'intermédiaire de cette fonction par défaut.

7. Gestion des relations distantes

Le constructeur initialise la propriété relations avec un objet vide.

```javascript
this.relations = {};
```

Cette propriété est utilisée pour conserver les relations avec les nœuds distants.

Lorsqu'un nœud distant est enregistré, TelepathyMQ ajoute une référence à son émetteur dans cet objet.

Par exemple, dans la méthode listen() :

```javascript
sock.on('register', (identity, emitter) => {
  this.relations[identity] = emitter;
});
```

La méthode register() utilise également cette propriété :

```javascript
sock.register(identity, connectString, emitter => {
  this.relations[identity] = emitter;
});
```

Les méthodes emit() et defer() utilisent ensuite ces relations pour communiquer avec les nœuds distants.

**Exemple**

```javascript
const server = new TelepathyMQ('server');
const client = new TelepathyMQ('client');

// Establish the connection
client.register('server', 'tcp://127.0.0.1:8060');

// Send an event after registration
client.on('register', identity => {
  client.emit(identity, 'message', {
    text: 'Hello server'
  });
});
```

La propriété relations constitue donc le mécanisme interne permettant de retrouver les destinations disponibles.

8. Gestion des opérations différées

Le constructeur initialise également la propriété defers.

```javascript
this.defers = {};
```

Cette propriété permet de stocker les opérations asynchrones distantes créées avec defer().

Chaque opération reçoit un identifiant UUID permettant de distinguer les différentes requêtes.

**Exemple**

```javascript
const client = new TelepathyMQ('client');

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
  console.error('Error:', error);
});
```

Lorsqu'une opération est créée, TelepathyMQ enregistre son objet différé dans this.defers.

Cet objet permet ensuite de retrouver l'opération correspondante lorsque le résultat, une notification ou un rejet est reçu.

L'initialisation de cette propriété garantit que chaque instance dispose de son propre espace de gestion des opérations différées.

9. Gestion des sockets

Le constructeur initialise la propriété socks avec un tableau vide.

```javascript
this.socks = [];
```

Ce tableau contient les sockets créés par l'instance TelepathyMQ.

Les sockets sont notamment ajoutés lors des appels à listen() et register().

**Exemple avec listen()**

```javascript
const server = new TelepathyMQ('server');

server.listen(8060);
```

**Exemple avec register()**

```javascript
const client = new TelepathyMQ('client');

client.register('server', 'tcp://127.0.0.1:8060');
```

Dans les deux cas, le socket créé est enregistré dans this.socks.

Cette propriété permet ensuite à la méthode close() de fermer centralement les connexions gérées par l'instance.

```javascript
node.close(error => {
  if (error) {
    console.error(error);
    return;
  }

  console.log('Connections closed');
});
```

Chaque instance possède son propre tableau de sockets.

10. Exemple complet

L'exemple suivant présente la création de deux nœuds TelepathyMQ et leur utilisation pour établir une communication.

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

  client.emit('server', 'message', {
    text: 'Hello from client'
  });
});

client.register('server', 'tcp://127.0.0.1:8060');
```

Dans cet exemple :

- Le serveur est créé avec l'identité server.
- Le client est créé avec l'identité client.
- Le serveur démarre l'écoute sur le port 8060.
- Le client établit une connexion avec le serveur.
- Le client reçoit l'événement register.
- Le client envoie un événement message au serveur.
- Le serveur reçoit et traite le message.

Cet exemple illustre le rôle du constructeur dans la création des nœuds qui composent une architecture TelepathyMQ.

11. Bonnes pratiques

- Attribuer une identité explicite et facilement identifiable à chaque nœud.
- Utiliser des identités uniques au sein du réseau de communication.
- Fournir une fonction de débogage personnalisée pendant le développement lorsque cela est nécessaire.
- Éviter de partager directement les propriétés internes d'une instance entre plusieurs composants.
- Utiliser listen() pour accepter les connexions entrantes.
- Utiliser register() pour établir des connexions avec des nœuds distants.
- Enregistrer les gestionnaires d'événements avec on() avant de démarrer les opérations de communication lorsque cela est nécessaire.
- Utiliser defer() lorsque le résultat d'une opération distante est attendu.
- Utiliser close() pour fermer les connexions gérées par l'instance.
- Prévoir une gestion des erreurs adaptée aux opérations réseau et aux communications asynchrones.
- Éviter de créer plusieurs instances avec la même identité dans un même espace de communication sans avoir défini une stratégie appropriée.

12. Récapitulatif de l'API

**Propriété / Méthode**	**Rôle**	**Description**
new TelepathyMQ()	Constructeur	Crée une nouvelle instance
identity	Propriété	Identité du nœud
debug	Propriété	Fonction de débogage
relations	Propriété interne	Références aux nœuds distants
defers	Propriété interne	Opérations différées en attente
socks	Propriété interne	Sockets gérés par l'instance
on()	Méthode héritée	Écoute les événements
listen()	Méthode	Démarre l'écoute des connexions entrantes
register()	Méthode	Établit une connexion distante
emit()	Méthode	Envoie un événement à un nœud distant
defer()	Méthode	Démarre une opération distante avec résultat asynchrone
close()	Méthode	Ferme les connexions gérées

13. Points importants à prendre en compte

**L'identité du nœud**

L'identité est attribuée directement lors de la création de l'instance.

Elle est utilisée pour identifier le nœud dans les communications TelepathyMQ.

Il est recommandé d'utiliser des identités explicites, stables et uniques dans le contexte du réseau.

Le constructeur ne vérifie cependant pas que l'identité est valide ou qu'elle n'est pas déjà utilisée.

**Aucune connexion réseau automatique**

La création d'une instance TelepathyMQ ne démarre aucune connexion réseau.

Elle initialise uniquement les propriétés nécessaires au fonctionnement du nœud.

Pour rendre le nœud opérationnel, il faut ensuite utiliser :

- listen() pour accepter des connexions entrantes.
- register() pour se connecter à un nœud distant.

Cette distinction est importante : création d'une instance et établissement d'une connexion sont deux opérations indépendantes.

**Fonction de débogage facultative**

Si aucune fonction de débogage n'est fournie, TelepathyMQ utilise une fonction vide.

Cela permet de ne pas imposer de mécanisme de journalisation à l'application.

La fonction fournie est transmise aux sockets créés par l'instance.

Il est recommandé d'utiliser une fonction personnalisée pendant le développement afin de faciliter le diagnostic des problèmes de communication.

**Isolation des propriétés internes**

Chaque instance dispose de ses propres objets relations et defers, ainsi que de son propre tableau socks.

Ces propriétés permettent d'isoler la gestion des connexions et des opérations différées entre les différents nœuds.

Il est préférable de ne pas modifier directement ces propriétés depuis le code applicatif.

**Héritage de EventEmitter**

TelepathyMQ hérite de EventEmitter, ce qui permet d'utiliser les fonctionnalités natives de gestion des événements.

Cependant, la méthode emit() est redéfinie pour assurer la communication avec les nœuds distants.

Il faut donc distinguer l'écoute des événements locaux et entrants avec on() de l'envoi d'événements distants avec emit().

**Absence de validation des paramètres**

L'implémentation actuelle du constructeur ne réalise aucune validation explicite des paramètres.

Elle ne vérifie notamment pas :

- Que identity est une chaîne de caractères.
- Que identity n'est pas vide.
- Que l'identité est unique dans le réseau.
- Que debugFunction est effectivement une fonction.

Il pourrait être intéressant d'ajouter ces validations afin de détecter les erreurs de configuration dès la création de l'instance.

**Cycle de vie de l'instance**

Une instance TelepathyMQ est conçue pour gérer ses propres connexions et opérations asynchrones.

Il est recommandé de suivre un cycle de vie clair :

- Créer l'instance.
- Configurer les gestionnaires d'événements.
- Démarrer l'écoute ou établir les connexions.
- Échanger des événements et exécuter des opérations distantes.
- Fermer les connexions avec close() lorsque l'instance n'est plus nécessaire.

Cette organisation facilite la gestion des ressources et limite les risques de connexions oubliées.

**Recommandation générale**

Le constructeur new TelepathyMQ(identity) constitue le point d'entrée de toute utilisation de la bibliothèque.

Il initialise l'ensemble des structures internes nécessaires à la gestion des connexions, des événements et des opérations différées.

Pour une utilisation fiable de TelepathyMQ, il est recommandé d'attribuer une identité explicite à chaque instance, de valider les paramètres de configuration et de respecter le cycle de vie des connexions.

**Recommandations pour l'évolution du constructeur**

En examinant l'implémentation actuelle, je retiendrais quatre améliorations possibles :

- Valider identity : vérifier que la valeur est bien une chaîne non vide.

- Valider debugFunction : rejeter explicitement les valeurs qui ne sont pas des fonctions lorsqu'elles sont fournies.

- Documenter l'unicité des identités : préciser les conséquences de deux nœuds portant la même identité.

- Préserver l'encapsulation : envisager à terme de protéger les propriétés internes relations, defers et socks contre les modifications directes par les applications.

Conserver en revanche l'héritage de EventEmitter, qui est un choix architectural cohérent avec le fonctionnement événementiel de TelepathyMQ.
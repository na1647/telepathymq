# TelepathyMQ

## Communication interprocessus pour Node.js

TelepathyMQ est une bibliothèque Node.js permettant à plusieurs processus indépendants de communiquer entre eux au moyen d'événements et d'opérations asynchrones.

Elle fournit une couche de communication fondée sur des identités, utilisant TCP, TLS ou des sockets Unix.

## Fonctionnalités
Communication par identité — adresser les nœuds distants à partir de leur identité.
Messagerie événementielle — envoyer et recevoir des événements JavaScript entre processus.
Opérations différées — effectuer des échanges asynchrones de type requête/réponse avec notifications de progression.
TCP et TLS — communiquer via des connexions réseau classiques ou sécurisées.
Sockets Unix — communiquer localement sans utiliser TCP.
Reconnexion automatique — rétablir une connexion lorsqu'elle est interrompue.
Sérialisation MessagePack — échanger efficacement des données JavaScript structurées.

## Prérequis
Node.js >= 20.20.0

## Installation

npm install telepathymq

## Démarrage rapide

L'exemple suivant montre comment faire communiquer deux processus Node.js indépendants.

1. Démarrer le serveur

Créer un fichier server.js :

```javascript
const TelepathyMQ = require('telepathymq');

const server = new TelepathyMQ('server');

server.on('register', (identity) => {
  console.log(`${identity} connecté`);
});

server.on('message', (message) => {
  console.log('Message reçu :', message);
});

server.listen(8060, () => {
  console.log('Serveur en écoute sur le port 8060');
});
```

2. Démarrer le client

Créer un fichier client.js :

```javascript
const TelepathyMQ = require('telepathymq');

const client = new TelepathyMQ('client');

client.on('register', (identity) => {
  console.log(`Connecté à ${identity}`);

  client.emit('server', 'message', {
    text: 'Bonjour depuis TelepathyMQ !',
    timestamp: Date.now()
  });
});

client.register('server', 'tcp://127.0.0.1:8060');
```

3. Exécuter l'exemple

Ouvrir deux terminaux.

Terminal 1 :

node server.js


Terminal 2 :

node client.js

Le serveur reçoit alors le message envoyé par le client.

## Fonctionnement

Chaque instance TelepathyMQ possède une identité.

Par exemple :

- server identifie le processus serveur.
- client identifie le processus client.

Une fois la connexion établie, les deux processus peuvent échanger des événements en utilisant leurs identités respectives.

text
+-------------------+       TCP       +-------------------+
|                   |                 |                   |
|       Client      | <-------------> |      Serveur      |
|                   |                 |                   |
|   identité :      |                 |   identité :      |
|   client          |                 |   server          |
|                   |                 |                   |
|   emit()          |                 |   on()            |
|                   |                 |                   |
+-------------------+                 +-------------------+

## Documentation

La documentation détaillée est disponible en français et en anglais.

### Français
Guide de démarrage
Concepts fondamentaux
Messagerie
Requêtes et réponses
Configuration TLS
Référence de l'API
Dépannage

### English
English documentation
Getting Started

## Aperçu de l'API
Méthode	                    Description
new TelepathyMQ(identity)	  Créer un nœud de communication
listen()	                  Démarrer l'écoute des connexions entrantes
register()	                Se connecter à un nœud distant
emit()	                    Envoyer un événement à un nœud distant
on()	                      Écouter les événements locaux et les messages entrants
defer()	                    Démarrer une opération différée de type requête/réponse
close()	                    Fermer les connexions gérées

## Licence
MIT
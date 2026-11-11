# Fermer les connexions gérées avec close()

TelepathyMQ fournit un mécanisme permettant de fermer les connexions réseau gérées par une instance.

La méthode close() permet de fermer l'ensemble des sockets ouverts et enregistrés par une instance TelepathyMQ, qu'ils aient été créés à l'aide de listen() ou de register().

Elle fournit un mécanisme centralisé de fermeture des connexions et permet de récupérer les éventuelles erreurs survenues pendant cette opération.

La méthode offre notamment les fonctionnalités suivantes :

- Fermer tous les sockets gérés par une instance TelepathyMQ.
- Attendre la fin de toutes les opérations de fermeture.
- Collecter les éventuelles erreurs rencontrées.
- Signaler la fin de l'opération à l'aide d'un callback.
- Centraliser la fermeture des connexions entrantes et sortantes.

La méthode close() constitue ainsi le mécanisme principal de fermeture des ressources réseau gérées par une instance TelepathyMQ.

1. Vue d'ensemble

Une instance TelepathyMQ peut gérer plusieurs connexions simultanément.

Ces connexions sont notamment créées par les méthodes suivantes :

- listen() : démarre l'écoute des connexions entrantes.
- register() : établit une connexion avec un nœud distant.

Chaque socket créé est enregistré dans le tableau interne this.socks.

La méthode close() parcourt ce tableau et demande la fermeture de chaque socket.

**Exemple**

```javascript
node.close(error => {
  if (error) {
    console.error('Error while closing connections:', error);
    return;
  }

  console.log('All connections closed');
});
```

Dans cet exemple, la méthode demande la fermeture de toutes les connexions gérées par l'instance.

Le callback est exécuté lorsque toutes les tentatives de fermeture sont terminées.

2. Signature de la méthode

**Signature**

```javascript
node.close(callback)
```

**Paramètre**	**Type**	**Description**
callback	Function	Fonction appelée lorsque toutes les opérations de fermeture sont terminées

Le paramètre callback est facultatif.

Si aucun callback n'est fourni, TelepathyMQ utilise une fonction vide par défaut.

**Exemple sans callback**

```javascript
node.close();
```

**Exemple avec callback**

```javascript
node.close(error => {
  if (error) {
    console.error('Close failed:', error);
    return;
  }

  console.log('Connections successfully closed');
});
```

Le callback reçoit un argument :

error : première erreur rencontrée pendant la fermeture, ou undefined si toutes les opérations ont réussi.

3. Fonctionnement interne

La méthode commence par vérifier si un callback a été fourni.

```javascript
cb = cb || (() => {});
```

Si aucun callback n'est fourni, une fonction vide est utilisée.

Elle parcourt ensuite l'ensemble des sockets enregistrés dans this.socks.

```javascript
const tasks = this.socks.map(sock => {
  return new Promise((resolve, reject) => {
    sock.close(error => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
});
```

Pour chaque socket, une Promise est créée afin de représenter son opération de fermeture.

Le fonctionnement est le suivant :

- La méthode appelle sock.close().
- Le callback du socket indique si la fermeture a rencontré une erreur.
- En cas d'erreur, la Promise est rejetée.
- En cas de succès, la Promise est résolue.

Cette approche permet de gérer plusieurs opérations de fermeture de manière concurrente.

4. Fermeture de plusieurs sockets

Une instance TelepathyMQ peut gérer plusieurs sockets simultanément.

Par exemple, une même instance peut démarrer plusieurs serveurs d'écoute :

```javascript
const TelepathyMQ = require('telepathymq');

const node = new TelepathyMQ('server');

node.listen(8060);
node.listen(8061);
node.listen(8062);
```

Chaque appel à listen() crée un nouveau socket qui est ajouté au tableau this.socks.

La méthode close() permet de fermer tous ces sockets en un seul appel.

```javascript
node.close(error => {
  if (error) {
    console.error('Unable to close all sockets:', error);
    return;
  }

  console.log('All listening sockets have been closed');
});
```

Il n'est donc pas nécessaire d'appeler individuellement close() sur chaque socket.

Le même principe s'applique aux sockets créés par register().

5. Gestion des opérations concurrentes

La méthode utilise Promise.allSettled() pour attendre la fin de toutes les opérations de fermeture.

```javascript
Promise.allSettled(tasks).then(results => {
  const failed = results.find(
    result => result.status === 'rejected'
  );

  cb(failed ? failed.reason : undefined);
});
```

Contrairement à Promise.all(), Promise.allSettled() attend que toutes les Promises soient terminées, qu'elles soient résolues ou rejetées.

Cela signifie qu'une erreur rencontrée lors de la fermeture d'un socket n'interrompt pas les tentatives de fermeture des autres sockets.

Une fois toutes les opérations terminées, TelepathyMQ recherche la première opération rejetée.

Si une erreur est trouvée, elle est transmise au callback.

Sinon, le callback est appelé avec undefined.

**Exemple**

```javascript
node.close(error => {
  if (error) {
    console.error('At least one socket failed to close:', error);
    return;
  }

  console.log('All sockets closed successfully');
});
```

Cette approche garantit que le callback final n'est pas appelé avant la fin de toutes les opérations de fermeture.

6. Gestion des erreurs

La méthode close() utilise un mécanisme de gestion des erreurs basé sur les callbacks des sockets et les Promises.

**Fermeture réussie**

Si tous les sockets sont correctement fermés, le callback reçoit undefined.

```javascript
node.close(error => {
  if (!error) {
    console.log('Shutdown completed successfully');
  }
});
```

**Erreur lors de la fermeture**

Si un socket rencontre une erreur pendant sa fermeture, sa Promise est rejetée.

```javascript
sock.close(error => {
  if (error) {
    reject(error);
  } else {
    resolve();
  }
});
```

L'erreur est ensuite récupérée après la terminaison de toutes les opérations.

```javascript
const failed = results.find(
  result => result.status === 'rejected'
);
```

Si plusieurs sockets rencontrent des erreurs, seule la première erreur rencontrée dans l'ordre du tableau results est transmise au callback.

Les autres erreurs ne sont pas exposées par l'API publique de close().

**Exemple**

```javascript
node.close(error => {
  if (error) {
    console.error('Shutdown error:', error.message);
    return;
  }

  console.log('Shutdown completed');
});
```

7. Utilisation avec listen() et register()

La méthode close() fonctionne avec les sockets créés par les deux méthodes de connexion principales de TelepathyMQ.

**Fermeture des sockets créés avec listen()**

Lorsqu'une instance démarre un serveur d'écoute :

```javascript
const server = new TelepathyMQ('server');

server.listen(8060);
server.listen(8061);
```

Les sockets créés sont enregistrés dans this.socks.

Un seul appel à close() permet de demander leur fermeture.

```javascript
server.close(error => {
  if (error) {
    console.error(error);
    return;
  }

  console.log('Listening sockets closed');
});
```

**Fermeture des sockets créés avec register()**

Lorsqu'une instance se connecte à plusieurs nœuds distants :

```javascript
const client = new TelepathyMQ('client');

client.register('server1', 'tcp://127.0.0.1:8060');
client.register('server2', 'tcp://127.0.0.1:8061');
```

Chaque socket créé est également ajouté à this.socks.

L'appel à close() permet donc de demander la fermeture de toutes les connexions sortantes gérées par cette instance.

```javascript
client.close(error => {
  if (error) {
    console.error(error);
    return;
  }

  console.log('Remote connections closed');
});
```

La méthode ne fait aucune distinction entre les sockets entrants et sortants : tous les sockets présents dans this.socks sont concernés.

8. Valeur de retour et callback

Contrairement à certaines méthodes asynchrones de Node.js, close() ne retourne pas de Promise.

Elle déclenche les opérations de fermeture et utilise un callback pour signaler leur terminaison.

**Exemple**

```javascript
const result = node.close(error => {
  if (error) {
    console.error(error);
  }
});

console.log(result);
```

La valeur de retour de close() est undefined.

Le résultat de l'opération doit donc être récupéré à travers le callback.

Le callback suit une convention de type error-first :

**Argument**	**Valeur**	**Signification**
error	undefined	Toutes les fermetures ont réussi
error	Error	Au moins une fermeture a échoué

**Important**

Le callback est exécuté de manière asynchrone, après la résolution de Promise.allSettled().

Il ne faut donc pas supposer que les sockets sont déjà fermés immédiatement après l'appel à close().

9. Exemple complet

L'exemple suivant montre comment utiliser close() pour arrêter proprement une application TelepathyMQ.

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

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Closing server connections...');

  server.close(error => {
    if (error) {
      console.error('Shutdown failed:', error);
      process.exitCode = 1;
      return;
    }

    console.log('Server successfully stopped');
    process.exitCode = 0;
  });
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

client.on('unregister', identity => {
  console.log('Disconnected from:', identity);
});

client.register('server', 'tcp://127.0.0.1:8060');

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Closing client connections...');

  client.close(error => {
    if (error) {
      console.error('Shutdown failed:', error);
      process.exitCode = 1;
      return;
    }

    console.log('Client successfully stopped');
    process.exitCode = 0;
  });
});
```

Dans cet exemple :

- Le serveur démarre l'écoute sur le port 8060.
- Le client établit une connexion avec le serveur.
- Le client transmet un événement message.
- Les deux instances peuvent communiquer.
- Lorsqu'un signal SIGINT est reçu, chaque instance appelle close().
- Tous les sockets gérés par l'instance concernée font l'objet d'une demande de fermeture.
- Le callback est exécuté après la fin de toutes les tentatives de fermeture.

Cet exemple illustre une utilisation de close() dans le cadre de l'arrêt d'une application Node.js.

10. Fermeture sans callback

Le callback de close() est facultatif.

Lorsqu'il n'est pas fourni, TelepathyMQ utilise une fonction vide.

```javascript
node.close();
```

Les opérations de fermeture sont néanmoins exécutées normalement.

Cependant, l'application ne dispose d'aucun moyen direct pour connaître leur résultat.

Pour les applications nécessitant un arrêt contrôlé, il est donc préférable de toujours fournir un callback.

**Exemple recommandé**

```javascript
node.close(error => {
  if (error) {
    console.error('Unable to close connections:', error);
    return;
  }

  console.log('All connections successfully closed');
});
```

11. Bonnes pratiques

- Appeler close() lorsque l'instance TelepathyMQ n'a plus besoin de ses connexions.
- Fournir systématiquement un callback lorsque le résultat de la fermeture est important.
- Vérifier l'erreur transmise au callback.
- Utiliser close() pour fermer centralement les sockets créés avec listen() et register().
- Attendre l'exécution du callback avant de considérer l'opération de fermeture comme terminée.
- Éviter de supposer que les sockets sont fermés immédiatement après l'appel à close().
- Prévoir une stratégie spécifique pour les opérations defer() encore en attente.
- Surveiller les événements unregister pour suivre les déconnexions.
- Éviter de multiplier les appels à close() sans gérer le cycle de vie des sockets.
- Prévoir un mécanisme d'arrêt adapté aux signaux système tels que SIGINT et SIGTERM.

12. Récapitulatif de l'API

**Méthode / Élément**	**Rôle**	**Côté**

node.close()	Ferme tous les sockets gérés par l'instance	Nœud local
sock.close()	Ferme un socket individuel	Couche socket
this.socks	Contient les sockets gérés par l'instance	Interne
Promise.allSettled()	Attend la terminaison de toutes les opérations de fermeture	Interne
callback(error)	Signale la fin des opérations de fermeture	Nœud local
listen()	Crée un socket d'écoute	Nœud serveur
register()	Crée un socket de connexion distante	Nœud client
unregister	Signale la fermeture d'une connexion distante	Nœud local
defer()	Démarre une opération distante	Nœud demandeur

13. Points importants à prendre en compte

**Fermeture de tous les sockets gérés**

La méthode close() ferme tous les sockets présents dans this.socks.

Elle ne distingue pas les sockets créés avec listen() de ceux créés avec register().

Une seule invocation permet donc de demander la fermeture de l'ensemble des connexions gérées par l'instance.

**Attente de toutes les opérations de fermeture**

L'utilisation de Promise.allSettled() permet d'attendre la terminaison de toutes les opérations, même lorsqu'une ou plusieurs fermetures échouent.

Cela évite qu'une erreur isolée empêche les autres sockets de recevoir leur demande de fermeture.

**Première erreur uniquement**

Lorsque plusieurs sockets rencontrent des erreurs, la méthode ne transmet que la première erreur trouvée dans les résultats.

Les autres erreurs ne sont pas retournées à l'application.

Si une visibilité complète sur les erreurs individuelles est nécessaire, l'implémentation actuelle devrait être adaptée pour exposer l'ensemble des résultats.

**Aucune Promise retournée**

La méthode close() ne retourne pas de Promise.

Elle utilise exclusivement un callback pour communiquer le résultat de l'opération.

Les applications souhaitant utiliser async/await doivent donc encapsuler la méthode dans une Promise.

Par exemple :

```javascript
await new Promise((resolve, reject) => {
  node.close(error => {
    if (error) {
      reject(error);
    } else {
      resolve();
    }
  });
});
```

**Opérations defer() en attente**

La fermeture des sockets ne signifie pas que toutes les opérations defer() en cours sont automatiquement rejetées ou terminées.

Dans l'implémentation actuelle, close() ne parcourt pas this.defers et ne rejette pas les opérations en attente.

Par conséquent :

- Certaines opérations distantes peuvent rester en attente.
- Les callbacks done() et fail() peuvent ne jamais être exécutés.
- Les applications doivent prévoir leur propre stratégie de gestion des opérations en cours.

Il est recommandé de gérer explicitement les opérations asynchrones avant de fermer les connexions lorsque leur résultat est important.

**Le tableau this.socks n'est pas vidé**

L'implémentation actuelle parcourt les sockets présents dans this.socks, mais ne vide pas ce tableau après leur fermeture.

Les références aux sockets restent donc conservées dans l'instance.

Cela signifie également que des appels ultérieurs à close() pourront tenter de fermer à nouveau ces mêmes sockets.

Il serait intéressant d'envisager une évolution de l'implémentation afin de nettoyer le tableau après la fermeture, tout en tenant compte de la gestion des erreurs et des éventuelles nouvelles connexions.

**Les relations distantes ne sont pas réinitialisées**

La méthode close() ne vide pas non plus l'objet this.relations.

Elle ne définit pas explicitement toutes les relations à null et ne supprime pas leurs entrées.

La gestion de l'état des relations après la fermeture dépend donc des événements et du comportement de la couche socket.

Il faut éviter de considérer automatiquement que toutes les relations sont correctement réinitialisées après un appel à close().

**Absence de garantie de fermeture applicative complète**

La méthode attend la fin des callbacks de fermeture des sockets, mais ne garantit pas que tous les traitements applicatifs ou toutes les opérations distantes ont été terminés.

Les applications nécessitant un arrêt totalement maîtrisé doivent également gérer leurs tâches en cours, leurs opérations defer() et leurs éventuelles ressources externes.

**Recommandation générale**

La méthode close() constitue le point central de fermeture des connexions réseau gérées par TelepathyMQ.

Elle permet de simplifier l'arrêt d'une instance en regroupant toutes les opérations de fermeture dans un seul appel.

Pour un arrêt propre de l'application, il est recommandé d'attendre son callback, de traiter les éventuelles erreurs et de gérer séparément les opérations asynchrones encore en cours.

**Quelques recommandations pour l'implémentation**

En examinant le code, on voit trois améliorations qui pourraient être intéressantes pour une prochaine version de TelepathyMQ :

- Vider this.socks après fermeture : éviter de conserver inutilement les références aux sockets fermés.

- Réinitialiser this.relations : éviter de conserver des relations qui ne correspondent plus à des connexions actives.

- Gérer les defer() en attente : rejeter explicitement les opérations qui ne peuvent plus aboutir à la suite de la fermeture.

Conserver néanmoins le principe de Promise.allSettled() : c'est un bon choix pour garantir que toutes les tentatives de fermeture sont effectuées, même lorsqu'un socket rencontre une erreur.
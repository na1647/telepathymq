# Connexion à un nœud distant avec register()

TelepathyMQ fournit un mécanisme permettant à un nœud d'établir une connexion avec un autre nœud distant.

La méthode register() permet à une instance de TelepathyMQ de se connecter à un serveur distant en utilisant son identité et une adresse de connexion.

Elle constitue le point d'entrée des connexions sortantes et permet notamment :

- D'établir une connexion avec un nœud distant.
- D'associer une connexion à une identité distante.
- De prendre en charge les connexions TCP et TLS.
- D'enregistrer la relation avec le nœud distant.
- De détecter l'établissement et la fermeture des connexions.
- D'échanger des événements avec le nœud distant.
- D'exécuter des opérations différées (defer()).

La méthode repose sur le module interne socket de TelepathyMQ, qui assure la gestion des connexions réseau.

1. Vue d'ensemble

Un nœud établit une connexion avec un serveur distant à l'aide de :

```javascript
client.register('server', 'tcp://127.0.0.1:8060');
```

Deux informations principales sont nécessaires :

- L'identité du nœud distant.
- L'adresse de connexion du serveur distant.

Lors de l'établissement de la connexion, TelepathyMQ transmet un message register contenant l'identité du nœud local.

Le serveur distant peut alors identifier le nœud qui vient de se connecter.

Une fois la connexion établie, TelepathyMQ enregistre la relation dans this.relations et émet un événement public register.

Le client peut ensuite communiquer avec le serveur à l'aide des méthodes emit() et defer().

2. Signature de la méthode

**Signature**

```javascript
node.register(identity, connectString, options, cb)
```

**Paramètre**	**Type**	**Description**
identity	String	Identité du nœud distant auquel se connecter
connectString	Number / String	Port réseau ou chaîne de connexion du serveur distant
options	Object	Options de configuration TLS. Paramètre facultatif.
cb	Function	Callback appelé lorsque l'enregistrement de la connexion est terminé

Les paramètres options et cb sont facultatifs.

Lorsque le troisième argument est une fonction, il est automatiquement interprété comme le callback.

**Utilisation avec une chaîne de connexion**

```javascript
client.register(
  'server',
  'tcp://127.0.0.1:8060',
  callback
);
```

Dans cette configuration :

- identity correspond à l'identité du serveur distant.
- connectString contient l'adresse de connexion.
- callback est appelé lorsque l'enregistrement est terminé.

**Utilisation avec un port**

```javascript
client.register('server', 8060, callback);
```

Dans cette configuration :

- identity correspond à l'identité du serveur distant.
- connectString correspond au port réseau.
- Le module socket utilise l'adresse 0.0.0.0 comme adresse de connexion dans cet appel interne.

**Utilisation avec TLS**

Pour établir une connexion TLS, il faut fournir une chaîne de connexion commençant par tls ainsi que les options TLS correspondantes.

```javascript
client.register(
  'server',
  'tls://127.0.0.1:8060',
  tlsOptions,
  callback
);
```

Dans cette configuration :

- identity correspond à l'identité du serveur distant.
- connectString contient l'adresse TLS du serveur.
- tlsOptions contient les paramètres TLS.

TelepathyMQ transmet les options au socket interne à l'aide de :

```javascript
sock.set('tls', options);
```

3. Gestion des paramètres

La méthode register() prend en charge plusieurs formes d'appel.

Lorsque le troisième argument est une fonction, il est considéré comme le callback :

```javascript
if (typeof options === 'function') {
  cb = options;
  options = null;
}
```

Si aucun callback n'est fourni, TelepathyMQ utilise une fonction vide :

```javascript
cb = cb || (() => {});
```

Cela permet d'appeler register() sans avoir à fournir systématiquement un callback.

4. Établissement de la connexion

La méthode register() crée une nouvelle instance de socket :

```javascript
const Socket = createSocket(this.debug);
const sock = new Socket();
```

Elle configure ensuite l'identité du nœud local :

```javascript
sock.set('identity', this.identity);
```

Cette identité sera transmise au serveur distant lors de l'enregistrement.

Le module socket construit alors les données suivantes :

```javascript
const data = {
  identity: this.get('identity')
};
```

Lorsque la connexion est établie, le socket prépare un message register.

```javascript
const args = ['register', data];
const id = this.id();

this.callbacks[id] = callback || (() => {});

args.push(id);
```

Le message contient :

- Le nom de la commande register.
- Les données contenant l'identité du nœud local.
- Un identifiant interne permettant de retrouver le callback associé.

Si le socket est connecté et disponible en écriture, le message est immédiatement transmis.

Dans le cas contraire, le message est placé dans la file d'attente interne à l'aide de enqueue().

5. Gestion des différents types de connexion

Le module socket prend en charge deux types de paramètres pour établir une connexion.

** Connexion par port**

Lorsque le paramètre host est un nombre, le module utilise :

```javascript
this.connect(identity, host, '0.0.0.0', onConnect);
```

Le numéro fourni est interprété comme un port réseau.

**Connexion par chaîne de connexion**

Lorsque le paramètre host est une chaîne de caractères, le module utilise :

```javascript
this.connect(identity, host, onConnect);
```

La chaîne de connexion est alors transmise directement à la méthode interne connect().

Paramètre invalide

Si le paramètre host n'est ni un nombre ni une chaîne de caractères, le module déclenche une exception :

```javascript
throw new Error('invalid host parameter');
```

Il est donc nécessaire de fournir un port valide ou une chaîne de connexion.

6. Confirmation de l'enregistrement

Lorsque le serveur distant accepte la connexion et que l'enregistrement est effectué, TelepathyMQ met à jour ses relations internes.

```javascript
sock.register(identity, connectString, emitter => {
  this.relations[identity] = emitter;

  EventEmitter.prototype.emit.call(
    this,
    'register',
    identity
  );

  cb();
});
```

Deux opérations principales sont réalisées :

La relation avec le nœud distant est enregistrée dans this.relations.
Un événement public register est émis.

Le callback fourni à register() est ensuite exécuté.

L'application peut écouter l'événement register :

```javascript
client.on('register', identity => {
  console.log('Connected to:', identity);
});
```

Cet événement permet de détecter qu'un nœud distant a été enregistré et que sa relation est disponible.

**Important**

L'événement register émis par l'instance TelepathyMQ ne transmet que l'identité distante.

Il ne faut pas le confondre avec l'événement interne du socket, qui transmet également un objet emitter.

7. Gestion des déconnexions

TelepathyMQ écoute également l'événement interne socket close.

```javascript
sock.on('socket close', identity => {
  this.relations[identity] = null;

  EventEmitter.prototype.emit.call(
    this,
    'unregister',
    identity
  );
});
```

Lorsqu'une connexion est fermée :

La relation correspondante est mise à null.
L'événement public unregister est émis.

L'application peut écouter cet événement :

```javascript
client.on('unregister', identity => {
  console.log('Disconnected from:', identity);
});
```

Cela permet de surveiller l'état des connexions avec les nœuds distants.

**Important**

La relation n'est pas supprimée de this.relations. Sa valeur est simplement remplacée par null.

La méthode register() ne met pas en place explicitement de mécanisme de reconnexion automatique dans le code présenté.

8. Échange des événements et des opérations différées

Une fois la connexion enregistrée, TelepathyMQ peut communiquer avec le nœud distant.

Deux mécanismes sont disponibles.

**Événements classiques avec emit()**

La méthode emit() permet d'envoyer un événement sans attendre de résultat.

```javascript
client.emit('server', 'message', {
  text: 'Hello from client'
});
```

Le serveur peut recevoir cet événement :

```javascript
server.on('message', data => {
  console.log('Message received:', data);
});
```

**Opérations différées avec defer()**

La méthode defer() permet d'effectuer une requête distante et d'en recevoir le résultat.

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

Le serveur traite la requête :

```javascript
server.on('calculate', (defer, data) => {
  const result = data.a + data.b;

  defer.resolve({ result });
});
```

Pour plus de détails, consulter les documentations de emit() et defer().

9. Exemple complet

L'exemple suivant montre comment établir une connexion entre deux instances TelepathyMQ et échanger des événements ainsi que des opérations différées.

**Serveur**

```javascript
const TelepathyMQ = require('telepathymq');

const server = new TelepathyMQ('server');

server.on('register', (identity, emitter) => {
  console.log('Node registered:', identity);
});

server.on('unregister', identity => {
  console.log('Node disconnected:', identity);
});

server.on('message', data => {
  console.log('Message received:', data);
});

server.on('calculate', (defer, data) => {
  const { a, b } = data;

  console.log('Calculation requested');

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

**Client**

```javascript
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

client.on('unregister', identity => {
  console.log('Disconnected from:', identity);
});

client.register(
  'server',
  'tcp://127.0.0.1:8060',
  error => {
    if (error) {
      console.error('Registration failed:', error);
    }
  }
);
```

Dans cet exemple :

- Le serveur démarre l'écoute sur le port 8060.
- Le client initialise une connexion vers le serveur.
- Le client transmet son identité au serveur.
- Le serveur enregistre la relation avec le client.
- Le client reçoit l'événement register.
- Le client envoie un événement classique message.
- Le client démarre une opération différée avec defer().
- Le serveur traite la requête et retourne le résultat.

10. Gestion des erreurs

La méthode register() présente plusieurs comportements à prendre en compte.

**Paramètre host invalide**

Si le paramètre de connexion n'est ni un nombre ni une chaîne de caractères, une exception est déclenchée :

```javascript
throw new Error('invalid host parameter');
```

**Tentative d'enregistrement après bind()**

Le module socket interdit l'appel à register() lorsque le socket est déjà utilisé comme serveur.

Dans ce cas, une exception est déclenchée :

```javascript
throw new Error('cannot register() after bind()');
```

**Erreur de connexion**

Dans le code de socket.register(), le callback interne onConnect vérifie l'erreur de connexion :

```javascript
const onConnect = (err, sock) => {
  if (err) {
    return;
  }

  // Continue registration
};
```

Si une erreur survient pendant la connexion, la fonction retourne immédiatement.

**Important**

Dans l'implémentation actuelle présentée, cette erreur n'est pas transmise au callback public de register().

Le callback public est associé à la confirmation de l'enregistrement, et non directement au résultat de la tentative de connexion.

Il ne faut donc pas considérer ce callback comme un gestionnaire général des erreurs de connexion.

11. Bonnes pratiques

- Fournir une identité explicite au nœud local lors de sa création.
- Utiliser l'identité exacte du serveur distant lors de l'appel à register().
- Fournir une chaîne de connexion valide ou un port réseau.
- Écouter l'événement register pour détecter l'établissement de la relation.
- Écouter l'événement unregister pour détecter les déconnexions.
- Utiliser TLS lorsque les communications nécessitent une connexion sécurisée.
- Vérifier la disponibilité d'une relation avant d'envoyer des événements ou des opérations différées.
- Utiliser emit() pour les communications sans réponse attendue.
- Utiliser defer() pour les requêtes nécessitant un résultat ou des notifications de progression.
- Ne pas considérer le callback de register() comme une garantie de gestion des erreurs de connexion.
- Prévoir une stratégie applicative de surveillance et de reconnexion si cela est nécessaire.

12. Récapitulatif de l'API

**Méthode / Événement**	**Rôle**	**Côté**

node.register()	Établit une connexion avec un nœud distant	Nœud client
register	Signale l'enregistrement d'un nœud distant	Nœud client / serveur
unregister	Signale la fermeture d'une connexion	Nœud client / serveur
node.emit()	Envoie un événement classique	Nœud émetteur
node.defer()	Démarre une opération distante	Nœud demandeur
defer.notify()	Envoie une notification intermédiaire	Nœud récepteur
defer.resolve()	Termine une opération avec succès	Nœud récepteur
defer.reject()	Rejette une opération	Nœud récepteur
node.close()	Ferme les sockets ouverts	Nœud local

13. Points importants à prendre en compte

**Gestion des erreurs de connexion**

Dans l'implémentation actuelle, les erreurs rencontrées pendant l'établissement de la connexion ne sont pas transmises au callback public de register().

Le callback est uniquement appelé lorsque l'enregistrement de la connexion est confirmé.

Par conséquent :

- Le callback ne doit pas être considéré comme un gestionnaire général des erreurs de connexion.
- Une erreur de connexion peut interrompre le processus sans déclencher le callback public.
- L'application doit prévoir un mécanisme complémentaire pour détecter les connexions qui n'aboutissent pas.

**Absence de reconnexion automatique**

Lorsqu'un nœud distant se déconnecte, TelepathyMQ met la relation correspondante à null et émet un événement unregister.

Cependant, l'implémentation actuelle ne déclenche pas automatiquement une nouvelle tentative de connexion.

Par conséquent :

- Les événements envoyés vers ce nœud ne peuvent plus être transmis normalement.
- Les nouvelles opérations defer() destinées à ce nœud sont immédiatement rejetées.
- Les applications nécessitant une disponibilité permanente doivent implémenter leur propre stratégie de reconnexion.

Surveillance de l'état des connexions

Il est recommandé d'écouter systématiquement les événements register et unregister afin de suivre l'état des relations avec les nœuds distants.

Exemple :

```javascript
client.on('register', identity => {
  console.log('Connected to:', identity);
});

client.on('unregister', identity => {
  console.log('Disconnected from:', identity);
});
```

**Gestion des délais d'attente**

La méthode register() ne fournit pas de mécanisme intégré de gestion des délais d'attente pour les tentatives de connexion.

Les applications qui nécessitent des délais de connexion garantis doivent mettre en place leur propre stratégie de timeout.

**Utilisation des identités**

Chaque connexion est associée à une identité distante utilisée comme clé dans this.relations.

Il est donc important d'utiliser des identités cohérentes et uniques dans l'architecture de communication afin d'éviter les conflits entre les relations.

**Recommandation générale**

Pour les applications distribuées nécessitant une communication fiable, il est recommandé de compléter register() par des mécanismes applicatifs de surveillance des connexions, de gestion des délais d'attente et de reconnexion automatique.

Ces fonctionnalités ne sont pas directement fournies par l'implémentation actuelle de TelepathyMQ.
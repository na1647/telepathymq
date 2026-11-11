# Connecting to a Remote Node with register()

TelepathyMQ provides a mechanism that allows a node to establish a connection with another remote node.

The register() method allows a TelepathyMQ instance to connect to a remote server using its identity and a connection address.

It is the entry point for outgoing connections and provides the following capabilities:

- Establishing a connection with a remote node.
- Associating a connection with a remote identity.
- Supporting TCP and TLS connections.
- Registering the relationship with the remote node.
- Detecting connection establishment and closure.
- Exchanging events with the remote node.
- Executing deferred operations (defer()).

The method relies on TelepathyMQ's internal socket module, which handles network connections.

1. Overview

A node establishes a connection with a remote server using:

```javascript
client.register('server', 'tcp://127.0.0.1:8060');
```

Two main pieces of information are required:

- The identity of the remote node.
- The connection address of the remote server.

When the connection is established, TelepathyMQ sends a register message containing the local node's identity.

The remote server can then identify the node that has just connected.

Once the connection is established, TelepathyMQ stores the relationship in this.relations and emits a public register event.

The client can then communicate with the server using the emit() and defer() methods.

2. Method signature

**Signature**

```javascript
node.register(identity, connectString, options, cb)
```

**Parameter**	**Type**	**Description**
identity	String	Identity of the remote node to connect to
connectString	Number / String	Network port or connection string of the remote server
options	Object	TLS configuration options. Optional parameter.
cb	Function	Callback invoked when connection registration is completed

The options and cb parameters are optional.

When the third argument is a function, it is automatically interpreted as the callback.

**Using a connection string**

```javascript
client.register(
  'server',
  'tcp://127.0.0.1:8060',
  callback
);
```

In this configuration:

- identity specifies the identity of the remote server.
- connectString contains the connection address.
- callback is invoked when registration is completed.

**Using a port**

```javascript
client.register('server', 8060, callback);
```

In this configuration:

- identity specifies the identity of the remote server.
- connectString specifies the network port.
- The socket module uses 0.0.0.0 as the connection address in this internal call.

**Using TLS**

To establish a TLS connection, provide a connection string starting with tls together with the corresponding TLS options.

```javascript
client.register(
  'server',
  'tls://127.0.0.1:8060',
  tlsOptions,
  callback
);
```

In this configuration:

- identity specifies the identity of the remote server.
- connectString contains the TLS server address.
- tlsOptions contains the TLS configuration parameters.

TelepathyMQ passes these options to the internal socket using:

```javascript
sock.set('tls', options);
```

3. Parameter handling

The register() method supports several calling conventions.

When the third argument is a function, it is treated as the callback:

```javascript
if (typeof options === 'function') {
  cb = options;
  options = null;
}
```

If no callback is provided, TelepathyMQ uses an empty function:

```javascript
cb = cb || (() => {});
```

This allows register() to be called without always having to provide a callback.

4. Establishing the connection

The register() method creates a new socket instance:

```javascript
const Socket = createSocket(this.debug);
const sock = new Socket();
```

It then configures the local node identity:

```javascript
sock.set('identity', this.identity);
```

This identity will be transmitted to the remote server during registration.

The socket module then builds the following data:

```javascript
const data = {
  identity: this.get('identity')
};
```

When the connection is established, the socket prepares a register message.

```javascript
const args = ['register', data];
const id = this.id();

this.callbacks[id] = callback || (() => {});

args.push(id);
```

The message contains:

- The register command name.
- The data containing the local node identity.
- An internal identifier used to retrieve the associated callback.

If the socket is connected and writable, the message is transmitted immediately.

Otherwise, the message is placed in the internal queue using enqueue().

5. Handling different connection types

The socket module supports two types of parameters for establishing a connection.

**Connecting using a port**

When the host parameter is a number, the module uses:

```javascript
this.connect(identity, host, '0.0.0.0', onConnect);
```

The supplied number is interpreted as a network port.

**Connecting using a connection string**

When the host parameter is a string, the module uses:

```javascript
this.connect(identity, host, onConnect);
```

The connection string is passed directly to the internal connect() method.

**Invalid parameter**

If the host parameter is neither a number nor a string, the module throws an exception:

```javascript
throw new Error('invalid host parameter');
```

A valid port or connection string must therefore be provided.

6. Registration confirmation

When the remote server accepts the connection and registration is completed, TelepathyMQ updates its internal relationships.

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

Two main operations are performed:

The relationship with the remote node is stored in this.relations.
A public register event is emitted.

The callback provided to register() is then executed.

The application can listen for the register event:

```javascript
client.on('register', identity => {
  console.log('Connected to:', identity);
});
```

This event allows the application to detect that a remote node has been registered and that its relationship is available.

**Important**

The register event emitted by the TelepathyMQ instance only provides the remote identity.

It should not be confused with the internal socket event, which also provides an emitter object.

7. Handling disconnections

TelepathyMQ also listens for the internal socket close event.

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

When a connection is closed:

The corresponding relationship is set to null.
The public unregister event is emitted.

The application can listen for this event:

```javascript
client.on('unregister', identity => {
  console.log('Disconnected from:', identity);
});
```

This allows applications to monitor the state of connections with remote nodes.

**Important**

The relationship is not removed from this.relations. Its value is simply replaced with null.

The register() method does not explicitly implement an automatic reconnection mechanism in the provided code.

8. Exchanging events and deferred operations

Once the connection has been registered, TelepathyMQ can communicate with the remote node.

Two mechanisms are available.

Standard events with emit()

The emit() method sends an event without waiting for a result.

```javascript
client.emit('server', 'message', {
  text: 'Hello from client'
});
```

The server can receive this event:

```javascript
server.on('message', data => {
  console.log('Message received:', data);
});
```

Deferred operations with defer()

The defer() method allows a remote request to be executed and its result to be received.

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

The server processes the request:

```javascript
server.on('calculate', (defer, data) => {
  const result = data.a + data.b;

  defer.resolve({ result });
});
```

For more details, refer to the emit() and defer() documentation.

9. Complete example

The following example shows how to establish a connection between two TelepathyMQ instances and exchange events as well as deferred operations.

***Server***

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

***Client***

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

In this example:

- The server starts listening on port 8060.
- The client initializes a connection to the server.
- The client sends its identity to the server.
- The server registers the relationship with the client.
- The client receives the register event.
- The client sends a standard message event.
- The client starts a deferred operation using defer().
- The server processes the request and returns the result.

10. Error handling

The register() method has several behaviors that should be taken into account.

**Invalid host parameter**

If the connection parameter is neither a number nor a string, an exception is thrown:

```javascript
throw new Error('invalid host parameter');
```

**Attempting to register after bind()**

The socket module does not allow register() to be called when the socket is already being used as a server.

In this case, an exception is thrown:

```javascript
throw new Error('cannot register() after bind()');
```

**Connection errors**

In the provided socket.register() implementation, the internal onConnect callback checks for connection errors:

```javascript
const onConnect = (err, sock) => {
  if (err) {
    return;
  }

  // Continue registration
};
```

If an error occurs during connection establishment, the function returns immediately.

**Important**

In the current implementation, this error is not passed to the public register() callback.

The public callback is associated with registration confirmation, not directly with the outcome of the connection attempt.

Therefore, this callback must not be considered a general connection error handler.

11. Best practices

- Provide an explicit identity when creating the local node.
- Use the exact remote server identity when calling register().
- Provide a valid connection string or network port.
- Listen for the register event to detect when a relationship has been established.
- Listen for the unregister event to detect disconnections.
- Use TLS when communications require a secure connection.
- Check whether a relationship is available before sending events or deferred operations.
- Use emit() for communications that do not require a response.
- Use defer() for requests requiring a result or progress notifications.
- Do not treat the register() callback as a connection error handler.
- Implement an application-level connection monitoring and reconnection strategy when necessary.

12. API summary

**Method / Event**	**Purpose**	**Side**
node.register()	Establishes a connection with a remote node	Client node
register	Signals that a remote node has been registered	Client / Server node
unregister	Signals that a connection has been closed	Client / Server node
node.emit()	Sends a standard event	Sending node
node.defer()	Starts a remote operation	Requesting node
defer.notify()	Sends an intermediate notification	Receiving node
defer.resolve()	Completes an operation successfully	Receiving node
defer.reject()	Rejects an operation	Receiving node
node.close()	Closes open sockets	Local node

13. Important considerations

**Connection error handling**

In the current implementation, errors encountered while establishing a connection are not passed to the public register() callback.

The callback is only invoked when the connection registration is confirmed.

As a result:

- The callback must not be considered a general connection error handler.
- A connection error may interrupt the process without invoking the public callback.
- Applications should implement an additional mechanism to detect unsuccessful connection attempts.

**No automatic reconnection**

When a remote node disconnects, TelepathyMQ sets the corresponding relationship to null and emits an unregister event.

However, the current implementation does not automatically attempt to establish a new connection.

As a result:

- Events sent to that node can no longer be delivered normally.
- New defer() operations targeting that node are immediately rejected.
- Applications requiring continuous availability must implement their own reconnection strategy.

**Connection state monitoring**

Applications are advised to systematically listen for the register and unregister events to monitor the state of their relationships with remote nodes.

Example:

```javascript
client.on('register', identity => {
  console.log('Connected to:', identity);
});

client.on('unregister', identity => {
  console.log('Disconnected from:', identity);
});
```

**Timeout handling**

The register() method does not provide a built-in timeout mechanism for connection attempts.

Applications requiring guaranteed connection deadlines must implement their own timeout strategy.

**Identity management**

Each connection is associated with a remote identity used as a key in this.relations.

It is therefore important to use consistent and unique identities throughout the communication architecture to avoid conflicts between relationships.

**General recommendation**

For distributed applications requiring reliable communication, it is recommended to complement register() with application-level connection monitoring, timeout handling, and automatic reconnection mechanisms.

These features are not directly provided by the current implementation of TelepathyMQ.
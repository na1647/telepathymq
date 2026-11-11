# Listening for Incoming Connections with listen()

TelepathyMQ provides a mechanism that allows a node to start a server and accept incoming connections from other nodes.

The listen() method allows a node to listen on a network port so that other TelepathyMQ instances can connect to it.

It is the entry point for node-to-node communication and provides the following capabilities:

- Accepting incoming connections.
- Identifying connecting nodes.
- Maintaining relationships with remote nodes.
- Detecting connections and disconnections.
- Receiving and dispatching remote events.
- Supporting deferred operations (defer()).

The method relies on TelepathyMQ's internal socket module, which handles network communication.

1. Overview

A node starts listening for incoming connections using:

```
server.listen(8060, () => {
  console.log('Server listening on port 8060');
});
```

When another node connects, TelepathyMQ establishes a relationship with that node and emits a register event.

The server node can then communicate with the remote node using the emit() and defer() methods.

The listen() method also supports network addresses and TLS options.

2. Method signature

**Signature**

```
node.listen(port, host, fn)
```

**Parameter**	**Type**	**Description**
port	Number / String	Network port or connection string used to start listening
host	Object / Function	Network address or TLS configuration, depending on the connection mode
fn	Function	Callback invoked when the listening operation has completed

The host and fn parameters depend on the selected usage mode.

**Using a port**

```
server.listen(8060, callback);
```

In this configuration:

- port specifies the network port.
- host receives the callback.
- The callback is passed to the socket's bind() method.

**Using a port and an address**

```
server.listen(8060, '127.0.0.1', callback);
```

In this configuration:

- port specifies the network port.
- host specifies the listening address.
- fn is the listening callback.

**Using TLS**

When the first argument is a string starting with tls and the second argument is an object, TelepathyMQ enables TLS configuration.

```
server.listen('tls://0.0.0.0:8060', tlsOptions, callback);
```

In this configuration:

- The first argument contains the TLS connection string.
- The second argument contains the TLS options.
- The third argument is the listening callback.

The TLS options are passed to the internal socket using sock.set('tls', host).

3. Return value

The method returns the socket object created to handle incoming connections.

```
const socket = server.listen(8060, () => {
  console.log('Server listening');
});
```

This object is also stored in the internal this.socks array.

This allows TelepathyMQ to keep track of created sockets and close them later using close().

Each call to listen() creates a new socket instance.

Therefore, multiple listening endpoints can be started within a single TelepathyMQ instance.

4. Handling incoming connections

When a remote node connects, the internal socket emits a register event.

TelepathyMQ intercepts this event and registers the relationship with the remote node.

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

Two pieces of information are available:

**Argument**	**Description**
identity	Identity of the remote node
emitter	Object used to communicate with the remote node

The relationship is stored in this.relations, using the remote identity as the key.

TelepathyMQ then emits a public register event.

The application can listen for this event:

```
server.on('register', (identity, emitter) => {
  console.log('Node registered:', identity);
});
```

This event allows the application to detect when a new node connects.

5. Handling disconnections

When a remote node disconnects, the internal socket emits a socket close event.

TelepathyMQ intercepts this event:

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

The corresponding relationship is then set to null.

TelepathyMQ subsequently emits a public unregister event.

The application can listen for this event:

```
server.on('unregister', identity => {
  console.log('Node unregistered:', identity);
});
```

This event allows the application to detect when a remote node disconnects.

**Important**

The relationship is not removed from the relations object. Its value is simply replaced with null.

6. Receiving and dispatching events

When a message arrives on a socket, TelepathyMQ forwards it to its internal handlers:

```
sock.on('message', (task, event, emitter) => {
  deferHandler(this, task, event, emitter);
  eventHandler(this, task, event);
});
```

Two mechanisms are used:

- deferHandler() processes messages associated with deferred operations.
- eventHandler() processes standard events.

For standard events, TelepathyMQ uses:

```
EventEmitter.prototype.emit.call(
  self,
  event.name,
  event.data
);
```

The received event is therefore dispatched to the handlers registered on the TelepathyMQ instance.

For example:

```
server.on('message', data => {
  console.log('Message received:', data);
});
```

A remote event named message will trigger this handler.

Standard events are dispatched with a single argument containing the event data.

7. Using deferred operations

The listen() method also supports receiving operations initiated with defer().

When a deferred request arrives, TelepathyMQ creates an Asynk deferred object and passes it to the corresponding event handler.

Server-side example:

```
server.on('calculate', (defer, data) => {
  const { a, b } = data;

  console.log('Calculation requested');

  const result = a + b;

  defer.resolve({ result });
});
```

The handler receives two arguments:

**Argument**	**Description**
defer	Asynk object used to notify, resolve, or reject the operation
data	Data sent by the requesting node

The server node can then use:

- defer.notify() to send an intermediate notification.
- defer.resolve() to complete the operation successfully.
- defer.reject() to report a failure.

For more details, refer to the defer() documentation.

8. Complete example

The following example shows how to start a TelepathyMQ server, accept incoming connections, and process events received from a client.

Server

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

In this example:

- The server starts listening on port 8060.
- The client connects to the server.
- The server receives the register event.
- The client sends a standard message event.
- The server receives and processes this event.
- The client starts a deferred operation using defer().
- The server processes the request and returns the result.

9. Using multiple listening endpoints

Each call to listen() creates a new socket and adds it to the internal socks array.

This makes it possible to start multiple listening endpoints using a single TelepathyMQ instance.

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

The different sockets are stored by TelepathyMQ and can all be closed together using close().

10. Closing connections

The listen() method does not provide a dedicated closing method.

To close the sockets created by TelepathyMQ, use the close() method.

```
server.close(error => {
  if (error) {
    console.error('Error closing sockets:', error);
    return;
  }

  console.log('All sockets closed');
});
```

The close() method:

- Iterates through the sockets stored in this.socks.
- Requests the closure of each socket.
- Waits for all closing operations to complete.
- Calls the callback with the first error encountered, if any.

The closing process uses Promise.allSettled(), allowing all closing attempts to complete even if one or more of them fail.

11. Best practices
- Start the server before allowing clients to connect.
- Always provide a callback when the application needs to detect when the listening operation has completed.
- Listen for register and unregister events to monitor connection states.
- Verify the identity of remote nodes before assigning them sensitive operations.
- Use TLS when communications require a secure connection.
- Use defer() for remote operations that require a result or progress notifications.
- Use emit() for standard events that do not require a response.
- Use close() to properly close sockets when the server needs to shut down.
- Avoid creating unnecessary listening endpoints.

12. API summary

**Method / Event**	**Purpose**	**Side**
node.listen()	Starts listening for incoming connections	Server node
register	Signals that a remote node has connected	Server node
unregister	Signals that a remote node has disconnected	Server node
message	Receives a message from a remote node	Server node
defer.notify()	Sends an intermediate notification	Receiving node
defer.resolve()	Completes an operation successfully	Receiving node
defer.reject()	Rejects an operation	Receiving node
node.close()	Closes open sockets	Server node

# Listening for Local Events and Incoming Messages with on()

TelepathyMQ uses the native Node.js event system to allow applications to listen for and process events.

The on() method is inherited from the Node.js EventEmitter class, which Telepathymq extends.

It allows applications to register event handlers that are executed whenever a matching event is emitted on the instance.

In TelepathyMQ, this mechanism is used to:

- Listen for TelepathyMQ system events.
- Receive events transmitted by remote nodes.
- Process incoming messages.
- React to node connections and disconnections.
- Organize event-driven communication between different parts of an application.

The on() method is therefore one of the fundamental components of TelepathyMQ's event-based communication system.

1. Overview

The on() method registers an event handler associated with an event name.

Example

```javascript
node.on('message', data => {
  console.log('Message received:', data);
});
```

In this example:

- message is the name of the event being monitored.
- The function represents the handler executed when the event is emitted.
- data contains the data transmitted with the event.

Whenever a matching event is emitted, the corresponding handler is automatically executed.

In TelepathyMQ, events can originate from:

The internal operation of a TelepathyMQ instance.
Another connected node.
Internal communication mechanisms.

The on() method relies on the native Node.js EventEmitter system.

2. Method signature

**Signature**

```javascript
node.on(eventName, listener)
```

Parameter	Type	Description
eventName	String	Name of the event to listen for
listener	Function	Function called when the event is emitted

The method returns the EventEmitter instance, allowing multiple calls to be chained.

**Example**

```javascript
node
  .on('message', data => {
    console.log('Message:', data);
  })
  .on('notification', data => {
    console.log('Notification:', data);
  });
```

3. Listening for local events

The on() method allows applications to listen for events emitted directly on a TelepathyMQ instance.

These events can be used to organize the different components of an application.

**Example**

```javascript
node.on('task.completed', data => {
  console.log('Task completed:', data);
});
```

Whenever a task.completed event is emitted on the instance, the corresponding handler is executed.

**Important**

TelepathyMQ overrides the public emit() method to send events to remote nodes.

Therefore, the following call does not represent a standard local event emission:

```javascript
node.emit('task.completed', data);
```

The method interprets the first argument as a remote node identity.

To explicitly trigger a local event using the native Node.js mechanism, you can use:

```javascript
const EventEmitter = require('node:events');

EventEmitter.prototype.emit.call(
  node,
  'task.completed',
  data
);
```

This distinction is important to avoid confusion between local and remote communication.

4. Receiving events from a remote node

The on() method is also used to receive events transmitted by other TelepathyMQ nodes.

When a remote node uses emit(), the event is transmitted to the destination and then dispatched locally through its EventEmitter system.

**Server side**

```javascript
const TelepathyMQ = require('telepathymq');

const server = new TelepathyMQ('server');

server.on('message', data => {
  console.log('Message received:', data);
});

server.listen(8060);
```

**Client side**

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

In this example:

- The server starts listening on port 8060.
- The client establishes a connection with the server.
- The client sends a message event.
- The server receives the event.
- The handler registered with on() is executed.

On the server side, the remote event is dispatched as a standard local event through TelepathyMQ's internal mechanism.

5. Receiving data

When an event is emitted, its associated data is passed to the registered handlers.

The first argument of the handler contains the received data.

Example with an object

```javascript
server.on('user.created', user => {
  console.log('New user:', user.username);
  console.log('User ID:', user.id);
});
```

The remote node can send the following data:

```javascript
client.emit('server', 'user.created', {
  id: 123,
  username: 'john',
  email: 'john@example.com'
});
```

The handler directly receives the transmitted object.

Example with multiple arguments

When receiving TelepathyMQ events, the data transmitted through node.emit() is grouped into a single object or value and passed as the first argument to the handler.

This behavior should not be confused with native EventEmitter emissions containing multiple arguments.

6. Listening for TelepathyMQ system events

TelepathyMQ emits several internal events to inform applications about changes in its connections.

The main public events are register and unregister.

**The register event**

The register event is emitted when a remote node is registered.

```javascript
node.on('register', (identity, emitter) => {
  console.log('Node registered:', identity);
});
```

Depending on the context, the arguments may differ:

- On the server side using listen(), the event provides the remote identity and the emitter object.
- On the client side using register(), the event provides only the remote identity.

Applications should therefore avoid assuming that the second argument is always available.

**The unregister event**

The unregister event is emitted when a remote connection is closed.

```javascript
node.on('unregister', identity => {
  console.log('Node disconnected:', identity);
});
```

It allows applications to monitor disconnections and update their internal state.

**Combined example**

```javascript
node.on('register', identity => {
  console.log('Connected to:', identity);
});

node.on('unregister', identity => {
  console.log('Disconnected from:', identity);
});
```

These events make it possible to monitor changes in the connection state of other nodes.

7. Listening for multiple events

A single TelepathyMQ instance can listen for multiple events simultaneously.

Each event can have its own handler.

**Example**

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

Each handler is executed only when its corresponding event is emitted.

It is also possible to register multiple handlers for the same event.

```javascript
node.on('message', data => {
  console.log('Handler 1:', data);
});

node.on('message', data => {
  console.log('Handler 2:', data);
});
```

In this case, both handlers are executed when the event is emitted, in their registration order.

8. Using other EventEmitter methods

Since TelepathyMQ extends EventEmitter, applications can also use the other native event management methods.

Some of the main available methods are:

**Method**	**Description**
on()	Registers an event handler
addListener()	Alias for on()
once()	Registers a handler that is executed only once
off()	Removes an event handler
removeListener()	Removes a specific handler
removeAllListeners()	Removes handlers associated with an event or all handlers
listeners()	Returns the registered handlers for an event
listenerCount()	Returns the number of registered handlers

**Using once()**

The once() method registers a handler that is automatically removed after its first execution.

```javascript
node.once('ready', () => {
  console.log('Node is ready');
});
```

This handler will only be triggered once.

**Removing an event handler**

The off() method allows an application to remove a previously registered handler.

```javascript
const handler = data => {
  console.log('Message:', data);
};

node.on('message', handler);

// Later
node.off('message', handler);
```

These features allow applications to precisely control the lifecycle of their event handlers.

9. Complete example

The following example demonstrates how to use on() to listen for system events and receive messages from a remote node.

**Server**

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

In this example:

- The server starts listening on port 8060.
- The server registers several event handlers using on().
- The client establishes a connection with the server.
- The client receives the register event.
- The client sends several events to the server using emit().
- The server receives each event and executes the corresponding handler.
- The register and unregister events allow the application to monitor the connection state.

10. Error handling

The on() method inherits its behavior from the native Node.js EventEmitter implementation.

It does not provide a specific mechanism for handling errors related to remote communication.

**Missing event handler**

If no handler is registered for a given event, the event does not trigger any application-level processing.

However, it can still be dispatched normally by TelepathyMQ's internal event system.

**Exceptions in event handlers**

Event handlers are executed synchronously by EventEmitter.

If a handler throws an exception, the exception may interrupt the current processing and propagate through the call stack.

Applications should therefore protect operations that may cause errors.

```javascript
node.on('message', data => {
  try {
    processMessage(data);
  } catch (error) {
    console.error('Message processing failed:', error);
  }
});
```

**The error event**

Since TelepathyMQ extends EventEmitter, it also inherits the special behavior of the Node.js error event.

When an error event is emitted without a corresponding handler, Node.js throws an exception.

Applications using this event should therefore register an appropriate handler.

```javascript
node.on('error', error => {
  console.error('TelepathyMQ error:', error);
});
```

Important

Registering an error handler does not mean that every connection or communication error will automatically be forwarded to this event.

Only errors explicitly emitted on the instance will be handled by this listener.

11. Best practices

- Use explicit and consistent event names.
- Prefer structured objects when transmitting data.
- Register event handlers before starting communication.
- Listen for register and unregister events to monitor connections.
- Use once() when an event should only be processed once.
- Remove unnecessary handlers using off().
- Avoid accidentally registering the same handler multiple times.
- Protect operations that may throw exceptions.
- Register an error handler when the application uses this event.
- Distinguish system events from application events to avoid naming conflicts.
- Do not confuse on() with a network acknowledgment: listening for an event does not guarantee its delivery.

12. API summary

**Method / Event**	**Purpose**	**Side**
node.on()	Registers an event handler	Local node
node.once()	Registers a handler executed only once	Local node
node.off()	Removes an event handler	Local node
node.emit()	Sends an event to a remote node	Sending node
register	Signals that a remote node has registered	Local node
unregister	Signals that a remote connection has closed	Local node
error	Signals an error explicitly emitted on the instance	Local node
message	Example of an application event received	Receiving node
EventEmitter.prototype.emit()	Triggers a local event using the native mechanism	Local node

13. Important considerations

**Inheritance from EventEmitter**

The on() method is not a TelepathyMQ-specific implementation.

It is directly inherited from the Node.js EventEmitter class.

It therefore retains the characteristics of the native event system, including synchronous handler execution, registration order, and the ability to register multiple handlers for the same event.

**Overriding emit()**

TelepathyMQ overrides the public emit() method to allow events to be sent to remote nodes.

This changes the usual signature and behavior of EventEmitter.emit().

Consequently:

- node.emit(identity, eventName, data) is used to send a remote event.
- node.on(eventName, listener) is still used to listen for events.
- To explicitly trigger a local event using the native mechanism, use EventEmitter.prototype.emit.call().

This distinction is essential to understanding TelepathyMQ's event system.

**Remote and local events**

Events received from a remote node are dispatched locally using the native EventEmitter implementation.

They are therefore handled by the same listeners as local events with matching names.

It is recommended to distinguish system event names from application event names to avoid naming conflicts.

**No delivery guarantee**

Registering a handler with on() does not guarantee that a remote event will be received.

The emit() method does not provide delivery confirmation.

Applications requiring confirmation should implement an acknowledgment mechanism or use defer() when a response is required.

**Managing the lifecycle of event handlers**

Registered handlers remain active until they are removed or automatically removed in the case of once().

In applications involving many events or dynamic connections, it is recommended to explicitly manage the lifecycle of event handlers to avoid unnecessary accumulation.

**General recommendation**

The on() method is the central event-listening mechanism in TelepathyMQ.

It allows applications to build an event-driven architecture in which different components can communicate without being directly dependent on one another.

For correct usage, it is important to distinguish between listening for events with on(), emitting local events through the native EventEmitter mechanism, and sending remote events using TelepathyMQ's emit() method.
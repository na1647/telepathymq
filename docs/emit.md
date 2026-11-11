# Sending an Event to a Remote Node with emit()

TelepathyMQ provides a mechanism that allows a node to send an event to another remote node.

The emit() method allows an application to transmit an event and its associated data to a remote node identified by its identity.

It provides a simple mechanism for asynchronous communication between nodes without requiring a response.

The method supports the following capabilities:

- Sending events to remote nodes.
- Transmitting structured data.
- Identifying the destination node using its identity.
- Dispatching received events to registered event handlers.
- Checking whether a relationship with the destination node is available.

The method relies on the internal communication mechanisms of TelepathyMQ to transmit events between nodes.

1. Overview

A node sends an event to a remote node using:

```javascript
client.emit('server', 'message', {
  text: 'Hello from client'
});
```

Three pieces of information are provided:

- The identity of the destination node.
- The name of the event to trigger.
- The data associated with the event.

On the receiving side, the remote node listens for the corresponding event:

```javascript
server.on('message', data => {
  console.log('Message received:', data);
});
```

When the event arrives, TelepathyMQ dispatches it to the corresponding event handler.

Unlike defer(), the emit() method does not provide a mechanism for receiving a result or intermediate progress notifications.

2. Method signature

**Signature**

```javascript
node.emit(identity, eventName, data)
```

**Parameter**	**Type**	**Description**
identity	String	Identity of the remote node receiving the event
eventName	String	Name of the event to trigger
data	Any	Data transmitted to the remote node

The data parameter can contain any value supported by the underlying communication layer.

Example

```javascript
client.emit('server', 'message', {
  text: 'Hello from client',
  timestamp: Date.now()
});
```

In this example:

- server identifies the destination node.
- message specifies the event name.
- The object contains the data transmitted to the remote node.

3. Return value

The emit() method returns a Boolean indicating whether a relationship with the destination node is currently available.

Two possible values can be returned:

**Return value**	**Description**
true	A relationship with the destination node exists and the event has been submitted for transmission
false	The destination node is not registered or its relationship is unavailable

**Example**

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

A return value of true does not guarantee that the remote node has received or processed the event.

It only indicates that TelepathyMQ found an available relationship and submitted the event to its emitter.

4. Checking the remote relationship

Before sending an event, TelepathyMQ retrieves the relationship associated with the destination identity.

```javascript
const emitter = this.relations[identity];
```

The relationship is stored in the internal relations object when a remote node is successfully registered.

If no relationship is available, the method immediately returns false.

```javascript
if (!emitter) {
  return false;
}
```

This prevents TelepathyMQ from attempting to send an event through an unavailable relationship.

For example:

```javascript
const result = client.emit('server', 'message', {
  text: 'Hello'
});

if (!result) {
  console.error('Unable to send event: server is not registered');
}
```

Applications should check the return value when the availability of the destination node is important.

5. Sending the event

Once the relationship has been found, TelepathyMQ creates an event object:

```javascript
const event = {
  name: eventName,
  data
};
```

This object contains:

- name: the name of the event.
- data: the data associated with the event.

The event is then transmitted through the remote emitter:

```javascript
emitter.emit('event.emit', event);
```

The internal event name event.emit is used by TelepathyMQ to distinguish standard remote events from other communication tasks.

The method finally returns true.

6. Receiving and dispatching the event

On the receiving side, the socket listens for incoming messages.

When a message associated with the event.emit task arrives, TelepathyMQ processes it through its internal eventHandler().

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

The received event is dispatched using the native Node.js EventEmitter implementation.

This means that applications can receive remote events using the standard .on() method.

**Example**

```javascript
server.on('message', data => {
  console.log('Message received:', data);
});
```

The receiving handler receives the transmitted data as its first argument.

The remote event is therefore integrated into the standard event system provided by Node.js.

7. Using structured data

The emit() method accepts an arbitrary data parameter.

Applications can transmit strings, numbers, arrays, or structured objects, provided they are supported by the underlying communication layer.

**Sending an object**

```javascript
client.emit('server', 'user.created', {
  id: 123,
  username: 'john',
  email: 'john@example.com'
});
```

**Receiving the object**

```javascript
server.on('user.created', user => {
  console.log('New user:', user.username);
  console.log('User ID:', user.id);
});
```

**Sending an array**

```javascript
client.emit('server', 'items.updated', [
  'item-1',
  'item-2',
  'item-3'
]);
```

**Receiving the array**

```javascript
server.on('items.updated', items => {
  console.log('Updated items:', items);
});
```

Using structured objects is generally recommended because they make the transmitted data easier to understand and extend.

8. Difference between emit() and defer()

TelepathyMQ provides two complementary mechanisms for remote communication.

The emit() method is intended for sending events without expecting a response.

The defer() method is intended for remote operations that require a result, progress notifications, or an explicit rejection.

**Feature**	**emit()**	**defer()**
Sends data to a remote node	Yes	Yes
Triggers a remote event	Yes	Yes
Returns a result	No	Yes
Supports progress notifications	No	Yes
Supports remote rejection	No	Yes
Returns a Boolean	Yes	No
Supports concurrent operations	Not applicable	Yes

**Using emit()**

```javascript
client.emit('server', 'notification', {
  message: 'A new user has connected'
});
```

**Using defer()**

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

As a general rule:

- Use emit() for notifications, events, and messages that do not require a response.
- Use defer() for requests that require a result or progress tracking.

9. Complete example

The following example demonstrates communication between two independent TelepathyMQ instances using emit().

**Server**

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
**
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

In this example:

- The server starts listening on port 8060.
- The client connects to the server using register().
- The client receives the register event.
- The client sends a message event using emit().
- The server receives and processes the event.
- The client sends another event named user.created.
- The server receives the new event and processes its data.

10. Error handling

The emit() method has a simple error-handling mechanism based on the availability of the remote relationship.

Destination node not registered

If the destination node is not registered, the method returns false.

```javascript
const sent = client.emit('server', 'message', {
  text: 'Hello'
});

if (!sent) {
  console.error('Destination node is not registered');
}
```

This can happen when:

- The client has not yet registered with the remote server.
- The remote node has disconnected.
- The corresponding relationship has been set to null.

**Remote node disconnection**

When a remote node disconnects, TelepathyMQ sets its relationship to null.

Subsequent calls to emit() targeting this node will return false.

Applications should listen for the unregister event to detect this situation.

**No delivery confirmation**

The emit() method does not provide delivery confirmation.

Once the internal emitter has been invoked, the method returns true without waiting for the remote node to receive or process the event.

Applications requiring delivery confirmation or a response should use defer() or implement an application-level acknowledgment mechanism.

11. Best practices

- Use meaningful event names that clearly describe their purpose.
- Prefer structured objects over ambiguous strings.
- Check the Boolean return value when the availability of the destination node matters.
- Listen for register and unregister events to monitor remote connections.
- Use emit() for notifications and messages that do not require a response.
- Use defer() when a remote operation requires a result or progress notifications.
- Avoid assuming that a successful emit() call guarantees remote delivery.
- Implement an acknowledgment mechanism when reliable event delivery is required.
- Validate received data before processing it.
- Keep event names consistent across communicating nodes.

12. API summary

**Method / Event**	**Purpose**	**Side**
node.emit()	Sends an event to a remote node	Sending node
event.emit	Internal task used to transmit standard events	Internal communication layer
node.on()	Registers an event handler	Receiving node
register	Signals that a remote node has connected	Local node
unregister	Signals that a remote node has disconnected	Local node
node.defer()	Starts a remote operation	Requesting node
node.close()	Closes open sockets	Local node

13. Important considerations

**No delivery confirmation**

The emit() method does not guarantee that an event has been received or processed by the remote node.

A return value of true only indicates that a relationship with the destination node was available and that the event was submitted to its emitter.

As a result:

- The remote node may not have processed the event when emit() returns.
- The sender does not receive confirmation of successful delivery.
- The sender cannot determine whether the remote event handler completed successfully.

Applications requiring delivery guarantees should implement an application-level acknowledgment mechanism or use defer() when a response is required.

**No automatic retry mechanism**

The current implementation does not explicitly implement an application-level retry mechanism for standard events sent using emit().

If the destination node is unavailable, emit() returns false.

Applications requiring reliable event transmission should implement their own retry strategy.

**Remote connection monitoring**

The availability of a remote node depends on its relationship being present in this.relations.

When a remote node disconnects, this relationship is set to null.

Applications should listen for the register and unregister events to monitor connection availability.

**Data handling**

The data parameter is transmitted through the internal communication layer.

Applications should use data structures supported by the underlying transport and avoid relying on unsupported or ambiguous values.

**General recommendation**

The emit() method is best suited to asynchronous event notifications and messages that do not require a response.

For operations requiring confirmation, intermediate progress notifications, or a final result, defer() is the recommended mechanism.

These two methods complement each other and provide the foundation for TelepathyMQ's remote communication model.
# Request / Response with defer()

TelepathyMQ provides an asynchronous communication mechanism that allows one node to request a task from another node and receive its result.

## The defer() method supports three types of communication

* Intermediate progress notifications.
* A successful final result.
* A rejection when the operation fails.

This mechanism relies on Asynk, the asynchronous utility library used internally by TelepathyMQ.

1. Overview
The requesting node starts an operation using:


const operation = client.defer(identity, eventName, data);
The remote node receives an event with a deferred object as its first argument:


server.on(eventName, (defer, data) => {
  // Process the request
});
The first argument, defer, controls the operation.

The second argument, data, contains the data sent by the requesting node.

2. Operation lifecycle

A deferred operation generally follows these steps:

- The client calls defer().
- TelepathyMQ generates a unique request identifier.
- The server receives the corresponding event.
- The server processes the request.
- The server may send zero or more progress notifications.
- The server completes the operation using resolve() or reject().
- The client receives the final result or rejection.
- Progress notifications do not complete the operation.

3. Requesting node: defer()

**Signature**

node.defer(identity, eventName, data)

| **Parameter** | **Type** | **Description** |
| --- | --- | --- |
| identity | String | Identity of the remote node |
| eventName | String | Event name to trigger |
| data | Any | Data sent to the remote node. The data parameter is optional |

**Return value**

The method returns an Asynk Promise object that can be used to track the remote operation.

It exposes the following methods:

* progress(callback)
* done(callback)
* fail(callback)

**Example**

```javascript
const operation = client.defer('server', 'calculate', {
  a: 10,
  b: 20
});

operation.progress((data) => {
  console.log('Progress:', data);
});

operation.done((result) => {
  console.log('Result:', result);
});

operation.fail((error) => {
  console.error('Error:', error);
});
```

4. Receiving node: processing the request

The receiving node must listen for the corresponding event.

**Handler signature**

```javascript
node.on(eventName, (defer, data) => {
  // Process the request
});
```

Two arguments are provided:


| **Argument** | **Description** |
| --- | --- |
| defer | Object used to control the deferred operation |
| data | Data sent by the requesting node |
The defer object exposes three main methods.

**defer.notify(data)**

Sends an intermediate notification to the requesting node.

```javascript
defer.notify({
  status: 'processing',
  message: 'Calculation started'
});
```

This method does not complete the operation.

Multiple notifications can be sent while processing the request.

**defer.resolve(data)**

Completes the operation successfully.

```javascript
defer.resolve({
  result: 30
});
```

The provided data is received by the requesting node's done() callback.

**defer.reject(reason)**

Rejects the operation.

```javascript
defer.reject(new Error('Calculation failed'));
```

The provided value is received by the requesting node's fail() callback.

Using an Error object is recommended to provide a meaningful failure reason.

5. Complete example

The following example uses two independent Node.js processes.

**Server**

```javascript
const TelepathyMQ = require('telepathymq');

const server = new TelepathyMQ('server');

server.on('calculate', (defer, data) => {
  const { a, b } = data;

  console.log('Calculation requested');

  defer.notify({
    status: 'started'
  });

  setTimeout(() => {
    if (typeof a !== 'number' || typeof b !== 'number') {
      defer.reject(new Error('Invalid parameters'));
      return;
    }

    const result = a + b;

    defer.resolve({ result });
  }, 2000);
});

server.listen(8060, () => {
  console.log('Server listening on port 8060');
});
```

**Client**

```javascript
const TelepathyMQ = require('telepathymq');

const client = new TelepathyMQ('client');

client.on('register', (identity) => {
  console.log(`Connected to ${identity}`);

  const operation = client.defer('server', 'calculate', {
    a: 10,
    b: 20
  });

  operation.progress((data) => {
    console.log('Progress:', data);
  });

  operation.done((result) => {
    console.log('Result:', result);
  });

  operation.fail((error) => {
    console.error('Operation failed:', error);
  });
});

client.register('server', 'tcp://127.0.0.1:8060');
```

6. Error handling

If the destination node is not registered, defer() immediately rejects the operation with an error indicating that the remote identity is not registered.

Always provide a fail() handler.

```javascript
const operation = client.defer('server', 'calculate', {
  a: 10,
  b: 20
});

operation.done((result) => {
  console.log(result);
});

operation.fail((error) => {
  console.error('Request failed:', error);
});
```

Application-level errors should also be handled by the receiving node.

7. Multiple concurrent operations

TelepathyMQ assigns a UUID to each deferred operation.

This allows multiple requests to run concurrently without mixing their responses.

```javascript
const first = client.defer('server', 'calculate', {
  a: 10,
  b: 20
});

const second = client.defer('server', 'calculate', {
  a: 50,
  b: 30
});

first.done((result) => {
  console.log('First result:', result);
});

second.done((result) => {
  console.log('Second result:', result);
});
```

Each operation has its own lifecycle.

8. Timeouts and disconnections

The defer() method does not provide built-in timeout or cancellation support.

A remote node disconnection does not automatically reject pending operations in the current implementation.

Applications requiring guaranteed response deadlines should implement an application-level timeout strategy and explicitly handle disconnections.

9. Best practices

- Always register both done() and fail() handlers.
- Use notify() to report meaningful processing stages.
- Prefer structured objects over ambiguous strings.
- Use Error objects when rejecting an operation.
- Implement application-level timeouts when necessary.
- Avoid leaving operations pending indefinitely.
- Do not confuse resolve() and done(): the former completes the remote operation, while the latter receives its result on the requesting node.

10. API summary

| **Method** | **Purpose** | **Side** |
| --- | --- | --- |
| identity | String | Identity of the remote node |

		
| node.defer() | Starts a remote operation | Requesting node |
| defer.notify() | Sends a progress notification | Receiving node |
| defer.resolve() | Completes successfully | Receiving node |
| defer.reject() | Rejects the operation | Receiving node |
| promise.progress() | Receives notifications | Requesting node |
| promise.done() | Receives the final result | Requesting node |
| promise.fail() | Receives the rejection | Requesting node |

Back to English documentation · Documentation française

11. Why TelepathyMQ uses Asynk

TelepathyMQ uses Asynk to manage asynchronous remote operations.

Although Node.js provides native Promises, TelepathyMQ requires an additional capability: the ability to send intermediate notifications while an operation is still running.

A standard JavaScript Promise provides two possible final outcomes:

* resolve() for successful completion.
* reject() for failed completion.

However, native Promises do not provide a built-in notification mechanism for intermediate progress updates.

Asynk provides this additional capability through three complementary methods:

* notify() sends an intermediate notification without completing the operation.
* resolve() completes the operation successfully.
* reject() completes the operation with an error.

This allows TelepathyMQ to provide a richer request/response mechanism, particularly useful for long-running operations and distributed processing.

**Example**

```javascript
const operation = client.defer('server', 'process', data);

operation.progress((notification) => {
  console.log('Progress:', notification);
});

operation.done((result) => {
  console.log('Completed:', result);
});

operation.fail((error) => {
  console.error('Failed:', error);
});
```

The notification mechanism is an important part of TelepathyMQ's asynchronous communication model and one of the reasons Asynk is retained as a dependency.

12. Important considerations

**Pending operations when a remote node disconnects**

When a remote node becomes unavailable while a defer() operation is in progress, the requesting node may keep the operation pending indefinitely.

Currently, TelepathyMQ does not automatically reject pending deferred operations when the remote connection is lost.

As a result:

* The done() callback may never be called.
* The fail() callback may never be called.
* The operation may remain pending until the application takes action.

**Recommendation**

Applications should implement their own timeout and connection monitoring mechanisms when operations are expected to complete within a specific time frame.

This behavior is a known limitation of the current implementation and may be addressed in a future version of TelepathyMQ.

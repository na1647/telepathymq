# Closing Managed Connections with close()

TelepathyMQ provides a mechanism for closing the network connections managed by an instance.

The close() method allows an instance to close all open sockets registered by a TelepathyMQ instance, whether they were created using listen() or register().

It provides a centralized mechanism for closing connections and allows applications to retrieve any errors encountered during the process.

The method provides the following capabilities:

- Close all sockets managed by a TelepathyMQ instance.
- Wait for all closing operations to complete.
- Collect any errors encountered during the process.
- Notify the application when the operation has completed through a callback.
- Centralize the closure of both incoming and outgoing connections.

The close() method is therefore the primary mechanism for closing network resources managed by a TelepathyMQ instance.

1. Overview

A TelepathyMQ instance can manage multiple connections simultaneously.

These connections are typically created using the following methods:

- listen(): starts listening for incoming connections.
- register(): establishes a connection with a remote node.

Each created socket is stored in the internal this.socks array.

The close() method iterates over this array and requests the closure of every socket.

**Example**

```javascript
node.close(error => {
  if (error) {
    console.error('Error while closing connections:', error);
    return;
  }

  console.log('All connections closed');
});
```

In this example, the method requests the closure of all connections managed by the instance.

The callback is executed once all closing attempts have completed.

2. Method signature

**Signature**

```javascript
node.close(callback)
```

**Parameter**	**Type**	**Description**
callback	Function	Function called when all closing operations have completed

The callback parameter is optional.

If no callback is provided, TelepathyMQ uses an empty function by default.

**Example without a callback**

```javascript
node.close();
```

**Example with a callback**

```javascript
node.close(error => {
  if (error) {
    console.error('Close failed:', error);
    return;
  }

  console.log('Connections successfully closed');
});
```

The callback receives one argument:

error: the first error encountered during the closing process, or undefined if all operations succeed.

3. Internal operation

The method first checks whether a callback has been provided.

```javascript
cb = cb || (() => {});
```

If no callback is supplied, an empty function is used.

It then iterates over all sockets registered in this.socks.

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

For each socket, a Promise is created to represent its closing operation.

The process works as follows:

- The method calls sock.close().
- The socket callback indicates whether an error occurred.
- If an error occurs, the Promise is rejected.
- If the operation succeeds, the Promise is resolved.

This approach allows multiple closing operations to be handled concurrently.

4. Closing multiple sockets

A TelepathyMQ instance can manage multiple sockets simultaneously.

For example, a single instance can start several listening servers:

```javascript
const TelepathyMQ = require('telepathymq');

const node = new TelepathyMQ('server');

node.listen(8060);
node.listen(8061);
node.listen(8062);
```

Each call to listen() creates a new socket that is added to the this.socks array.

The close() method allows all these sockets to be closed with a single call.

```javascript
node.close(error => {
  if (error) {
    console.error('Unable to close all sockets:', error);
    return;
  }

  console.log('All listening sockets have been closed');
});
```

There is no need to call close() individually on each socket.

The same principle applies to sockets created by register().

5. Handling concurrent operations

The method uses Promise.allSettled() to wait for all closing operations to complete.

```javascript
Promise.allSettled(tasks).then(results => {
  const failed = results.find(
    result => result.status === 'rejected'
  );

  cb(failed ? failed.reason : undefined);
});
```

Unlike Promise.all(), Promise.allSettled() waits until every Promise has settled, whether fulfilled or rejected.

This means that an error encountered while closing one socket does not interrupt the closing attempts for the remaining sockets.

Once all operations have completed, TelepathyMQ searches for the first rejected operation.

If an error is found, it is passed to the callback.

Otherwise, the callback is called with undefined.

**Example**

```javascript
node.close(error => {
  if (error) {
    console.error('At least one socket failed to close:', error);
    return;
  }

  console.log('All sockets closed successfully');
});
```

This approach ensures that the final callback is not called before all closing operations have completed.

6. Error handling

The close() method uses an error-handling mechanism based on socket callbacks and Promises.

**Successful closure**

If all sockets are successfully closed, the callback receives undefined.

```javascript
node.close(error => {
  if (!error) {
    console.log('Shutdown completed successfully');
  }
});
```

**Error during closure**

If a socket encounters an error while closing, its Promise is rejected.

```javascript
sock.close(error => {
  if (error) {
    reject(error);
  } else {
    resolve();
  }
});
```

The error is then retrieved after all operations have settled.

```javascript
const failed = results.find(
  result => result.status === 'rejected'
);
```

If multiple sockets encounter errors, only the first error found in the results array is passed to the callback.

The remaining errors are not exposed through the public close() API.

**Example**

```javascript
node.close(error => {
  if (error) {
    console.error('Shutdown error:', error.message);
    return;
  }

  console.log('Shutdown completed');
});
```

7. Using close() with listen() and register()

The close() method works with sockets created by both of TelepathyMQ's main connection methods.

**Closing sockets created with listen()**

When an instance starts listening for incoming connections:

```javascript
const server = new TelepathyMQ('server');

server.listen(8060);
server.listen(8061);
```

The created sockets are registered in this.socks.

A single call to close() allows all of them to be closed.

```javascript
server.close(error => {
  if (error) {
    console.error(error);
    return;
  }

  console.log('Listening sockets closed');
});
```

**Closing sockets created with register()**

When an instance connects to multiple remote nodes:

```javascript
const client = new TelepathyMQ('client');

client.register('server1', 'tcp://127.0.0.1:8060');
client.register('server2', 'tcp://127.0.0.1:8061');
```

Each created socket is also added to this.socks.

Calling close() therefore requests the closure of all outgoing connections managed by this instance.

```javascript
client.close(error => {
  if (error) {
    console.error(error);
    return;
  }

  console.log('Remote connections closed');
});
```

The method does not distinguish between incoming and outgoing sockets: every socket present in this.socks is included.

8. Return value and callback

Unlike some asynchronous Node.js methods, close() does not return a Promise.

It initiates the closing operations and uses a callback to signal their completion.

**Example**

```javascript
const result = node.close(error => {
  if (error) {
    console.error(error);
  }
});

console.log(result);
```

The return value of close() is undefined.

The operation's result must therefore be retrieved through the callback.

The callback follows the error-first convention:

**Argument**	**Value**	**Meaning**
error	undefined	All closing operations succeeded
error	Error	At least one closing operation failed

**Important**

The callback is executed asynchronously, after Promise.allSettled() has completed.

You should therefore not assume that the sockets have already been closed immediately after calling close().

9. Complete example

The following example demonstrates how to use close() to properly shut down a TelepathyMQ application.

**Server**

```avascript
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

In this example:

- The server starts listening on port 8060.
- The client establishes a connection with the server.
- The client sends a message event.
- Both instances can communicate.
- When a SIGINT signal is received, each instance calls close().
- All sockets managed by the corresponding instance receive a closing request.
- The callback is executed once all closing attempts have completed.

This example illustrates how close() can be used to shut down a Node.js application.

10. Closing without a callback

The callback parameter of close() is optional.

When no callback is provided, TelepathyMQ uses an empty function.

```javascript
node.close();
```

The closing operations are still performed normally.

However, the application has no direct way to determine their outcome.

For applications requiring a controlled shutdown, it is therefore recommended to always provide a callback.

**Recommended example**

```javascript
node.close(error => {
  if (error) {
    console.error('Unable to close connections:', error);
    return;
  }

  console.log('All connections successfully closed');
});
```

11. Best practices

- Call close() when a TelepathyMQ instance no longer needs its connections.
- Always provide a callback when the result of the closing operation matters.
- Check the error passed to the callback.
- Use close() to centrally close sockets created with listen() and register().
- Wait for the callback before considering the closing operation complete.
- Avoid assuming that sockets are closed immediately after calling close().
- Provide a specific strategy for handling pending defer() operations.
- Monitor unregister events to track disconnections.
- Avoid making repeated calls to close() without properly managing the socket lifecycle.
- Implement an appropriate shutdown mechanism for system signals such as SIGINT and SIGTERM.

12. API summary

**Method / Element**	**Purpose**	**Side**
node.close()	Closes all sockets managed by the instance	Local node
sock.close()	Closes an individual socket	Socket layer
this.socks	Contains the sockets managed by the instance	Internal
Promise.allSettled()	Waits for all closing operations to settle	Internal
callback(error)	Signals the completion of closing operations	Local node
listen()	Creates a listening socket	Server node
register()	Creates a remote connection socket	Client node
unregister	Signals that a remote connection has closed	Local node
defer()	Starts a remote operation	Requesting node

Back to French documentation · English documentation

13. Important considerations

**Closing all managed sockets**

The close() method closes all sockets present in this.socks.

It does not distinguish between sockets created with listen() and those created with register().

A single call therefore requests the closure of all connections managed by the instance.

**Waiting for all closing operations**

Using Promise.allSettled() ensures that all operations are allowed to complete, even if one or more closing attempts fail.

This prevents an isolated error from stopping the remaining sockets from receiving their closing requests.

**Only the first error is reported**

When multiple sockets encounter errors, the method only passes the first error found in the results array to the callback.

The other errors are not returned to the application.

If complete visibility into individual errors is required, the implementation could be extended to expose all operation results.

**No Promise is returned**

The close() method does not return a Promise.

It exclusively uses a callback to communicate the result of the operation.

Applications wishing to use async/await must therefore wrap the method in a Promise.

For example:

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

**Pending defer() operations**

Closing sockets does not mean that all pending defer() operations are automatically rejected or completed.

In the current implementation, close() does not iterate over this.defers or reject pending operations.

As a result:

- Some remote operations may remain pending.
- The done() and fail() callbacks may never be executed.
- Applications must implement their own strategy for handling pending operations.

It is recommended to explicitly manage asynchronous operations before closing connections when their results are important.

**The this.socks array is not cleared**

The current implementation iterates over the sockets in this.socks, but does not clear the array after closing them.

References to the sockets therefore remain stored in the instance.

This also means that subsequent calls to close() may attempt to close the same sockets again.

It would be worth considering an implementation improvement to clean up the array after closure, while taking error handling and potential new connections into account.

**Remote relations are not reset**

The close() method does not clear the this.relations object either.

It does not explicitly set all relations to null or remove their entries.

The management of relation states after closure therefore depends on the events and behavior of the socket layer.

Applications should not automatically assume that all relations have been properly reset after calling close().

**No guarantee of complete application shutdown**

The method waits for socket closing callbacks, but does not guarantee that all application-level processing or remote operations have completed.

Applications requiring a fully controlled shutdown must also manage pending tasks, defer() operations, and any external resources.

**General recommendation**

The close() method is the central mechanism for closing network connections managed by TelepathyMQ.

It simplifies instance shutdown by grouping all closing operations into a single method call.

For a clean application shutdown, applications should wait for its callback, handle any errors, and separately manage asynchronous operations that are still in progress.

**Additional implementation recommendations**

After reviewing your code, I see three improvements that could be worth considering for a future version of TelepathyMQ:

- Clear this.socks after closure: avoid unnecessarily retaining references to closed sockets.

- Reset this.relations: avoid retaining relations that no longer correspond to active connections.

- Handle pending defer() operations: explicitly reject operations that can no longer complete because of the connection shutdown.

I would keep the Promise.allSettled() approach, however. It is a good choice because it ensures that all closing attempts are completed, even when one of the sockets encounters an error.
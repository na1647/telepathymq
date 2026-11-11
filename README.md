# TelepathyMQ

## Inter-process communication for Node.js

TelepathyMQ is a Node.js library that enables independent processes to communicate through events and asynchronous operations.

It provides an identity-based communication layer over TCP, TLS and Unix domain sockets.

## Features
Identity-based communication — address remote nodes by their identity.
Event messaging — send and receive JavaScript events between processes.
Deferred operations — perform asynchronous request/response exchanges with progress notifications.
TCP and TLS — communicate over standard or secured network connections.
Unix domain sockets — communicate locally without TCP.
Automatic reconnection — reconnect when a remote connection is interrupted.
MessagePack serialization — exchange structured JavaScript data efficiently.

## Requirements
Node.js >= 20.20.0

## Installation

npm install telepathymq

## Quick start

The following example demonstrates communication between two independent Node.js processes.

1. Start the server

Create server.js:

```javascript
const TelepathyMQ = require('telepathymq');

const server = new TelepathyMQ('server');

server.on('register', (identity) => {
  console.log(`${identity} connected`);
});

server.on('message', (message) => {
  console.log('Received:', message);
});

server.listen(8060, () => {
  console.log('Server listening on port 8060');
});
```

2. Start the client

Create client.js:

```javascript
const TelepathyMQ = require('telepathymq');

const client = new TelepathyMQ('client');

client.on('register', (identity) => {
  console.log(`Connected to ${identity}`);

  client.emit('server', 'message', {
    text: 'Hello from TelepathyMQ!',
    timestamp: Date.now()
  });
});

client.register('server', 'tcp://127.0.0.1:8060');
```

3. Run the example

Open two terminals.

Terminal 1:

node server.js


Terminal 2:

node client.js


The server receives the message sent by the client.

## How it works

Each TelepathyMQ instance has an identity.

For example:
    server identifies the server process.
    client identifies the client process.

Once a connection is established, the two processes can exchange events using their respective identities.

text
+-------------------+       TCP       +-------------------+
|                   |                 |                   |
|     Client        | <-------------> |      Server       |
|                   |                 |                   |
|   identity:       |                 |   identity:       |
|   client          |                 |   server          |
|                   |                 |                   |
|   emit()          |                 |   on()            |
|                   |                 |                   |
+-------------------+                 +-------------------+

## Documentation

Detailed documentation is available in English and French.

### English
Getting Started
Core Concepts
Messaging
Request / Response
TLS Configuration
API Reference
Troubleshooting

### Français
Documentation française
Guide de démarrage

## API overview
Method	                  Description
new TelepathyMQ(identity)	Create a communication node
listen()	                Start listening for incoming connections
register()	              Connect to a remote node
emit()	                  Send an event to a remote node
on()	                    Listen for local events and incoming messages
defer()	                  Start a deferred request/response operation
close()	                  Close managed connections

## License
MIT
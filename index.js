'use strict';

/**
 * Module dependencies.
 */

const createSocket = require('./socket');
const { EventEmitter } = require('node:events');
const { randomUUID } = require('node:crypto');
const asynk = require('asynk');

/**
 * Expose Telepathymq.
 */

class Telepathymq extends EventEmitter {

  constructor(identity, debugFunction) {
    super();

    this.identity = identity;
    this.relations = {};
    this.debug = debugFunction || (() => {});
    this.defers = {};
    this.socks = [];
  }

}

module.exports = Telepathymq;

const deferHandler = (self, task, event, emitter) => {
  switch (task) {
    case 'defer.resolve':
      if (self.defers[event.id]) {
        self.defers[event.id].resolve(event.data);
        delete self.defers[event.id];
      }
      break;

    case 'defer.notify':
      if (self.defers[event.id]) {
        self.defers[event.id].notify(event.data);
      }
      break;

    case 'defer.reject':
      if (self.defers[event.id]) {
        self.defers[event.id].reject(event.data);
        delete self.defers[event.id];
      }
      break;

    case 'defer.new': {
      const defer = asynk.deferred();

      defer.done(data => {
        event.data = data;
        emitter.emit('defer.resolve', event);
      });

      defer.fail(data => {
        event.data = data;
        emitter.emit('defer.reject', event);
      });

      defer.progress(data => {
        event.data = data;
        emitter.emit('defer.notify', event);
      });

      EventEmitter.prototype.emit.call(
        self,
        event.name,
        defer,
        event.data
      );
      break;
    }
  }
};

/*
 * Point important : nous ne remplaçons surtout pas cet appel par self.emit().
 * En effet, Telepathymq pourrait recevoir une redéfinition de emit() destinée
 * à envoyer des messages IPC. Utiliser directement self.emit() risquerait de
 * provoquer une récursion ou de modifier le comportement public.
 * C'est donc une bonne raison de conserver explicitement l'appel à EventEmitter.prototype.emit.
*/
const eventHandler = (self, task, event) => {
  switch (task) {
    case 'event.emit':
      EventEmitter.prototype.emit.call(self, event.name, event.data);
      break;
  }
};

Telepathymq.prototype.listen = function(port, host, fn) {
  const Socket = createSocket(this.debug);
  const sock = new Socket();

  sock.set('identity', this.identity);

  sock.on('register', (identity, emitter) => {
    this.relations[identity] = emitter;

    EventEmitter.prototype.emit.call(
      this,
      'register',
      identity,
      emitter
    );
  });

  sock.on('socket close', identity => {
    this.relations[identity] = null;

    EventEmitter.prototype.emit.call(
      this,
      'unregister',
      identity
    );
  });

  sock.on('message', (task, event, emitter) => {
    deferHandler(this, task, event, emitter);
    eventHandler(this, task, event);
  });

  // Check for TLS protocol.
  if (
    typeof port === 'string' &&
    port.startsWith('tls') &&
    typeof host === 'object'
  ) {
    sock.set('tls', host);
    sock.bind(port, fn);
  } else {
    sock.bind(port, host, fn);
  }

  this.socks.push(sock);

  return sock;
};

Telepathymq.prototype.register = function(identity, connectString, options, cb) {
  if (typeof options === 'function') {
    cb = options;
    options = null;
  }

  cb = cb || (() => {});

  const Socket = createSocket(this.debug);
  const sock = new Socket();

  sock.set('identity', this.identity);

  if (connectString.startsWith('tls') && typeof options === 'object') {
    sock.set('tls', options);
  }

  sock.register(identity, connectString, emitter => {
    this.relations[identity] = emitter;

    EventEmitter.prototype.emit.call(
      this,
      'register',
      identity
    );

    cb();
  });

  sock.on('socket close', identity => {
    this.relations[identity] = null;

    EventEmitter.prototype.emit.call(
      this,
      'unregister',
      identity
    );
  });

  sock.on('message', (task, event, emitter) => {
    deferHandler(this, task, event, emitter);
    eventHandler(this, task, event);
  });

  this.socks.push(sock);
};

Telepathymq.prototype.defer = function(identity, eventName, data) {
  const defer = asynk.deferred();
  const emitter = this.relations[identity];

  if (!emitter) {
    defer.reject(new Error(identity + ' is not registered'));
    return defer;
  }

  const deferId = randomUUID();

  this.defers[deferId] = defer;

  const event = {
    name: eventName,
    id: deferId,
    data
  };

  emitter.emit('defer.new', event);

  return defer.promise();
};

Telepathymq.prototype.emit = function(identity, eventName, data) {
  const emitter = this.relations[identity];

  if (!emitter) {
    return false;
  }

  const event = {
    name: eventName,
    data
  };

  emitter.emit('event.emit', event);

  return true;
};

Telepathymq.prototype.close = function(cb) {
  cb = cb || (() => {});

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

  Promise.allSettled(tasks).then(results => {
    const failed = results.find(
      result => result.status === 'rejected'
    );

    cb(failed ? failed.reason : undefined);
  });
};

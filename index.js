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

var deferHandler = function(self, task, event, emitter) {
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
    case 'defer.new':
      var defer = asynk.deferred();
      defer.done(function(data) {
        event.data = data;
        emitter.emit('defer.resolve', event);
      });
      defer.fail(function(data) {
        event.data = data;
        emitter.emit('defer.reject', event);
      });
      defer.progress(function(data) {
        event.data = data;
        emitter.emit('defer.notify', event);
      });
      EventEmitter.prototype.emit.call(self, event.name, defer, event.data);
      break;
  }
};

var eventHandler = function(self, task, event) {
  switch (task) {
    case 'event.emit':
      EventEmitter.prototype.emit.call(self, event.name, event.data);
      break;
  }
};


Telepathymq.prototype.listen = function(port, host, fn) {
  const self = this;
  const Socket = createSocket(this.debug);
  const sock = new Socket();

  sock.set('identity', this.identity);
  sock.on('register', function(identity, emitter) {
    self.relations[identity] = emitter;
    EventEmitter.prototype.emit.call(self, 'register', identity, emitter);
  });
  sock.on('socket close', function(identity) {
    self.relations[identity] = null;
    EventEmitter.prototype.emit.call(self, 'unregister', identity);
  });
  sock.on('message', function(task, event, emitter) {
    deferHandler(self, task, event, emitter);
    eventHandler(self, task, event, emitter);
  });
  // check for tls protocol
  if (typeof port === 'string' && port.startsWith('tls') && typeof host === 'object') {
    sock.set('tls', host);
    sock.bind(port, fn);
  } else {
    sock.bind(port, host, fn);
  }
  this.socks.push(sock);
  return sock;
};

Telepathymq.prototype.register = function(identity, connectString, options, cb) {
  const self = this;
  if (typeof options === 'function') {
    cb = options;
    options = null;
  }
  cb = cb || new Function();
  const Socket = createSocket(this.debug);
  const sock = new Socket();
  sock.set('identity', this.identity);
  if (connectString.startsWith('tls') && typeof options === 'object') {
    sock.set('tls', options);
  }
  sock.register(identity, connectString, function(emitter) {
    self.relations[identity] = emitter;
    EventEmitter.prototype.emit.call(self, 'register', identity);
    cb();
  });
  sock.on('socket close', function(identity) {
    self.relations[identity] = null;
    EventEmitter.prototype.emit.call(self, 'unregister', identity);
  });
  sock.on('message', function(task, event, emitter) {
    deferHandler(self, task, event, emitter);
    eventHandler(self, task, event, emitter);
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
    data: data
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
    data: data
  };
  emitter.emit('event.emit', event);
  return true;
};

Telepathymq.prototype.close = function(cb) {
  cb = cb || new Function();
  asynk.each(this.socks, function(sock, cb) {
    sock.close(cb);
  }).parallel().asCallback(cb);
};

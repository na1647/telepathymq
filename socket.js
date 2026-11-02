
'use strict';

/**
 * Module dependencies.
 */

const { EventEmitter } = require('node:events');
const { X509Certificate } = require('node:crypto');
const fs = require('node:fs');
const net = require('node:net');
const tls = require('node:tls');

const msgpack = require('msgpack5')();
//const _ = require('lodash');

/**
 * Errors to ignore during connection handling.
 */

const ignoredErrors = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ENETDOWN',
  'EPIPE',
  'ENOENT'
]);

/**
 * Parse TCP and Unix socket addresses.
 */

function parseAddress(address) {
  const parsed = new URL(address);

  if (parsed.protocol === 'unix:') {
    return {
      unix: true,
      path: parsed.pathname
    };
  }

  if (!parsed.port) {
    throw new Error('Invalid socket address: missing port');
  }

  return {
    unix: false,
    port: Number(parsed.port),
    host: parsed.hostname.replace(/^\[|\]$/g, '')
  };
}

/**
 * Restore Buffer instances in decoded MessagePack data.
 */
function restoreBuffers(value) {
  if (Array.isArray(value)) {
    return value.map(restoreBuffers);
  }

  if (value && typeof value === 'object') {
    if (
      value.type === 'Buffer' &&
      Array.isArray(value.data)
    ) {
      return Buffer.from(value.data);
    }

    for (const key of Object.keys(value)) {
      value[key] = restoreBuffers(value[key]);
    }
  }

  return value;
}

/**
 * Expose Socket.
 */

module.exports = function createSocket(debug = () => {}) {

  class Socket extends EventEmitter {

    constructor() {
      super();

      this.server = null;
      this.socks = [];

      this.settings = {
        hwm: Infinity,
        identity: String(process.pid),
        'retry timeout': 100,
        'retry max timeout': 5000
      };

      this.callbacks = {};
      this.identity = this.get('identity');
      this.ids = 0;
      this.queue = [];
      this.retry = null;
      this.connected = false;
      this.closing = false;
      this.reconnectTimers = new Set();

      // Flush queued messages after connection.

      this.on('connect', sock => {
        const messages = this.queue;

        this.queue = [];

        debug('trace', 'flush ' + messages.length + ' messages');

        for (const message of messages) {
          if (sock && sock.writable) {
            sock.write(this.pack(message));
          }
        }

        this.emit('flush', messages);
      });
    }

    /**
     * Get a setting.
     */

    get(key) {
      return this.settings[key];
    }

    /**
     * Set a setting.
     */

    set(key, value) {
      this.settings[key] = value;
      return this;
    }

    /**
     * Enqueue a message.
     */

    enqueue(message) {
      if (this.queue.length >= this.settings.hwm) {
        debug('trace', 'drop');
        this.emit('drop', message);
        return false;
      }

      this.queue.push(message);
      return true;
    }

    /**
     * Generate a message ID.
     */

    id() {
      return this.identity + ':' + this.ids++;
    }

    /**
     * Register a plugin.
     */

    use(plugin) {
      plugin(this);
      return this;
    }

    /**
     * Encode a message.
     */

    pack(args) {
      return msgpack.encode(args).slice();
    }


    /**
     * Close underlying sockets.
     */

    closeSockets(callback) {
      const sockets = [...this.socks];

      if (sockets.length === 0) {
        callback();
        return;
      }

      let remaining = sockets.length;

      const onSocketClose = () => {
        remaining--;

        if (remaining === 0) {
          callback();
        }
      };

      for (const sock of sockets) {
        if (sock.destroyed) {
          this.removeSocket(sock);
          onSocketClose();
          continue;
        }

        sock.once('close', onSocketClose);
        sock.end();
      }
    }

    /**
     * Close the server.
     */

    closeServer(callback) {
      callback = callback || (() => {});

      if (!this.server || !this.server.listening) {
        callback();
        return;
      }

      this.server.close(callback);
    }

    /**
     * Close the socket.
     */

    close(callback) {
      callback = callback || (() => {});

      if (this.closing) {
        callback();
        return this;
      }

      debug('trace', this.type + ' closing');

      this.closing = true;

      for (const timer of this.reconnectTimers) {
        clearTimeout(timer);
      }

      this.reconnectTimers.clear();

      const tasks = [
        new Promise(resolve => {
          this.closeSockets(resolve);
        })
      ];

      if (this.server) {
        tasks.push(
          new Promise((resolve, reject) => {
            this.closeServer(error => {
              if (error) {
                reject(error);
              } else {
                resolve();
              }
            });
          })
        );
      }

      Promise.all(tasks).then(
        () => callback(),
        error => callback(error)
      );

      return this;
    }

    /**
     * Return server address.
     */

    address() {
      if (!this.server) {
        return undefined;
      }

      const address = this.server.address();

      if (!address) {
        return undefined;
      }

      if (typeof address === 'string') {
        return {
          address,
          string: 'unix://' + address
        };
      }

      return {
        ...address,
        string:
          (this.get('tls') ? 'tls://' : 'tcp://') +
          address.address + ':' + address.port
      };
    }

    /**
     * Remove a socket.
     */

    removeSocket(sock) {
      const index = this.socks.indexOf(sock);

      if (index === -1) {
        return;
      }

      debug('trace', this.type + ' remove socket ' + index);

      this.socks.splice(index, 1);
    }

    /**
     * Add a socket and attach its MessagePack decoder.
     */

    addSocket(sock) {
      if (this.socks.includes(sock)) {
        return;
      }

      const index = this.socks.push(sock) - 1;

      debug('trace', this.type + ' add socket ' + index);

      const decoder = msgpack.decoder();

      decoder.on('data', this.onmessage(sock));

      decoder.on('error', error => {
        this.emit('error', error);
      });

      sock.pipe(decoder);
    }

    /**
     * Handle socket errors.
     */

    handleErrors(sock) {
      sock.on('error', error => {
        const errorCode = error.code || error.message;

        debug(
          'error',
          this.type + ' error ' + errorCode
        );

        this.emit('socket error', error);

        this.removeSocket(sock);

        if (!ignoredErrors.has(error.code)) {
          this.emit('error', error);
          return;
        }

        debug('trace', this.type + ' ignored ' + errorCode);

        this.emit('ignored error', error);
      });
    }

    /**
     * Handle incoming MessagePack messages.
     */

    onmessage(sock) {
      return args => {
        const id = args.pop();
        const task = args[0];

        const emitter = {
          sock,

          emit: (...messageArgs) => {
            const callback =
              typeof messageArgs[messageArgs.length - 1] === 'function'
                ? messageArgs.pop()
                : null;

            const messageId = this.id();

            messageArgs[0] = messageArgs[0] || null;
            messageArgs.push(messageId);

            if (sock.writable && !sock.destroyed) {
              sock.write(this.pack(messageArgs), () => {
                if (callback) {
                  callback(true);
                }
              });

              return true;
            }

            debug('trace', 'peer went away');

            if (callback) {
              process.nextTick(callback, false);
            }

            return false;
          }
        };

        if (task === 'register') {
          if (sock.writable && !sock.destroyed) {
            sock.write(this.pack(['registered', id]));
          }

          const data = args[1];

          return this.emit('register', data.identity, emitter);
        }

        if (task === 'registered') {
          const callback = this.callbacks[id];

          if (!callback) {
            debug('error', 'missing callback ' + id);
            return;
          }

          delete this.callbacks[id];

          return callback(emitter);
        }

        /* Remplacer pour supprimer lodash
        const decodedArgs = _.cloneDeepWith(args, entry => {
          if (
            _.isObject(entry) &&
            entry.type === 'Buffer' &&
            Array.isArray(entry.data)
          ) {
            return Buffer.from(entry.data);
          }

          return undefined;
        });
        */
        const decodedArgs = restoreBuffers(args);

        decodedArgs.unshift('message');
        decodedArgs.push(emitter);

        this.emit(...decodedArgs);
      };
    }

    /**
     * Check certificate validity.
     */

    checkCertificateValidity(certificate) {
      try {
        const cert = new X509Certificate(certificate);

        const validFrom = new Date(cert.validFrom);
        const validTo = new Date(cert.validTo);
        const now = new Date();

        if (now < validFrom) {
          debug('error', this.type + ' certificate not yet in effect');

          debug(
            'error',
            this.type + ' certificate will become valid the ' +
            validFrom.toJSON()
          );

          return false;
        }

        if (now >= validTo) {
          debug(
            'error',
            this.type + ' certificate expired the ' + validTo.toJSON()
          );

          return false;
        }

        const daysRemaining =
          (validTo.getTime() - now.getTime()) /
          (1000 * 60 * 60 * 24);

        if (daysRemaining <= 30) {
          debug(
            'warn',
            this.type + ' certificate will soon expire : ' +
            validTo.toJSON()
          );
        }

        return true;

      } catch (error) {
        debug(
          'error',
          this.type + ' invalid certificate: ' + error.message
        );

        return false;
      }
    }


    /**
     * Connect to a remote server.
     */

    connect(identity, port, host, callback) {
      if (this.type === 'server') {
        throw new Error('cannot connect() after bind()');
      }

      if (typeof host === 'function') {
        callback = host;
        host = undefined;
      }

      callback = callback || (() => {});

      let address;

      if (typeof port === 'string') {
        address = parseAddress(port);

        if (address.unix) {
          host = undefined;
          port = address.path;
        } else {
          host = address.host;
          port = address.port;
        }
      } else {
        host = host || '0.0.0.0';
      }

      const maxRetry = this.get('retry max timeout');
      const tlsOptions = this.get('tls');

      this.type = 'client';

      if (this.closing) {
        return this;
      }

      if (tlsOptions && tlsOptions.cert) {
        if (!this.checkCertificateValidity(tlsOptions.cert)) {
          throw new Error('Invalid certificate');
        }
      }

      let sock;
      let connected = false;

      const onConnect = () => {
        if (connected) {
          return;
        }

        if (this.closing || sock.destroyed) {
          sock.destroy();
          return;
        }

        connected = true;

        debug('trace', this.type + ' connect');

        this.connected = true;
        this.retry = this.get('retry timeout');

        this.addSocket(sock);
        this.emit('connect', sock);

        callback(null, sock);
      };

      if (tlsOptions) {
        const options = {
          ...tlsOptions
        };

        if (typeof port === 'string') {
          options.path = port;
        } else {
          options.host = host;
          options.port = port;
        }

        debug('trace', this.type + ' connect attempt');

        sock = tls.connect(options, onConnect);

      } else {
        sock = new net.Socket();

        debug(
          'trace',
          this.type + ' connect attempt ' + host + ':' + port
        );

        if (typeof port === 'string') {
          sock.connect(port);
        } else {
          sock.connect(port, host);
        }

        sock.once('connect', onConnect);
      }

      sock.identity = identity;

      sock.setNoDelay();

      this.handleErrors(sock);

      sock.on('close', () => {
        // Inuitle car nodejs gère naturellement les fin de vie des sockets
        // sock.removeAllListeners();

        if (connected) {
          this.emit('socket close', sock.identity);
        }

        this.connected = false;
        this.removeSocket(sock);

        if (this.closing) {
          this.emit('close');
          return;
        }

        const retry = this.retry || this.get('retry timeout');

        const timer = setTimeout(() => {
          this.reconnectTimers.delete(timer);

          if (this.closing) {
            return;
          }

          debug('trace', this.type + ' attempting reconnect');

          this.emit('reconnect attempt');

          this.connect(identity, port, host, callback);

          this.retry = Math.round(
            Math.min(maxRetry, retry * 1.5)
          );

        }, retry);

        this.reconnectTimers.add(timer);
      });

      return this;
    }

    /**
     * Register with a remote server.
     */


    /**
     * Register with a remote server.
     */

    register(identity, host, callback) {
      const data = {
        identity: this.get('identity')
      };

      if (this.type === 'server') {
        throw new Error('cannot register() after bind()');
      }

      const onConnect = (err, sock) => {
        if (err) {
          return;
        }

        const args = ['register', data];
        const id = this.id();

        this.callbacks[id] = callback || (() => {});

        args.push(id);

        if (sock && sock.writable) {
          sock.write(this.pack(args));
        } else {
          debug('trace', 'no connected peers');
          this.enqueue(args);
        }
      };

      if (typeof host === 'number') {
        this.connect(identity, host, '0.0.0.0', onConnect);
      } else if (typeof host === 'string') {
        this.connect(identity, host, onConnect);
      } else {
        throw new Error('invalid host parameter');
      }
    }


    /**
     * Handle an incoming connection.
     */

    onconnect(sock) {
      const address = sock.remoteAddress + ':' + sock.remotePort;
      const tlsOptions = this.get('tls');

      if (tlsOptions && !sock.authorized) {
        debug(
          'error',
          this.type + ' denied ' + address +
          ' for authorizationError ' + sock.authorizationError
        );
      }

      debug('debug', this.type + ' accept ' + address);

      this.addSocket(sock);
      this.handleErrors(sock);

      this.emit('connect', sock);

      sock.on('close', () => {
        debug('debug', this.type + ' disconnect ' + address);

        this.emit('disconnect', sock.identity);
        this.removeSocket(sock);
      });
    }

    /**
     * Bind to a port and start listening.
     */

    bind(port, host, callback) {
      if (this.type === 'client') {
        throw new Error('cannot bind() after connect()');
      }

      if (typeof host === 'function') {
        callback = host;
        host = undefined;
      }

      let unixSocket = false;

      if (typeof port === 'string') {
        const address = parseAddress(port);

        if (address.unix) {
          host = undefined;
          port = address.path;
          unixSocket = true;
        } else {
          host = address.host;
          port = address.port;
        }
      } else {
        host = host || '0.0.0.0';
      }

      this.type = 'server';

      this.set('host', host);
      this.set('port', port);

      const tlsOptions = this.get('tls');

      if (tlsOptions && tlsOptions.cert) {
        if (!this.checkCertificateValidity(tlsOptions.cert)) {
          throw new Error('Invalid certificate');
        }
      }

      if (tlsOptions) {
        tlsOptions.requestCert = tlsOptions.requestCert !== false;
        tlsOptions.rejectUnauthorized =
          tlsOptions.rejectUnauthorized !== false;

        this.server = tls.createServer(
          tlsOptions,
          this.onconnect.bind(this)
        );
      } else {
        this.server = net.createServer(
          this.onconnect.bind(this)
        );
      }

      debug(
        'trace',
        this.type + ' bind ' + host + ':' + port
      );

      this.server.on('listening', () => {
        this.emit('bind');
      });

      if (unixSocket) {
        this.server.on('error', error => {
          if (error.code !== 'EADDRINUSE') {
            this.emit('error', error);
            return;
          }

          const clientSocket = new net.Socket();

          clientSocket.once('error', clientError => {
            if (clientError.code === 'ECONNREFUSED') {
              fs.unlink(port, unlinkError => {
                if (unlinkError && unlinkError.code !== 'ENOENT') {
                  this.emit('error', unlinkError);
                  return;
                }

                this.server.listen(port, callback);
              });
            } else {
              this.emit('error', clientError);
            }
          });

          clientSocket.connect({ path: port }, () => {
            clientSocket.destroy();
            this.emit('error', error);
          });
        });
      }

      if (unixSocket) {
        this.server.listen(port, callback);
      } else {
        this.server.listen(port, host, callback);
      }

      return this;
    }

    /**
     * Add a CA certificate to the TLS server.
     */

    addCa(ca, callback) {
      const tlsOptions = this.get('tls');

      if (!tlsOptions) {
        throw new Error('no tls options found');
      }

      if (!this.server) {
        throw new Error('server is not initialized');
      }

      tlsOptions.ca = tlsOptions.ca || [];
      tlsOptions.ca.push(ca);

      if (typeof this.server.setSecureContext === 'function') {
        this.server.setSecureContext({
          ...tlsOptions,
          ca: tlsOptions.ca
        });

        if (callback) {
          callback();
        }

        return this;
      }

      this.set('tls', tlsOptions);

      this.server.close(error => {
        if (error) {
          this.emit('error', error);

          if (callback) {
            callback(error);
          }

          return;
        }

        this.bind(
          this.get('port'),
          this.get('host'),
          callback
        );
      });

      return this;
    }

  }

  return Socket;
};


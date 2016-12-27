import Ember from 'ember';
import {
  _ComputedProperty,
  INVOKE,
  _cleanupOnDestroy
} from './utils';

const SUPPORT_WEBWORKER = !!(URL && Blob && Worker);
const DEFAULT_CONCURRENCY = navigator.hardwareConcurrency || 4;

function _balancedChunkify(array, numberOfSubarray) {

  if (numberOfSubarray < 2) {
    return [array];
  }

  const len = array.length;
  const out = [];
  let i = 0;
  let size;

  if (len % numberOfSubarray === 0) {
    size = Math.floor(len / numberOfSubarray);
    while (i < len) {
      out.push(array.slice(i, i += size));
    }
  } else {
    while (i < len) {
      size = Math.ceil((len - i) / numberOfSubarray--);
      out.push(array.slice(i, i += size));
    }
  }

  return out;
}

const _SingleWorker = Ember.Object.extend({
  _fn: null,
  _context: null,
  _worker: null,
  _throttle: 16.6666,
  // Public Properties
  isRunning: false,
  _getWorkerScript() {
    const _throttleValue = this.get('_throttle');
    const throttle = `
      function throttle(func, wait, options) {
        var context, args, result;
        var timeout = null;
        var previous = 0;
        if (!options) {
          options = {};
        }
        var later = function() {
          previous = options.leading === false ? 0 : Date.now();
          timeout = null;
          result = func.apply(context, args);
          if (!timeout) {
            context = args = null;
          }
        };
        return function() {
          var now = Date.now();
          if (!previous && options.leading === false) {
            previous = now;
          }
          var remaining = wait - (now - previous);
          context = this;
          args = arguments;
          if (remaining <= 0 || remaining > wait) {
            if (timeout) {
              clearTimeout(timeout);
              timeout = null;
            }
            previous = now;
            result = func.apply(context, args);
            if (!timeout) {
              context = args = null;
            }
          } else if (!timeout && options.trailing !== false) {
            timeout = setTimeout(later, remaining);
          }
          return result;
        };
      }
    `;
    const contextProxy = `function ContextProxy() {
        this.get = this.getProperties = this.getEach = this.getWithDefault = this.incrementProperty = this.decrementProperty = function () {
          self.postMessage({
            command: 'ABORT_GET'
          });
        };
        this.set = throttle(this._set, ${_throttleValue});
        this.setProperties = throttle(this._setProperties, ${_throttleValue});
      }
      ContextProxy.prototype._setProperties = function(key, value) {
        self.postMessage({
          command: 'SETPROPS',
          params: [key, value]
        });
        return value;
      }
      ContextProxy.prototype._set = function(key, value) {
        self.postMessage({
          command: 'SET',
          params: [key, value]
        });
        return value;
      };
    `;
    return `
      'use strict';
      ${throttle}
      ${contextProxy}
      self.EmberContext = new ContextProxy();
      self.onmessage = function(e) {
        switch (e.data.command) {
          case 'INVOKE':
            var workerResult = (${ this._fn.toString() }).apply(self.EmberContext, e.data.params);
            if (typeof workerResult.then === 'function') {
              workerResult.then(function(asyncResult) {
                self.postMessage({
                  command: 'INVOKE',
                  returns: asyncResult
                });
              });
            } else {
              self.postMessage({
                command: 'INVOKE',
                returns: workerResult
              });
            }
        } 
      };
    `;
  },
  _cleanupWorker() {
    const worker = this.get('_worker');
    if (worker) {
      worker.terminate();
      this.set('_worker', null);
    }
    this.set('isRunning', false);
  },
  run(...args) {
    return new Ember.RSVP.Promise((resolve, reject) => {
      this.set('isRunning', true);
      if (SUPPORT_WEBWORKER) {
        const blob = new Blob([this._getWorkerScript()], {type: 'text/javascript'});
        const url = URL.createObjectURL(blob);
        const worker = new Worker(url);
        const context = this.get('_context');
        this.set('_worker', worker);
        worker.onmessage = (e) => {
          switch (e.data.command) {
            case 'INVOKE':
              resolve(e.data.returns);
              this._cleanupWorker();
              break;
            case 'ABORT_GET':
              Ember.assert('You cannot use `get`, `getProperties`, `getWithDefault`, `getEach`, `incrementProperty` or `decrementProperty` in ember-multithread workers', false);
              break;
            case 'SET':
              const [setKey, setValue] = e.data.params;
              context.set(setKey, setValue);
              break;
            case 'SETPROPS':
              const [setPropsKey, setPropsValue] = e.data.params;
              context.setProperties(setPropsKey, setPropsValue);
              break;
          }
        };
        worker.onerror = (e) => {
          reject(e);
          this._cleanupWorker();
        };
        worker.postMessage({
          command: 'INVOKE',
          params: args
        });
      } else {
        resolve(this._fn(...args));
        this._cleanupWorker();
      }
    });
  },
  cancel() {
    this._cleanupWorker();
  }
});

const _WorkerProperty = Ember.Object.extend({
  _fn: null,
  _context: null,
  init() {
    this._super(...arguments);
    _cleanupOnDestroy(this.get('_context'), this, '_cleanupWorker');
  },
  cancel() {
    this._cleanupWorker();
  },
  _cleanupWorker() {
    // Cancel
  },
  /**
   * Spawn one singleton worker
   * @param args
   * @returns {Ember.RSVP.Promise}
   */
  perform(...args) {
    const _fn = this.get('_fn');
    const _context = this.get('_context');
    return _SingleWorker.create({ _fn, _context }).run(...args);
  },
  /**
   *
   * @param array
   */
  map(array) {
    Ember.assert('You must provide an array to `map` function.', Ember.isArray(array));
  },
  /**
   *
   * @param array
   */
  reduce(array) {
    Ember.assert('You must provide an array to `reduce` function.', Ember.isArray(array));
  },
  [INVOKE](...args) {
    return this.perform(...args);
  }
});

export default function WorkerProperty(...decorators) {
  const workerFn = decorators.pop();
  _ComputedProperty.call(this, function() {
    return _WorkerProperty.create({
      _fn: workerFn,
      _context: this
    });
  });
}

WorkerProperty.prototype = Object.create(_ComputedProperty.prototype);

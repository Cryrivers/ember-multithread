import Ember from 'ember';
import {
  _ComputedProperty,
  INVOKE,
  _cleanupOnDestroy
} from './utils';

const SUPPORT_WEBWORKER = !!(URL && Blob && Worker);
const DEFAULT_CONCURRENCY = navigator.hardwareConcurrency || 4;

function _balancedChunkify(array, numberOfSubarray = DEFAULT_CONCURRENCY) {

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
            break;
          case 'MAP':
          case 'REDUCE':
          case 'FILTER':
            var array = e.data.params[0];
            var arrayFuncResult = array[e.data.command.toLowerCase()](${ this._fn.toString() });
            self.postMessage({
                command: e.data.command,
                returns: arrayFuncResult
            });
            break;
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
  _run(command, ...args) {
    return new Ember.RSVP.Promise((resolve, reject) => {
      this.set('isRunning', true);
      const blob = new Blob([this._getWorkerScript()], {type: 'text/javascript'});
      const url = URL.createObjectURL(blob);
      const worker = new Worker(url);
      const context = this.get('_context');
      this.set('_worker', worker);
      worker.onmessage = (e) => {
        switch (e.data.command) {
          case 'INVOKE':
          case 'MAP':
          case 'REDUCE':
          case 'FILTER':
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
        command,
        params: args
      });
    });
  },
  run(...args) {
    return this._run('INVOKE', ...args);
  },
  map(...args) {
    return this._run('MAP', ...args);
  },
  reduce(...args) {
    return this._run('REDUCE', ...args);
  },
  filter(...args) {
    return this._run('FILTER', ...args);
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
    if (SUPPORT_WEBWORKER) {
      return _SingleWorker.create({_fn, _context}).run(...args);
    } else {
      return Ember.RSVP.resolve(_fn.apply(_context, args));
    }
  },
  _multithreadArrayFunc(array, command, dataNormalizationCallback) {
    const _fn = this.get('_fn');
    const _context = this.get('_context');
    if (SUPPORT_WEBWORKER) {
      return new Ember.RSVP.Promise((resolve, reject) => {
        Ember.assert(`You must provide an array to \`${command}\` function.`, Ember.isArray(array));
        const balancedArrays = _balancedChunkify(array);
        const arrayOfWorkers = [];
        const intermediatePromises = [];
        const intermediateResults = [];
        for (let i = 0; i < balancedArrays.length; i++) {
          arrayOfWorkers[i] = _SingleWorker.create({_fn, _context});
          intermediatePromises[i] = arrayOfWorkers[i][command](balancedArrays[i]).then(result => {
            intermediateResults[i] = result;
          });
        }
        Ember.RSVP.all(intermediatePromises).then(() => {
          // Destroy all workers
          const result = dataNormalizationCallback(intermediateResults);
          for (let i = 0; i < arrayOfWorkers.length; i++) {
            arrayOfWorkers[i].destroy();
          }
          resolve(result);
        }).catch(err => {
          reject(err);
        });
      });
    } else {
      return Ember.RSVP.resolve(array[command](_fn.bind(_context)));
    }
  },
  map(array) {
    return this._multithreadArrayFunc(array, 'map', function(intermediateResults) {
      return intermediateResults.reduce(function(previousValue, currentValue) {
        return previousValue.concat(currentValue);
      });
    });
  },
  reduce(array) {
    const _fn = this.get('_fn').bind(this.get('_context'));
    return this._multithreadArrayFunc(array, 'reduce', function(intermediateResults) {
      return intermediateResults.reduce(_fn);
    });
  },
  filter(array) {
    return this._multithreadArrayFunc(array, 'filter', function(intermediateResults) {
      return intermediateResults.reduce(function(previousValue, currentValue) {
        return previousValue.concat(currentValue);
      });
    });
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

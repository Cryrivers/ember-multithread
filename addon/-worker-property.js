import Ember from 'ember';
import {
  _ComputedProperty,
  INVOKE,
  _cleanupOnDestroy
} from './utils';

const _Worker = Ember.Object.extend({
  _fn: null,
  _context: null,
  // throttle rate 16.6667ms => 60 FPS
  _throttle: 16.66666,
  _getWorkerScript() {
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
        this.set = throttle(this._set, 16.666);
        this.setProperties = throttle(this._setProperties, 16.666);
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
  init() {
    this._super(...arguments);
    _cleanupOnDestroy(this.get('_context'), this, '_cleanupWorker');
  },
  _cleanupWorker() {
    const worker = this.get('_worker');
    if (worker) {
      worker.terminate();
      this.set('_worker', null);
    }
    this.set('isRunning', false);
  },
  // Public Properties
  isRunning: false,
  cancel() {
    this._cleanupWorker();
  },
  /**
   * Spawn one singleton worker
   * @param args
   * @returns {Ember.RSVP.Promise}
   */
  perform(...args) {
    return new Ember.RSVP.Promise((resolve, reject)=> {
      this.set('isRunning', true);
      if (URL && Blob && Worker) {
        const blob = new Blob([this._getWorkerScript()], {type: 'text/javascript'});
        const url = URL.createObjectURL(blob);
        const worker = new Worker(url);
        const context = this.get('_context');
        this.set('_worker', worker);
        worker.onmessage = (e)=> {
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
        worker.onerror = (e)=> {
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
    Ember.assert('You must provide an array to `map` function.', Ember.isArray(array));
  },
  [INVOKE](...args) {
    return this.perform(...args);
  }
});

export default function WorkerProperty(...decorators) {
  const workerFn = decorators.pop();
  _ComputedProperty.call(this, function() {
    return _Worker.create({
      _fn: workerFn,
      _context: this
    });
  });
}

WorkerProperty.prototype = Object.create(_ComputedProperty.prototype);

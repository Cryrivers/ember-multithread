import Ember from 'ember';
import {
  _ComputedProperty,
  INVOKE,
  _cleanupOnDestroy
} from './utils';

const _Worker = Ember.Object.extend({
  _fn: null,
  _context: null,
  _getWorkerScript() {
    const contextProxy = `function ContextProxy() {
        this.contextDict = {};
      }
      ContextProxy.prototype.set = function(key, value) {
        self.postMessage({
          command: 'SET',
          params: [key, value]
        });
        return value;
      };
    `;
    return `
      'use strict';
      ${contextProxy}
      self._emberContext = new ContextProxy();
      self.onmessage = function(e) {
        switch (e.data.command) {
          case 'INVOKE':
            self.postMessage({
              command: 'INVOKE',
              returns: (${ this._fn.toString() }).apply(self._emberContext, e.data.params)
            });
          break;
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
  },
  cancel() {
    this._cleanupWorker();
  },
  perform(...args) {
    return new Ember.RSVP.Promise((resolve, reject)=> {
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
            case 'GET':
              break;
            case 'SET':
              const [setKey, value] = e.data.params;
              context.set(setKey, value);
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
      }
    });
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

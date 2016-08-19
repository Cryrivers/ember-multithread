import Ember from 'ember';

const _ComputedProperty = Ember.__loader.require("ember-metal/computed").ComputedProperty;

const _Worker = Ember.Object.extend({
  _fn: null,
  _context: null,
  _getWorkerScript() {
    const contextProxy = `function ContextProxy() {
        this.contextDict = {};
      }
      ContextProxy.prototype.get = function(key) {
        this.contextDict[key] = {
          resolved: false
        }
        self.postMessage({
          command: 'GET',
          params: [key]
        });
        while(!this.contextDict[key].resolved) {}
        return this.contextDict[key].value;
      };
      ContextProxy.prototype.set = function(key, value) {
        self.postMessage({
          command: 'SET',
          params: [key, value]
        });
        return value;
      };
    `;
    return `${contextProxy}
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
  perform(...args) {
    return new Ember.RSVP.Promise((resolve, reject)=> {
      if (URL && Blob && Worker) {
        const blob = new Blob([this._getWorkerScript()], {type: 'text/javascript'});
        const url = URL.createObjectURL(blob);
        const worker = new Worker(url);

        worker.onmessage = function(e) {
          switch (e.data.command) {
            case 'INVOKE':
              resolve(e.data.returns);
              worker.terminate();
              break;
            case 'GET':
              break;
            case 'SET':
              break;
          }
        };
        worker.onerror = function(e) {
          reject(e);
          worker.terminate();
        };
        worker.postMessage({
          command: 'INVOKE',
          params: args
        });
      } else {
        resolve(this._fn(...args));
      }
    });
  }
});

function WorkerProperty(...decorators) {
  const workerFn = decorators.pop();
  _ComputedProperty.call(this, function() {
    return _Worker.create({
      _fn: workerFn,
      _context: this
    });
  });
}

WorkerProperty.prototype = Object.create(_ComputedProperty.prototype);

export default function(...args) {
  return new WorkerProperty(...args);
}

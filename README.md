# ember-multithread (Still WIP)

[![Build Status][build-status-img]][build-status-link]

Dead-simple multi-threading support for Ember.js applications.

## Installation
`ember-multithread` is an Ember-CLI addon. You can install it via:

```bash
ember install ember-multithread
```

## Usage
### Basic usage of `WorkerProperty`
You can create `WorkerProperty` in your controllers, routes or components.

```js
import Ember from 'ember';
import {worker} from 'ember-multithread';

export default Ember.Controller.extend({
  calculatePi: worker(function(iteration) {
    let pi = 0;
    let n = 1;
    for (let i = 0; i <= iteration; i++) {
      pi = pi + (4 / n) - (4 / (n + 2));
      n = n + 4;
    }
    return pi;
  }),
  actions: {
    calculate() {
      this.get('calculatePi').perform(500000000).then(result=> {
        console.log(result);
      });
    }
  }
});
```
### Set properties in your Ember app
**This may cause race conditions if there are multiple works running simultaneously in one controller.**

TODO

### Synergy with `ember-concurrency`
TODO

### Multi-threaded `map()`, `reduce()` and `filter()`
`ember-multithread` can create the number of `navigator.hardwardConcurrency` or 4 workers to do certain array operations.

**NOTE: The worker function should not have side effects.**

```js
import Ember from 'ember';
import {worker} from 'ember-multithread';

export default Ember.Controller.extend({
  mapTestWorker: worker(function(item) {
    return item + 1;
  }),
  reduceTestWorker: worker(function(previousValue, currentValue) {
    return previousValue + currentValue;
  }),
  filterTestWorker: worker(function(item) {
    return item > 5;
  }),
  actions: {
    mapTest() {
      const array = Array(20000).fill(0);
      this.get('mapTestWorker').map(array).then(result => {
        console.log(result);
      });
    },
    reduceTest() {
      const array = Array(20000).fill(1);
      this.get('reduceTestWorker').reduce(array).then(result => {
        console.log(result);
      });
    },
    filterTest() {
      const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
      this.get('filterTestWorker').filter(array).then(result => {
        console.log(result);
      });
    }
  }
});
```

## Restriction
TODO

## Special Thanks
Thanks ember-concurrency and parallel.js for the inspiration.

[build-status-img]: https://travis-ci.org/Cryrivers/ember-multithread.svg?branch=master
[build-status-link]: https://travis-ci.org/Cryrivers/ember-multithread

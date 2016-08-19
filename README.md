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

### Multi-threaded `map()` and `reduce()`
TODO

## Restriction
TODO

## Special Thanks
Thanks ember-concurrency and parallel.js for the inspiration.

[build-status-img]: https://travis-ci.org/Cryrivers/ember-multithread.svg?branch=master
[build-status-link]: https://travis-ci.org/Cryrivers/ember-multithread

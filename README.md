# ember-multithread

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
export default Ember.Controller.extend({
  pi: 0,
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
      this.get('calculatePi').perform(1000000000).then(result=> {
        console.log(result);
      });
    }
  }
});
```
### `set` or `get` properties in your Ember app
**This may cause race conditions if there are multiple works running simultaneously in one controller.**

TODO

### Synergy with `ember-concurrency`
TODO

### Multi-threaded `map()` and `reduce()`
TODO

## Restriction
TODO

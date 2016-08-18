# ember-multithread
Dead-simple multi-threading support for Ember.js applications.

## Installation
`ember-multithread` is an Ember-CLI addon. You can install it via:

```bash
ember install ember-multithread
```

## Usage
You can create `WorkerProperty` in your controllers, routes or components.

```js
export default Ember.Controller.extend({
  calculatePi: worker(function(iteration) {
    let pi=0;
    let n=1;
    for (let i = 0;i <= c;i++) {
      Pi=Pi+(4/n)-(4/(n+2));
      n=n+4;
    }
    return pi;
  }),
  actions: {
    calculate() {
      this.get('calculatePi').perform(10000000).then(result=> {
        console.log(result);
      });
    }
  }
});
```

## Restriction
TODO

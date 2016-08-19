import Ember from 'ember';
import {worker} from 'ember-multithread';

export default Ember.Controller.extend({
  pi: 0,
  calculatePi: worker(function(iteration) {
    let pi = 0;
    let n = 1;
    for (let i = 0; i <= iteration; i++) {
      pi = pi + (4 / n) - (4 / (n + 2));
      n = n + 4;
      if (i % 100000 === 0) {
        this.set('pi', pi);
      }
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

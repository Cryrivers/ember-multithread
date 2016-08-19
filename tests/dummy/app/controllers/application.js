import Ember from 'ember';
import {worker} from 'ember-multithread';

export default Ember.Controller.extend({
  piString: 'Hey',
  pi: 0,
  calculatePi: worker(function(iteration) {
    let pi = 0;
    let n = 1;
    this.get('x');
    for (let i = 0; i <= iteration; i++) {
      pi = pi + (4 / n) - (4 / (n + 2));
      n = n + 4;
      this.set('pi', pi);
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

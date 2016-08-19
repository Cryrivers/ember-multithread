import Ember from 'ember';
import worker from 'ember-multithread/-worker-property';

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
      debugger;
      this.get('calculatePi').perform(1000000000).then(result=> {
        console.log(result);
      });
    }
  }
});

import Ember from 'ember';
import {worker} from 'ember-multithread';

const ITERATION_COUNT = 500000000;

function _piCalculation(iteration, updateProgress = false) {
  let pi = 0;
  let n = 1;
  for (let i = 0; i <= iteration; i++) {
    pi = pi + (4 / n) - (4 / (n + 2));
    n = n + 4;
    if (updateProgress) {
      this.setProperties({
        pi,
        progress: (i / iteration * 100).toFixed()
      });
    }
  }
  return pi;
}

export default Ember.Controller.extend({
  finialPi: 0,
  pi: 0,
  progress: 0,
  calculatePiWorker: worker(_piCalculation),
  mapTestWorker: worker(function(item) {
    for (let i = 0; i < 100000000000000; i++) {

    }
    return item + 1;
  }),
  reduceTestWorker: worker(function(previousValue, currentValue) {
    for (let i = 0; i < 100000000000000; i++) {

    }
    return previousValue + currentValue;
  }),
  actions: {
    calculateSingleThreaded() {
      this.set('progress', 0);
      const result = _piCalculation.call(this, ITERATION_COUNT);
      this.set('pi', 0);
      this.set('finalPi', result);
    },
    calculate() {
      this.set('progress', 0);
      this.get('calculatePiWorker').perform(ITERATION_COUNT, true).then(result => {
        this.set('pi', 0);
        this.set('finalPi', result);
      });
    },
    mapTest() {
      const array = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      this.get('mapTestWorker').map(array).then(result => {
        console.log(result);
      });
    },
    reduceTest() {
      const array = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
      this.get('reduceTestWorker').reduce(array).then(result => {
        console.log(result);
      });
    }
  }
});

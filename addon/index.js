import WorkerProperty from './-worker-property';

export function worker(...args) {
  return new WorkerProperty(...args);
}

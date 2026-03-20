/**
 * queue.js — Cola de procesamiento con concurrencia controlada.
 * Máximo 3 tareas simultáneas por especificación del proyecto.
 */
export class ProcessingQueue {
  /**
   * @param {number} [concurrency=3]
   */
  constructor(concurrency = 3) {
    this.concurrency = Math.max(1, concurrency);
    this._queue      = [];
    this._running    = 0;
    this._done       = 0;
    this._total      = 0;
    /** @type {((done: number, total: number) => void) | null} */
    this.onProgress  = null;
  }

  /**
   * Añade una tarea a la cola.
   * @param {() => Promise<any>} task
   * @returns {Promise<any>}
   */
  add(task) {
    this._total++;
    return new Promise((resolve, reject) => {
      this._queue.push({ task, resolve, reject });
      this._tick();
    });
  }

  /**
   * Añade múltiples tareas y retorna Promise.allSettled.
   * @param {Array<() => Promise<any>>} tasks
   * @returns {Promise<PromiseSettledResult<any>[]>}
   */
  addAll(tasks) {
    return Promise.allSettled(tasks.map(t => this.add(t)));
  }

  reset() {
    this._queue   = [];
    this._running = 0;
    this._done    = 0;
    this._total   = 0;
  }

  get pending()  { return this._queue.length; }
  get running()  { return this._running; }
  get progress() { return this._total > 0 ? this._done / this._total : 0; }

  _tick() {
    while (this._running < this.concurrency && this._queue.length > 0) {
      const { task, resolve, reject } = this._queue.shift();
      this._running++;
      task()
        .then(resolve, reject)
        .finally(() => {
          this._running--;
          this._done++;
          this.onProgress?.(this._done, this._total);
          this._tick();
        });
    }
  }
}

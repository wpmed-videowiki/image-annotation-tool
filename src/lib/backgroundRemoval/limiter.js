export class LimiterSaturatedError extends Error {
  constructor(message = "too many concurrent requests") {
    super(message);
    this.name = "LimiterSaturatedError";
  }
}

// in-process semaphore: maxConcurrent run, maxQueue wait, the rest are rejected
export const createLimiter = ({ maxConcurrent, maxQueue }) => {
  let active = 0;
  const queue = [];

  const next = () => {
    if (active >= maxConcurrent || queue.length === 0) return;
    active++;
    const { fn, resolve, reject } = queue.shift();
    const release = () => {
      active--;
      next();
    };
    // release before settling so callers observe the freed slot
    Promise.resolve()
      .then(fn)
      .then(
        (value) => {
          release();
          resolve(value);
        },
        (err) => {
          release();
          reject(err);
        }
      );
  };

  return {
    run(fn) {
      if (queue.length >= maxQueue) {
        return Promise.reject(new LimiterSaturatedError());
      }
      return new Promise((resolve, reject) => {
        queue.push({ fn, resolve, reject });
        next();
      });
    },
    stats: () => ({ active, queued: queue.length }),
  };
};

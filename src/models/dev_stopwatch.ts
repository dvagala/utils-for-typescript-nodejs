import { print } from '../utils/misc_utils';

export class DevStopwatch {
  startTime: number;

  constructor() {
    this.startTime = performance.now();
  }

  public printElapsed(message: string = '') {
    print(`Time to compute ${message}, takes: ${this.elapsedMs()} ms`);
  }

  public elapsedMs(): number {
    return Math.round(performance.now() - this.startTime);
  }

  public elapsedS(): number {
    return this.elapsedMs() / 1000;
  }
}

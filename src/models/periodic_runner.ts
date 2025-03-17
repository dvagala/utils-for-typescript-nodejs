import { waitFor } from '../utils/wait_utils';

export class PeriodicRunner {
  // You should always use this object to run the async periodic task! Never you the oldschool:
  //  setInterval(() => {
  //      void fn();
  // }, 3000);
  //
  // The problem is the if the fn is async, and by some chance the execution will be longer then the timeout, you will get a nasty memory leak. Basically the more
  // your program runs the more function calls it spins up, and it will eat up all your memory.

  private canBeRunning = true;
  private currentRunPromise: Promise<void> | null = null;

  constructor(public options: { waitBetweenRunsMs: number }) {}

  public start(runFn: () => Promise<void>) {
    void (async () => {
      while (this.canBeRunning) {
        this.currentRunPromise = runFn();

        await this.currentRunPromise;

        await waitFor(this.options.waitBetweenRunsMs);
      }
    })();
  }

  public async stop(): Promise<void> {
    this.canBeRunning = false;

    await this.currentRunPromise;
  }
}

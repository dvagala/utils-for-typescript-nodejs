import { Mutex } from 'async-mutex';

export class NamedMutexes {
  private listOfMutexes: { [key: string]: Mutex } = {};

  async acquire(options: { key: string }): Promise<void> {
    if (this.listOfMutexes[options.key] == undefined) {
      this.listOfMutexes[options.key] = new Mutex();
    }

    await this.listOfMutexes[options.key].acquire();
  }

  release(options: { key: string }) {
    if (this.listOfMutexes[options.key] != null) {
      this.listOfMutexes[options.key].release();
    }
  }
}

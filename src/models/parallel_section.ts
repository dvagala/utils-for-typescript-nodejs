import { NonFunctionProperties, print, removeFromArray } from '@dvagala/utils';
import { Mutex, Semaphore } from 'async-mutex';

export interface RunnableItem<T> {
  // This is to running the same item twice
  key: string;

  // This is a bit mess. It's here just to retrieve items in queuu, but not all processese needs that. TODO: rethin
  item: T;

  // This is to be able to prevent running items from the same Group at the same time, and rather mix there also items from other Group
  groupKey: string;

  codeToRun: () => Promise<void>;
  onItemAddedToQueue?: () => Promise<void>;
  onItemStartedExecuting?: () => Promise<void>;
}

export class ParallelSection<T> {
  private queue: RunnableItem<T>[] = [];
  private currentlyRunning: RunnableItem<T>[] = [];

  private allItemsExecutionPromises: Promise<void>[] = [];

  private semaphore: Semaphore;
  private mutex: Mutex = new Mutex();

  private queueIsClosed = true;

  private runningItemsHistory: RunnableItem<T>[] = [];

  constructor(public maxConcurency: number, public mixOrderExecutionAcrossGroups: boolean) {
    this.semaphore = new Semaphore(maxConcurency);
  }

  public initializeQueue(): void {
    this.queueIsClosed = false;
  }

  public async waitForAllItemsInQueueExecutedAndCloseQueue(): Promise<void> {
    await Promise.all(this.allItemsExecutionPromises);
    this.queueIsClosed = true;
  }

  public async getEventsInQueueAndCurrentlyRunning(): Promise<T[]> {
    await this.mutex.acquire();
    const items = [...this.queue, ...this.currentlyRunning].map((e) => e.item);
    this.mutex.release();
    return items;
  }

  public addToQueueAndRunLater(itemsToAddToQueue: RunnableItem<T>[]): void {
    if (this.queueIsClosed) {
      print(`Cannot add to queue, because it's already closed. This shouldn't regularely happen`);
      return;
    }

    this.allItemsExecutionPromises.push(
      (async () => {
        await this.mutex.acquire();

        const keysInQueue = this.queue.map((e) => e.key);
        const keysInCurrentlyRunning = this.currentlyRunning.map((e) => e.key);

        itemsToAddToQueue = itemsToAddToQueue
          .removeDuplictes((e) => e.key)
          .filter((e) => !keysInQueue.includes(e.key) && !keysInCurrentlyRunning.includes(e.key));

        if (itemsToAddToQueue.isEmpty()) {
          // No need to add to queue and run, because the given `key` is already there.
          this.mutex.release();
          return;
        }

        this.queue.push(...itemsToAddToQueue);

        for await (const item of itemsToAddToQueue) {
          await item.onItemAddedToQueue?.();
        }
        this.mutex.release();

        for await (let itemToExecute of itemsToAddToQueue) {
          const [_, semaphoreReleaseFn] = await this.semaphore.acquire();

          await this.mutex.acquire();

          itemToExecute = this.mixOrderExecutionAcrossGroups
            ? this.getItemFromGroupThatWasntRunnedRecently(this.queue, this.runningItemsHistory)
            : itemToExecute;
          this.queue = removeFromArray(this.queue, itemToExecute);
          this.currentlyRunning.push(itemToExecute);
          this.runningItemsHistory.push(itemToExecute);
          this.mutex.release();

          try {
            await itemToExecute.onItemStartedExecuting?.();
            await itemToExecute.codeToRun();
          } finally {
            await this.mutex.acquire();
            this.currentlyRunning = removeFromArray(this.currentlyRunning, itemToExecute);
            this.mutex.release();

            semaphoreReleaseFn();
          }
        }
      })()
    );
  }

  private getItemFromGroupThatWasntRunnedRecently(queue: RunnableItem<T>[], runningItemsHistory: RunnableItem<T>[]): RunnableItem<T> {
    // Because we use this queue primary for scraping we want to mix the scraping on Facebook, Meetup, Eventbrite etc. to
    // not overload one Plaform mith million requests. So we always want to execute the scraping on least used Platform.
    // So that's why I added here concept of `groups`.
    //
    // This algorithm is quite complex, but I tested it, and even on huge queues it shows 0ms. So don't worry, it's fine
    // to run this everytime

    const runningItemsHistoryFromRecentToOld = runningItemsHistory
      .map((e, i) => ({
        groupKey: e.groupKey,
        timestamp: i,
      }))
      .reverse();

    const whenWasThisGroupLastRunning: {
      groupKey: string;
      lastRunningTimestamp: number;
    }[] = [];
    const whenWasThisGroupLastRunningDict: { [key: string]: number }[] = [];

    for (const itemThatWasRunning of runningItemsHistoryFromRecentToOld) {
      if (whenWasThisGroupLastRunningDict[itemThatWasRunning.groupKey] == null) {
        whenWasThisGroupLastRunningDict[itemThatWasRunning.groupKey] = itemThatWasRunning.timestamp;
        whenWasThisGroupLastRunning.push({
          groupKey: itemThatWasRunning.groupKey,
          lastRunningTimestamp: itemThatWasRunning.timestamp,
        });
      }
    }

    const groupsRunnedSortedFromVeryOldToRecent = whenWasThisGroupLastRunning.sortFromLowestToHighest((e) => e.lastRunningTimestamp).map((e) => e.groupKey);

    for (const e of queue) {
      if (!groupsRunnedSortedFromVeryOldToRecent.includes(e.groupKey)) {
        // This group was never runned so this is by far the best candidate
        return e;
      }
    }

    for (const oldRunnedGroup of groupsRunnedSortedFromVeryOldToRecent) {
      for (const e of queue) {
        if (e.groupKey == oldRunnedGroup) {
          return e;
        }
      }
    }

    throw new Error(
      `Palellel section failed to find an item to execute that is least present. This typically shouldn't happen! Didn't you forgout to add non null groupKey for this item?`
    );
  }

  static newFromNamed<T>(props: NonFunctionProperties<ParallelSection<T>>): ParallelSection<T> {
    return new ParallelSection(props.maxConcurency, props.mixOrderExecutionAcrossGroups);
  }
}

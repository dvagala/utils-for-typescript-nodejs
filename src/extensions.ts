import { ParallelSection } from './parallel_section';
import { getRandomFromList } from './functions';

export {};

// Not that it seems you cannot make extensions on type Object. The playwright make errors afterwards

declare global {
  interface Array<T> {
    // filter<T, S extends T>(predicate: (value: T, index: number, array: T[]) => value is S, thisArg?: any): S[];
    // filterAsync<S extends T>(predicate: (value: T, index: number, array: T[]) => value is S): Promise<S[]>;
    filterAsync<S extends T>(predicate: (value: T, index: number, array: T[]) => Promise<boolean>): Promise<S[]>;
    // filterAsync(predicate: (value: T, index: number, array: T[]) => Promise<boolean>): Promise<R[]>;

    filterAsyncParallel<S extends T>(predicate: (value: T, index: number, array: T[]) => Promise<boolean>): Promise<S[]>;

    mapAsync<U>(mapFn: (value: T, index: number, array: T[]) => Promise<U>): Promise<U[]>;

    mapAsyncSequential<U>(mapFn: (value: T, index: number, array: T[]) => Promise<U>): Promise<U[]>;

    forEachAsync<U>(callbackfn: (value: T, index: number, array: T[]) => Promise<void>): Promise<void>;

    forEachAsyncSequential<U>(callbackfn: (value: T, index: number, array: T[]) => Promise<void>): Promise<void>;

    forEachAsyncParallelWithLimit<U>(options: { limit: number; fn: (value: T, index: number, array: T[]) => Promise<void> }): Promise<void>;

    isEmpty(): boolean;

    isNotEmpty(): boolean;

    firstWhereOrNull(predicate: (value: T) => boolean): T | null;

    findIndexOrNull(predicate: (value: T) => boolean): number | null;

    firstWhereOrUndefined(predicate: (value: T) => boolean): T | undefined;

    firstWhereOrNullAsync(predicate: (value: T) => Promise<boolean>): Promise<T | null>;

    sortFromLowestToHighest(predicate: (value: T) => number): T[];

    sortFromHighestToLowest(predicate: (value: T) => number): T[];

    getHighestElement(predicate: (value: T) => number): T | null;

    getLowestElement(predicate: (value: T) => number): T | null;

    shuffle(): T[];

    takeEveryNth(n: number): T[];

    predicateIncludes(predicate: (value: T) => boolean): boolean;

    removeDuplictes(keyFunction: (value: T) => string): T[];

    removeDuplictesSlow(comparator: (aValue: T, bValue: T) => boolean): T[];

    allElementsAreTheSame(predicate: (value: T) => any): boolean;

    splitArrayIntoChunks(maxChunkSize: number): T[][];

    removeObjects(objectsToRemove: T[], comparator: (aValue: T, bValue: T) => boolean): void;

    removeWhere(fn: (e: T) => boolean): void;

    getLast(): T | null;
    getFirst(): T | null;

    sumValues(predicate: (value: T) => number): number;

    getRandom(): T;
  }

  interface String {
    isEmpty(): boolean;
    isNotEmpty(): boolean;

    limitToNChars(n: number): string;
    replaceSpecialCharcters(replaceWith: string): string;
    removeNullCharacters(): string;
  }

  interface Date {
    hasTheSameDate(otherDate: Date): boolean;
    getDaysSinceEpoch(): number;
    copyWithTimeTo00Midnight(): Date;
  }

  interface RegExp {
    getMatchInGroup(groupNumber: number, text: string): string | undefined | null;
  }
}

if (!Array.prototype.filterAsync) {
  Array.prototype.filterAsync = async function <T, S extends T>(predicate: (value: T, index: number, array: T[]) => Promise<boolean>): Promise<S[]> {
    let filteredArray: Array<S> = [];

    for (let i = 0; i < this.length; i++) {
      if (await predicate(this[i], i, this)) {
        filteredArray = [...filteredArray, this[i]];
      }
    }

    return filteredArray;
  };
}

if (!Array.prototype.filterAsyncParallel) {
  Array.prototype.filterAsyncParallel = async function <T>(predicate: (value: T, index: number, array: T[]) => Promise<boolean>): Promise<T[]> {
    const results = await Promise.all(
      (this as T[]).map(async (v, i, a): Promise<{ isTrue: boolean; element: T }> => {
        return { isTrue: await predicate(v, i, a), element: v };
      })
    );

    return results.filter((r) => r.isTrue).map((r) => r.element);
  };
}

if (!Array.prototype.forEachAsync) {
  Array.prototype.forEachAsync = async function <T>(callbackfn: (value: T, index: number, array: T[]) => Promise<void>): Promise<void> {
    await Promise.all(
      (this as T[]).map(async (v, i, a): Promise<void> => {
        return await callbackfn(v, i, a);
      })
    );
  };
}

if (!Array.prototype.forEachAsyncSequential) {
  Array.prototype.forEachAsyncSequential = async function <T>(callbackfn: (value: T, index: number, array: T[]) => Promise<void>): Promise<void> {
    const array = this as T[];
    for (let i = 0; i < array.length; i++) {
      await callbackfn(array[i], i, array);
    }
  };
}

if (!Array.prototype.forEachAsyncParallelWithLimit) {
  Array.prototype.forEachAsyncParallelWithLimit = async function <T>(options: {
    limit: number;
    fn: (value: T, index: number, array: T[]) => Promise<void>;
  }): Promise<void> {
    const paralellSection = new ParallelSection(options.limit, false);
    paralellSection.initializeQueue();

    const array = this as T[];
    for (let i = 0; i < array.length; i++) {
      await paralellSection.addToQueueAndRunLater({
        key: i.toString(),
        groupKey: '',
        item: i.toString(),
        codeToRun: async () => {
          await options.fn(array[i], i, array);
        },
      });
    }

    await paralellSection.waitForAllItemsInQueueExecutedAndCloseQueue();
  };
}

if (!Array.prototype.mapAsync) {
  Array.prototype.mapAsync = async function <U, T>(mapFn: (value: T, index: number, array: T[]) => Promise<U>): Promise<U[]> {
    return await Promise.all(
      (this as T[]).map(async (v, i, a): Promise<U> => {
        return await mapFn(v, i, a);
      })
    );
  };
}

if (!Array.prototype.mapAsyncSequential) {
  Array.prototype.mapAsyncSequential = async function <U, T>(mapFn: (value: T, index: number, array: T[]) => Promise<U>): Promise<U[]> {
    const outputArray: U[] = [];

    const array = this as T[];
    for (let i = 0; i < array.length; i++) {
      outputArray.push(await mapFn(array[i], i, array));
    }
    return outputArray;
  };
}

if (!Array.prototype.isEmpty) {
  Array.prototype.isEmpty = function (): boolean {
    return this.length == 0;
  };
}

if (!Array.prototype.isNotEmpty) {
  Array.prototype.isNotEmpty = function (): boolean {
    return this.length > 0;
  };
}

if (!Array.prototype.removeDuplictes) {
  Array.prototype.removeDuplictes = function <T>(keyFunction: (value: T) => string): T[] {
    // This very fast. Much faster than using the list
    return Object.values(
      (this as T[]).reduce((accumulator, current, i) => {
        const key = keyFunction(current);
        if (accumulator[key] == null) {
          accumulator[key] = current;
        }
        return accumulator;
      }, {})
    ).map((value) => {
      return value as T;
    });
  };
}

if (!Array.prototype.removeDuplictesSlow) {
  Array.prototype.removeDuplictesSlow = function <T>(comparator: (aValue: T, bValue: T) => boolean): T[] {
    // Please don't use this too much. The .removeDuplicates is way faster
    return (this as T[]).filter((aValue, index, self) => {
      return (
        index ===
        self.findIndex((bValue) => {
          return comparator(aValue, bValue);
        })
      );
    });
  };
}

if (!Array.prototype.sumValues) {
  Array.prototype.sumValues = function <T>(predicate: (value: T) => number): number {
    let result = 0;
    for (let i = 0; i < this.length; i++) {
      result += predicate(this[i]);
    }

    return result;
  };
}

if (!Array.prototype.predicateIncludes) {
  Array.prototype.predicateIncludes = function <T>(predicate: (value: T) => boolean): boolean {
    for (let i = 0; i < this.length; i++) {
      if (predicate(this[i])) {
        return true;
      }
    }

    return false;
  };
}

if (!Array.prototype.removeObjects) {
  Array.prototype.removeObjects = function removeObjects<T>(objectsToRemove: T[], comparator: (aValue: T, bValue: T) => boolean): void {
    for (const objectToRemove of objectsToRemove) {
      for (let i = 0; i < (this as T[]).length; i++) {
        if (comparator((this as T[])[i], objectToRemove)) {
          (this as T[]).splice(i, 1);
          break;
        }
      }
    }
  };
}

if (!Array.prototype.removeWhere) {
  Array.prototype.removeWhere = function removeWhere<T>(fn: (e: T) => boolean): void {
    for (let i = 0; i < (this as T[]).length; i++) {
      if (fn((this as T[])[i])) {
        (this as T[]).splice(i, 1);
      }
    }
  };
}

if (!Array.prototype.splitArrayIntoChunks) {
  Array.prototype.splitArrayIntoChunks = function splitArrayIntoChunks<T>(maxChunkSize: number): T[][] {
    const chunks: T[][] = [];

    const array = this as T[];

    for (let i = 0; i < array.length; i += maxChunkSize) {
      const chunk = array.slice(i, i + maxChunkSize);
      chunks.push(chunk);
    }

    return chunks;
  };
}

if (!Array.prototype.allElementsAreTheSame) {
  Array.prototype.allElementsAreTheSame = function <T, F>(predicate: (value: T) => F): boolean {
    let lastElementValue: F | undefined = undefined;
    for (let i = 0; i < this.length; i++) {
      const currentElementValue = predicate(this[i]);
      if (i != 0 && currentElementValue != lastElementValue) {
        return false;
      }

      lastElementValue = currentElementValue;
    }

    return true;
  };
}

if (!Array.prototype.getRandom) {
  Array.prototype.getRandom = function <T>(): T {
    if ((this as T[]).isEmpty()) {
      throw new Error('Array is empty');
    }

    return getRandomFromList(this as T[]);
  };
}

if (!Array.prototype.firstWhereOrNull) {
  Array.prototype.firstWhereOrNull = function <T>(predicate: (value: T) => boolean): T | null {
    for (let i = 0; i < this.length; i++) {
      if (predicate(this[i])) {
        return this[i];
      }
    }

    return null;
  };
}

if (!Array.prototype.findIndexOrNull) {
  Array.prototype.findIndexOrNull = function <T>(predicate: (value: T) => boolean): number | null {
    for (let i = 0; i < this.length; i++) {
      if (predicate(this[i])) {
        return i;
      }
    }

    return null;
  };
}

if (!Array.prototype.firstWhereOrUndefined) {
  Array.prototype.firstWhereOrUndefined = function <T>(predicate: (value: T) => boolean): T | undefined {
    for (let i = 0; i < this.length; i++) {
      if (predicate(this[i])) {
        return this[i];
      }
    }

    return undefined;
  };
}

if (!Array.prototype.shuffle) {
  Array.prototype.shuffle = function <T>(): T[] {
    const arr = [...this];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };
}

if (!Array.prototype.takeEveryNth) {
  Array.prototype.takeEveryNth = function <T>(n: number): T[] {
    const arr = [...this];
    const result: T[] = [];
    for (let i = 0; i < arr.length; i++) {
      if (i % n === 0) {
        result.push(arr[i]);
      }
    }
    return result;
  };
}

if (!Array.prototype.sortFromHighestToLowest) {
  Array.prototype.sortFromHighestToLowest = function <T>(predicate: (value: T) => number): T[] {
    return (this as T[]).sort((a, b) => predicate(b) - predicate(a));
  };
}

if (!Array.prototype.sortFromLowestToHighest) {
  Array.prototype.sortFromLowestToHighest = function <T>(predicate: (value: T) => number): T[] {
    return (this as T[]).sort((a, b) => predicate(a) - predicate(b));
  };
}

if (!Array.prototype.getHighestElement) {
  Array.prototype.getHighestElement = function <T>(predicate: (value: T) => number): T | null {
    const arr = this as T[];

    let highestElement: T | null = null;

    for (let i = 0; i < arr.length; i++) {
      if (i == 0) {
        highestElement = arr[i];
      } else {
        if (predicate(arr[i]) > predicate(highestElement as T)) {
          highestElement = arr[i];
        }
      }
    }

    return highestElement;
  };
}

if (!Array.prototype.getLowestElement) {
  Array.prototype.getLowestElement = function <T>(predicate: (value: T) => number): T | null {
    const arr = this as T[];

    let highestElement: T | null = null;

    for (let i = 0; i < arr.length; i++) {
      if (i == 0) {
        highestElement = arr[i];
      } else {
        if (predicate(arr[i]) < predicate(highestElement as T)) {
          highestElement = arr[i];
        }
      }
    }

    return highestElement;
  };
}

if (!Array.prototype.firstWhereOrNullAsync) {
  Array.prototype.firstWhereOrNullAsync = async function <T>(predicate: (value: T) => Promise<boolean>): Promise<T | null> {
    for (let i = 0; i < this.length; i++) {
      if (await predicate(this[i])) {
        return this[i];
      }
    }

    return null;
  };
}

if (!String.prototype.isEmpty) {
  String.prototype.isEmpty = function (): boolean {
    return this.length == 0;
  };
}

if (!String.prototype.isNotEmpty) {
  String.prototype.isNotEmpty = function (): boolean {
    return this.length > 0;
  };
}

if (!String.prototype.limitToNChars) {
  String.prototype.limitToNChars = function (n: number): string {
    return this.length > n ? this.substring(0, n) + '...' : (this as string);
  };
}

if (!String.prototype.removeNullCharacters) {
  String.prototype.removeNullCharacters = function (): string {
    // Taken from here: https://stackoverflow.com/a/22809513/8558193
    return (this as string).replace(/\0/g, '');
  };
}

if (!String.prototype.replaceSpecialCharcters) {
  String.prototype.replaceSpecialCharcters = function (replaceWith: string): string {
    return (this as string).replaceAll(/[`~!@#$%^&*()_|+\-=?;–:'",.…<>{}[\]\\/]/gi, replaceWith);
  };
}

if (!Array.prototype.getLast) {
  Array.prototype.getLast = function <T>(): T | null {
    const last = (this as T[]).at(-1);
    if (last === undefined) {
      return null;
    } else {
      return last;
    }
  };
}

if (!Array.prototype.getFirst) {
  Array.prototype.getFirst = function <T>(): T | null {
    const last = (this as T[]).at(0);
    if (last === undefined) {
      return null;
    } else {
      return last;
    }
  };
}

if (!RegExp.prototype.getMatchInGroup) {
  RegExp.prototype.getMatchInGroup = function (groupNumber: number, text: string): string | undefined | null {
    const match = text.match(this);
    return match?.at(groupNumber);
  };
}

if (!Date.prototype.hasTheSameDate) {
  Date.prototype.hasTheSameDate = function (otherDate: Date): boolean {
    const thisDate = this as Date;
    return thisDate.toDateString() == otherDate.toDateString();
  };
}

if (!Date.prototype.getDaysSinceEpoch) {
  Date.prototype.getDaysSinceEpoch = function (): number {
    const thisDate = this as Date;
    return Math.trunc(thisDate.valueOf() / (1000 * 60 * 60 * 24));
  };
}

if (!Date.prototype.copyWithTimeTo00Midnight) {
  Date.prototype.copyWithTimeTo00Midnight = function (): Date {
    const thisDate = this as Date;
    const thisDateWithoutTime = new Date(thisDate.toUTCString().split('T')[0]);
    thisDateWithoutTime.setUTCDate(thisDateWithoutTime.getUTCDate());
    return thisDateWithoutTime;
  };
}

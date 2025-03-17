import * as path from 'path';
import * as fs from 'fs';
import { DateTime } from 'luxon';
import { distance } from 'fastest-levenshtein';
import { longestCommonSubstring } from 'string-algorithms';
import { Mutex } from 'async-mutex';
import { Agent } from 'http';
import fetch, { RequestInfo, RequestInit, Response } from 'node-fetch';

export interface PrintOptions {
  ignoreTruncation?: boolean;
  withoutNewLine?: boolean;
}

export interface RunWithRetryLogicOptions<T> {
  fn: (attemptNumber: number) => Promise<T>;
  onAttemptFailed: (error: Error, attemptNumber: number, wasLastAttempt: boolean) => Promise<void>;
  onAttemptFinally?: () => Promise<void>;
  onAttemptSucceed?: () => Promise<void>;
  onAllAttemptsFailed: (lastAttemptError: Error, allAttemptsError: Error[]) => Promise<T>;
  onAllAttemptsFinally?: () => Promise<void>;
  maxNumberOfAttemps: number;
}

export interface RandomWaitOptions {
  minMs: number;
  maxMs: number;
}

export interface TraverseJsonAndGetObjectOptions {
  json: any;
  matcher: (parentObject: any, currentChildKey: string) => any;
}

// ----------------------------

export class ErrorWithRetryInfo extends Error {
  constructor(msg: string, public retryInfo: { canRetryRequest: boolean }) {
    super(msg);
    Object.setPrototypeOf(this, ErrorWithRetryInfo.prototype);
  }
}

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

// ----------------------------

type NonFunctionPropertyNames<T> = {
  // eslint-disable-next-line @typescript-eslint/ban-types
  [K in keyof T]: T[K] extends Function ? never : K;
}[keyof T];

export type NonFunctionProperties<T> = Pick<T, NonFunctionPropertyNames<T>>;

// ----------------------------

export function jsonPrettyStringify(obj: any): string {
  return JSON.stringify(obj, null, 2);
}

export async function runWithRetryLogic<T>(options: RunWithRetryLogicOptions<T>): Promise<T> {
  const allAttemptsErrors: Error[] = [];

  for (let i = 1; i <= options.maxNumberOfAttemps; i++) {
    if (i > 1) {
      // Wait exponentially on all the other attempts
      // 0ms, 1300ms, 5200ms, 11700ms, 20800ms etc.
      await waitFor((i - 1) ** 2 * 1300);
      await randomWaitShort();
    }

    try {
      const ret = await options.fn(i);
      await options.onAttemptSucceed?.();
      await options.onAllAttemptsFinally?.();
      return ret;
    } catch (rawError: unknown) {
      const e = rawErrorToError(rawError);

      allAttemptsErrors.push(e);

      const isLastAttempt = i >= options.maxNumberOfAttemps || (e instanceof ErrorWithRetryInfo && !e.retryInfo.canRetryRequest);
      try {
        await options.onAttemptFailed(e, i, isLastAttempt);
      } catch (rawError: unknown) {
        const f = rawErrorToError(rawError);
        print(`Error in onAttemptFailed. ${f.message}, ${f.stack}`);
        break;
      }
      if (isLastAttempt) {
        break;
      }
    } finally {
      await options.onAttemptFinally?.();
    }
  }

  await options.onAllAttemptsFinally?.();

  return await options.onAllAttemptsFailed(allAttemptsErrors.getLast()!, allAttemptsErrors);
}

export function rawErrorToError(rawError: unknown): Error {
  // In typescript you can throw exception of any type. That make it very cumbersome to handle errors, so that's why we want to unify all rawErrors to proper Error objects

  if (rawError instanceof Error) {
    return rawError;
  } else if (typeof rawError === 'string') {
    return new Error(rawError);
  } else {
    return new Error(JSON.stringify(rawError));
  }
}

export function print(message?: any, options?: PrintOptions) {
  // Set cannot be stringified
  if (typeof message == 'object' && !(message instanceof Set)) {
    message = jsonPrettyStringify(message);
  }

  if (options?.withoutNewLine) {
    process.stdout.write(`${message}`);
  } else {
    if (options?.ignoreTruncation) {
      console.dir(message, { maxArrayLength: null });
    } else {
      console.log(message);
    }
  }
}

export async function randomWaitShort(): Promise<void> {
  await randomWait({ minMs: 120, maxMs: 500 });
}

export async function randomWaitMid(): Promise<void> {
  await randomWait({ minMs: 500, maxMs: 3000 });
}

export async function randomWaitLong(): Promise<void> {
  await randomWait({ minMs: 3000, maxMs: 5000 });
}

export async function randomWait(options: RandomWaitOptions = { minMs: 3000, maxMs: 5000 }): Promise<void> {
  // Just to fool scraper blockers
  const randomMs = Math.floor(Math.random() * (options.maxMs - options.minMs + 1) + options.minMs);
  await waitFor(randomMs);
}

export async function waitFor(millisecond: number): Promise<void> {
  if (millisecond <= 0) {
    return;
  } else {
    await new Promise((f) => setTimeout(f, millisecond));
  }
}

export async function waitUntil(dateTime: DateTime): Promise<void> {
  const timeToWaitMs = dateTime.valueOf() - DateTime.now().valueOf();

  if (timeToWaitMs <= 0) {
    return;
  } else {
    await new Promise((f) => setTimeout(f, timeToWaitMs));
  }
}

export async function waitIndefinitely(): Promise<void> {
  await new Promise(() => {});
}

export function deleteDirectorySync(directoryPath: string) {
  if (fs.existsSync(directoryPath)) {
    fs.rmSync(directoryPath, { recursive: true, force: true });
  }
}

export function writeToFileWithAutomaticPathCreation(filePath: string, content: string) {
  createUnderlyingDirectoryIfNotExistis(filePath);

  fs.writeFileSync(filePath, content);
}

export function createUnderlyingDirectoryIfNotExistis(filePath: string) {
  const directoryName = path.dirname(filePath);
  if (!fs.existsSync(directoryName)) {
    fs.mkdirSync(directoryName, { recursive: true });
  }
}

export function clone(obj: any) {
  return JSON.parse(JSON.stringify(obj));
}

export function getRandomFromList<E>(list: E[]): E {
  return list[Math.floor(Math.random() * list.length)];
}

export function getRandomFromListWighted<E>(list: E[], weightOfElement: (e: E) => number): E {
  const weightSum = list.reduce((acc, e) => acc + weightOfElement(e), 0);

  // Need to normalize so that summed weights are always equal to 1. There will be some floating point inaccuracy but don't care
  const weights = list.map((e) => weightOfElement(e) * (1 / weightSum));

  const propabilityMassFuncion: number[] = [];
  for (const e of weights) {
    if (propabilityMassFuncion.isEmpty()) {
      propabilityMassFuncion.push(e);
    } else {
      const lastElement = propabilityMassFuncion.getLast()!;
      propabilityMassFuncion.push(lastElement + e);
    }
  }

  const randomNumber = Math.random();
  // Since the propabilityMassFuncion is non declining, we can only check the upprt bound
  // Due to floating errors theoretically it can happen that last weight is 0.98, but our our random number is 1. So we just take the last element
  const index = propabilityMassFuncion.findIndexOrNull((e) => randomNumber < e) ?? weights.length - 1;

  return list[index];
}

export function safelyAdd(numberA: number | null | undefined, numberB: number): number {
  return (numberA ?? 0) + numberB;
}

export function getRandomFloatFromRange(options: { min: number; max: number }) {
  const difference = options.max - options.min;
  return Math.random() * difference + options.min;
}

export function getRandomIntFromRange(options: { min: number; max: number; seed?: number | null }) {
  const difference = options.max - options.min;
  const random = options.seed != null ? pseudoRandomWithSeed({ seed: options.seed }) : Math.random();
  return Math.floor(random * difference + options.min);
}

export function pseudoRandomWithSeed(options: { seed: number }) {
  // Javascript Math.random() doesn't have a built in seed. So this is a workaround
  // Taken from here https://stackoverflow.com/a/19303725/8558193
  const x = Math.sin(options.seed) * 10000;
  return x - Math.floor(x);
}

export function removeFromArray<T>(array: T[], elementToRemove: T | null): T[] {
  return array.filter((e) => e != elementToRemove);
}

export function removeItemsFromArray<T>(array: T[], elementsToRemove: (T | null)[]): T[] {
  return array.filter((e) => !elementsToRemove.includes(e));
}

export function removeFromArrayByStringifyComparison<T>(array: T[], elementToRemove: T | null): T[] {
  return array.filter((e) => JSON.stringify(e) != JSON.stringify(elementToRemove));
}

export function onlyNotNullValues<T>(value: T | null): value is T {
  if (value === null) {
    return false;
  } else {
    return true;
  }
}

export function areArraysTheSame<T>(array1: T[], array2: T[], predicateToGetComparableValue: (a: T) => any = (e) => e): boolean {
  if (array1.length == array2.length && array1.every((e, i) => predicateToGetComparableValue(e) == predicateToGetComparableValue(array2[i]))) {
    return true;
  } else {
    return false;
  }
}

export function onlyDefinedValues<T>(value: T | undefined): value is T {
  if (value === undefined) {
    return false;
  } else {
    return true;
  }
}

export function removeDuplicates<T>(inputArray: T[]): T[] {
  // rather to use .removeDuplicates because you can specify the predicate
  return [...new Set(inputArray)];
}

export function removeDuplicatesByComparator<T>(objects: T[], comparator: (aValue: T, bValue: T) => boolean): T[] {
  // Please don't use this too much. The .removeDuplicates is way faster
  return objects.filter((aValue, index, self) => {
    return (
      index ===
      self.findIndex((bValue) => {
        return comparator(aValue, bValue);
      })
    );
  });
}

export function parseJsonFile<T>(jsonPath: string): T {
  return JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as T;
}

export function parseJsonFileOrNull<T>(jsonPath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as T;
  } catch {
    return null;
  }
}

export function getLengthOfNested(arr: any[][]): number {
  return arr.flat(Infinity).length;
}

export function getFirstStringThatMatchesRegex(regex: RegExp, strings: string[]): string | null {
  for (let i = 0; i < strings.length; i++) {
    if (regex.test(strings[i])) {
      return strings[i];
    }
  }
  return null;
}

export function subtractArray2FromArrray1<T>(array1: T[], array2: T[]): T[] {
  return array1.filter((x) => !array2.includes(x));
}

export function subtractArray2FromArrray1JSONComparision<T>(array1: T[], array2: T[]): T[] {
  return array1.filter((x) => !array2.some((e) => JSON.stringify(e) == JSON.stringify(x)));
}

export function areStringsSimillar(
  string1: string,
  string2: string,
  options?: {
    threshold?: number;
    ignoreMakceneAndDlzne?: boolean;
    ignoreCase?: boolean;
  }
): boolean {
  const similarity = options?.threshold == null ? 2 : options!.threshold;
  const ignoreMakceneAndDlzne = options?.ignoreMakceneAndDlzne == null ? true : options!.ignoreMakceneAndDlzne;
  const ignoreCase = options?.ignoreCase == null ? true : options!.ignoreCase;

  let normalizedString1 = string1;
  let normalizedString2 = string2;

  if (ignoreCase) {
    normalizedString1 = normalizedString1.toLowerCase();
    normalizedString2 = normalizedString2.toLowerCase();
  }

  if (ignoreMakceneAndDlzne) {
    normalizedString1 = removeDiacriticFromCharacters(normalizedString1);
    normalizedString2 = removeDiacriticFromCharacters(normalizedString2);
  }

  return distance(normalizedString1, normalizedString2) <= similarity;
}

export function removeDiacriticFromCharacters(originalString: string): string {
  const specialToNormalizedCharMapping = [
    // makcene
    ['ř', 'r'],
    ['ě', 'e'],
    ['ď', 'd'],
    ['š', 's'],
    ['ô', 'o'],
    ['ä', 'a'],
    ['â', 'a'],
    ['ľ', 'l'],
    ['č', 'c'],
    ['ť', 't'],
    ['ň', 'n'],
    ['ž', 'z'],

    // dlzne
    ['ŕ', 'r'],
    ['é', 'e'],
    ['á', 'a'],
    ['ý', 'y'],
    ['ú', 'u'],
    ['í', 'i'],
    ['ó', 'o'],
    ['ĺ', 'l'],
    ['ń', 'n'],
    ['ś', 's'],
    ['ć', 'c'],

    // special
    ['ł', 'l'],
    ['ę', 'e'],
  ];

  let withoutMakcene = originalString;

  for (const [specialChar, nomalizedChar] of specialToNormalizedCharMapping) {
    withoutMakcene = withoutMakcene.replaceAll(specialChar, nomalizedChar);
    withoutMakcene = withoutMakcene.replaceAll(specialChar.toUpperCase(), nomalizedChar.toUpperCase());
  }

  return withoutMakcene;
}

export async function runAsyncWithTimeout<T>(asyncFunction: () => Promise<T>, timeoutMs: number) {
  return await Promise.race(
    [
      asyncFunction,
      async () => {
        await waitFor(timeoutMs);
        throw new Error(`This async function timeouted after ${timeoutMs} ms`);
      },
    ].map((f) => f())
  );
}

export function longestCommonSubstringFirst(stringA: string, stringB: string): string {
  const listOfLongest = longestCommonSubstring([stringA, stringB]) as string[];
  if (listOfLongest.isNotEmpty()) {
    return listOfLongest[0];
  } else {
    return '';
  }
}

export function oneStringContainsTheOther(stringA: string, stringB: string): boolean {
  return stringA.includes(stringB) || stringB.includes(stringA);
}

export function traverseJsonAndFindObject(options: TraverseJsonAndGetObjectOptions) {
  if (options.json === null || options.json === undefined) {
    return undefined;
  } else if (Array.isArray(options.json) || typeof options.json == 'object') {
    const keys = Object.keys(options.json);

    const objs: any | null | undefined[] = [];
    // strangely `for in` behaves weirdly. So I used old school indexed for loop
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];

      const matched = options.matcher(options.json, key);
      if (matched !== undefined) {
        return matched;
      }

      const sub = traverseJsonAndFindObject({
        json: options.json[key],
        matcher: options.matcher,
      });
      objs.push(sub);
    }

    const objectsWithValues = objs.filter((e) => e !== null && e !== undefined);
    if (objectsWithValues.isNotEmpty()) {
      return objectsWithValues.getFirst();
    }

    const objectsWithNulls = objs.filter((e) => e !== undefined);
    if (objectsWithNulls.isNotEmpty()) {
      return objectsWithNulls.getFirst();
    }
  }

  return undefined;
}

export function getFirstNestedObjectsParentByKeyAndValue<T>(json: any, targetKey: string, targetValue: any): T | null | undefined {
  return traverseJsonAndFindObject({
    json: json,
    matcher: (parentObject, currentChildKey) => {
      if (currentChildKey === targetKey) {
        const value = parentObject[currentChildKey];
        if (value === targetValue) {
          return parentObject;
        }
      }

      return undefined;
    },
  });
}

function getFirstNestedObjectByKey(json: any, targetKey: string): any | null | undefined {
  return traverseJsonAndFindObject({
    json: json,
    matcher: (parentObject, currentChildKey) => {
      if (currentChildKey === targetKey) {
        return parentObject[currentChildKey];
      } else {
        return undefined;
      }
    },
  });
}

export function getFirstObjectInJsonThatMatchesHierarchyKeys(json: any, targetKeys: string[]): any | null | undefined {
  // E.g.:
  // Json structure: [key0, key1, key2, key3, key4]
  // TargetKeys: [key2, key3] <- the keys must be direct parent/child chain
  //
  // !! Be aware that in json structure [key2, key1, key2, key3, key4] this approach will fail. To fix this it would need
  // quite a complicated refactor.

  let currentJson: any | null | undefined = undefined;

  for (let i = 0; i < targetKeys.length; i++) {
    if (i == 0) {
      currentJson = getFirstNestedObjectByKey(json, targetKeys[0]);
    } else {
      currentJson = currentJson[targetKeys[i]];
    }

    // There's no need to traverse the tree if we found null or undefined
    if (currentJson === null) {
      return null;
    } else if (currentJson === undefined) {
      return undefined;
    }
  }

  return currentJson;
}

export function getFirstObjectInJsonsThatMatchHierarchyKeys(jsons: any[], targetKeys: string[]): any | null | undefined {
  // Returned object has either the value, is null, or is undefined if the hierarchy keys doesn't match anything in json

  const listOfNestedObjects = jsons.map((e) => getFirstObjectInJsonThatMatchesHierarchyKeys(e, targetKeys));

  const objectsWithValue = listOfNestedObjects.filter((e) => e !== null && e !== undefined);
  if (objectsWithValue.isNotEmpty()) {
    return objectsWithValue.getFirst();
  }

  const objectsWithNulls = listOfNestedObjects.filter((e) => e !== undefined);
  if (objectsWithNulls.isNotEmpty()) {
    return null;
  }

  return undefined;
}

function getFirstNestedObjectByUndirectHierarchyKeys(json: any, targetKeys: string[]): any | null {
  // E.g.:
  // Json structure: [key0, key1, key2, key3, key4]
  // TargetKeys: [key1, key3] <- the keys can be undirect parent/child chain

  let currentJson: any | null = null;
  for (let i = 0; i < targetKeys.length; i++) {
    if (i == 0) {
      currentJson = getFirstNestedObjectByKey(json, targetKeys[i]);
    } else {
      currentJson = getFirstNestedObjectByKey(currentJson, targetKeys[i]);
    }
  }

  return currentJson;
}

export function dateFromUnixSeconds(unixSecondsSinceEpoch: number): Date {
  return new Date(unixSecondsSinceEpoch * 1000);
}

export function tryToParseJsonFile(filePath: string): any | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

export function stringToCaseInsensitiveExactRegex(str: string): RegExp {
  return new RegExp(`^${str}$`, 'i');
}

export function isDateInsideInterval(options: {
  dateToTest: Date | number | string;
  interval: { start: Date | number | string; end: Date | number | string };
}): boolean {
  const dateToTestAsDate = options.dateToTest instanceof Date ? options.dateToTest : convertStringOrUnixNumberToDate(options.dateToTest);
  const startDateAsDate = options.dateToTest instanceof Date ? options.dateToTest : convertStringOrUnixNumberToDate(options.dateToTest);
  const endDateAsDate = options.dateToTest instanceof Date ? options.dateToTest : convertStringOrUnixNumberToDate(options.dateToTest);

  if (dateToTestAsDate == null || startDateAsDate == null || endDateAsDate == null) {
    return false;
  } else {
    return dateToTestAsDate.valueOf() >= startDateAsDate.valueOf() && dateToTestAsDate.valueOf() <= endDateAsDate.valueOf();
  }
}

export function convertStringOrUnixNumberToDate(date: number | string): Date | null {
  if (typeof date === 'string') {
    return new Date(Date.parse(date));
  } else if (!isNaN(Number(date))) {
    return new Date(date);
  } else {
    return null;
  }
}

export function getFileName(fullPath?: string | null): string | null {
  if (fullPath == null) {
    return null;
  } else {
    return path.basename(fullPath);
  }
}

export function clamp(originalNumber: number, options: { min?: number; max?: number }): number {
  let n = originalNumber;
  n = options.min != null ? Math.max(options.min, n) : n;
  n = options.max != null ? Math.min(options.max, n) : n;

  return n;
}

export function safelyDivide(a: number, b: number): number {
  if (b == 0) {
    if (a != 0) {
      return 1; // 100% (when the `b` is zero and `a` is not, we want to have someting like infinity = 100%)
    } else {
      return 0; // 0%
    }
  } else {
    return a / b;
  }
}

// So you can access elements in array as dictionary dict['key'], so be faaar more perfomat as searching in array
export function listToIndexedDictionary<T>(list: T[], keyFunction: (e: T) => string): { [key: string]: T } {
  return list.reduce((accumulator, current, i) => {
    accumulator[keyFunction(current)] = current;
    return accumulator;
  }, {});
}

export function findDuplicatesByComparator<T>(list: T[], comparatorIsDuplicate: (aValue: T, bValue: T) => boolean): T[][] {
  // [
  //    [item_a, item_b_similar_to_a, item_c_similar_to_a, item_d_similar_to_c]
  //    [item_x, item_y_similar_to_x]
  //    and so on...
  // ]
  let duplicatesGroups: T[][] = [];

  // Reverse just to do the comparation from the start when popping
  let remainingUncheckedItems = [...list].reverse();

  while (remainingUncheckedItems.isNotEmpty()) {
    const itemToCheck = remainingUncheckedItems.pop()!;
    // print(`checking item: ${itemToCheck}`);
    // print(`remainingUncheckedItems: ${remainingUncheckedItems}`);

    let groupIndexWhereWasItemAdded: number | null = null;

    for (let i = 0; i < duplicatesGroups.length; i++) {
      const itemShouldBeAddedToThisGroup = duplicatesGroups[i].some((e) => comparatorIsDuplicate(itemToCheck, e));
      if (itemShouldBeAddedToThisGroup && groupIndexWhereWasItemAdded == null) {
        // Add to a group
        groupIndexWhereWasItemAdded = i;
        duplicatesGroups[i].push(itemToCheck);
      } else if (itemShouldBeAddedToThisGroup && groupIndexWhereWasItemAdded != null) {
        // This item was already added to one group, but it should be added to another. So because of transitivity, we need to merge these two groups
        // Merging to the frist one, and empty the second one found
        duplicatesGroups[groupIndexWhereWasItemAdded] = [...duplicatesGroups[groupIndexWhereWasItemAdded], ...duplicatesGroups[i]];
        duplicatesGroups[i] = [];
      }
    }

    // Because if mergin of groups occur, some groups become empty, so we filter them just to clean up
    duplicatesGroups = duplicatesGroups.filter((e) => e.isNotEmpty());

    if (groupIndexWhereWasItemAdded == null) {
      const foundDuplicates = remainingUncheckedItems.filter((e) => comparatorIsDuplicate(itemToCheck, e));
      if (foundDuplicates.isNotEmpty()) {
        duplicatesGroups.push([itemToCheck, ...foundDuplicates]);
      }
      remainingUncheckedItems = removeItemsFromArray(remainingUncheckedItems, foundDuplicates);
    }
  }

  return duplicatesGroups;
}

export function callOnEveryTwoElements<T>(list: T[], callback: (a: T, b: T) => void): void {
  // Order of elements doesn't matter
  for (let i = 0; i < list.length - 1; i++) {
    const element = list[i];
    const subarrayOffset = 1 + i;

    for (let j = 0; j < list.length - subarrayOffset; j++) {
      callback(element, list[j + subarrayOffset]);
    }
  }
}

export function arrayWithIndex<T>(array: T[]): [element: T, index: number, length: number][] {
  const arrayLenght = array.length;
  return array.map((e, i) => [e, i, arrayLenght]);
}

export function forN<T>(n: number, fn: (i: number) => T): T[] {
  const results: T[] = [];
  for (let i = 0; i < n; i++) {
    results.push(fn(i));
  }

  return results;
}

export function isToday(date: DateTime): boolean {
  return date.toUTC().toISODate() == DateTime.now().toUTC().toISODate();
}

export function pressAnyKeyToContinue() {
  print(`Press any key to continue...`);
  return new Promise((resolve) => {
    const wasRaw = process.stdin.isRaw;
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.once('data', (data) => {
      process.stdin.pause();
      process.stdin.setRawMode(wasRaw);
      resolve(data.toString());
    });
  });
}

export function roundFloatToDecimals(rawNumber: number, options: { decimalsPlaces: number }) {
  if (options.decimalsPlaces < 0) {
    throw new Error('decimalsPlaces cannot be less than 0');
  }

  const magicNumber = Math.pow(10, options.decimalsPlaces);
  return Math.round(rawNumber * magicNumber) / magicNumber;
}

export function isNumber(value: any): boolean {
  return typeof value === 'number';
}

function takeEveryNth<T>(arr: T[], n: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += n) {
    result.push(arr.slice(i, i + n)); // Directly slice out chunks of n
  }
  return result;
}

export function calcualteMedian(numbers: number[]): number {
  if (numbers.length === 0) {
    throw new Error('Array cannot be empty');
  }

  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function calcualteAverage(numbers: number[]): number {
  if (numbers.length === 0) {
    throw new Error('Array cannot be empty');
  }
  return numbers.sumValues((e) => e) / numbers.length;
}

export function extractJSONSSurroundedByJunkText(str: string): any[] {
  const results: any[] = [];
  let depth = 0;
  let start = -1;

  for (let i = 0; i < str.length; i++) {
    if (str[i] === '{') {
      if (depth === 0) start = i;
      depth++;
    }
    if (str[i] === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        const jsonString = str.substring(start, i + 1);
        try {
          results.push(JSON.parse(jsonString));
        } catch {
          // Ignore invalid JSON
        }
        start = -1;
      }
    }
  }

  return results;
}

export async function fetchWithTimeout(options: {
  url: string;
  timeoutMs: number;
  customHeders?: { [key: string]: string } | undefined;
  proxy?: Agent | undefined;
}): Promise<Response> {
  return await fetch(options.url, {
    signal: AbortSignal.timeout(options.timeoutMs),
    headers: options.customHeders,
    agent: options.proxy,
  });
}

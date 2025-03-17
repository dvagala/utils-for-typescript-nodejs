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

export async function forNAsync<T>(n: number, fn: (i: number) => Promise<T>): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < n; i++) {
    results.push(await fn(i));
  }

  return results;
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

export function onlyNonNullAndDefinedValues<T>(value: T | undefined | null): value is T {
  if (value === null || value === undefined) {
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

export function getLengthOfNested(arr: any[][]): number {
  return arr.flat(Infinity).length;
}

export function subtractArray2FromArrray1<T>(array1: T[], array2: T[]): T[] {
  return array1.filter((x) => !array2.includes(x));
}

export function subtractArray2FromArrray1JSONComparision<T>(array1: T[], array2: T[]): T[] {
  return array1.filter((x) => !array2.some((e) => JSON.stringify(e) == JSON.stringify(x)));
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

function takeEveryNth<T>(arr: T[], n: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += n) {
    result.push(arr.slice(i, i + n)); // Directly slice out chunks of n
  }
  return result;
}

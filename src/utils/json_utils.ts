export interface TraverseJsonAndGetObjectOptions {
  json: any;
  matcher: (parentObject: any, currentChildKey: string) => any;
}

export function jsonPrettyStringify(obj: any): string {
  return JSON.stringify(obj, null, 2);
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
  // Json structure:[key0, key2, key1, key2, key3, key4]
  // TargetKeys: [key2, key3] <- the keys must be direct parent/child chain
  // Returned: the object they found path's key3 is pointing to

  return traverseJsonAndFindObject({
    json: json,
    matcher: (parentObject, currentChildKey) => {
      // We found the 'key2'.
      if (currentChildKey === targetKeys[0]) {
        let currentJson = parentObject;
        // Now we need to find if the whole path exisits. If not, it's not the right one, and we will try more.
        for (let i = 0; i < targetKeys.length; i++) {
          currentJson = currentJson[targetKeys[i]];

          // There's no need to traverse the tree if we found null or undefined
          // We allow the actual object we're trying to find to be null.
          if (currentJson === null && i === targetKeys.length - 1) {
            return null;
            // When the object while traversing is null or some key doesn't even exist, we already know the path won't be this one
          } else if (currentJson === null || currentJson === undefined) {
            return undefined;
          }
        }

        return currentJson;
      }

      return undefined;
    },
  });
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

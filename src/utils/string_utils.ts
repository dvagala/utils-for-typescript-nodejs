import { distance } from 'fastest-levenshtein';
import { longestCommonSubstring } from 'string-algorithms';

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

export function getFirstStringThatMatchesRegex(regex: RegExp, strings: string[]): string | null {
  for (let i = 0; i < strings.length; i++) {
    if (regex.test(strings[i])) {
      return strings[i];
    }
  }
  return null;
}

export function stringToCaseInsensitiveExactRegex(str: string): RegExp {
  return new RegExp(`^${str}$`, 'i');
}

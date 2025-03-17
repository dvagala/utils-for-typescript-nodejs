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

export function parseNullableNuber(maybeNumber: string | null | undefined): number | null | undefined {
  if (maybeNumber === null) {
    return null;
  } else if (maybeNumber === undefined) {
    return undefined;
  } else {
    return Number.parseInt(maybeNumber);
  }
}

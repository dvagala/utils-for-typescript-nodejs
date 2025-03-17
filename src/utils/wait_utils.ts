import { DateTime } from 'luxon';

export interface RandomWaitOptions {
  minMs: number;
  maxMs: number;
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

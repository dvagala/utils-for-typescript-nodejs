import { Agent } from 'http';
import fetch, { Response } from 'node-fetch';
import { waitFor } from './wait_utils';

export interface PrintOptions {
  ignoreTruncation?: boolean;
  withoutNewLine?: boolean;
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

export function clone(obj: any) {
  return JSON.parse(JSON.stringify(obj));
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

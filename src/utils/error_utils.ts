import { print } from './misc_utils';
import { randomWaitShort, waitFor } from './wait_utils';

export interface RunWithRetryLogicOptions<T> {
  fn: (attemptNumber: number) => Promise<T>;
  onAttemptFailed: (error: Error, attemptNumber: number, wasLastAttempt: boolean) => Promise<void>;
  onAttemptFinally?: () => Promise<void>;
  onAttemptSucceed?: () => Promise<void>;
  onAllAttemptsFailed: (lastAttemptError: Error, allAttemptsError: Error[]) => Promise<T>;
  onAllAttemptsFinally?: () => Promise<void>;
  maxNumberOfAttemps: number;
}

export class ErrorWithRetryInfo extends Error {
  constructor(msg: string, public retryInfo: { canRetryRequest: boolean }) {
    super(msg);
    Object.setPrototypeOf(this, ErrorWithRetryInfo.prototype);
  }
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

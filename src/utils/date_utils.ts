import { DateTime } from 'luxon';

export function dateFromUnixSeconds(unixSecondsSinceEpoch: number): Date {
  return new Date(unixSecondsSinceEpoch * 1000);
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

export function isToday(date: DateTime): boolean {
  return date.toUTC().toISODate() == DateTime.now().toUTC().toISODate();
}

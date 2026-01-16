import { IntlMessageFormat } from "intl-messageformat";

import type { IsoDate, IsoTime } from "./@model/primitives";

const locale = "ru";

/**
 * Creates a pre-configured IntlMessageFormat instance with Russian locale
 *
 * @example
 * const myMessage = createMessage("{countA, plural, one {# яблоко} few {# яблока} other {# яблок}} и {countB, plural, one {# груша} few {# груши} other {# груш}}");
 * myMessage.format({ countA: 5, countB: 2 }); // "5 яблок и 2 груши"
 */
export function createMessage(template: string): IntlMessageFormat {
  return new IntlMessageFormat(template, locale);
}

/**
 * Formats an integer using Russian locale conventions
 *
 * @example
 * formatInt(1234567); // "1 234 567"
 */
export function formatInt(n: number): string {
  return n.toLocaleString(locale);
}

/**
 * Formats an ISO date using Russian locale conventions in the local time zone
 *
 * @example
 * formatDate("2000-01-31"); // "31.1.2000"
 * formatDate("2000-01-31T06:42:00Z"); // "31.1.2000"
 */
export function formatDate(isoTime: IsoTime | IsoDate): string {
  return new Date(isoTime)
    .toLocaleDateString(locale)
    .replaceAll(/0(\d)\./g, "$1.");
}

/**
 * Formats an ISO time using Russian locale conventions in the local time zone
 *
 * @example
 * formatTime("2000-01-31T06:42:00Z"); // "31.1.2000 9:42" if running in UTC+3
 */
export function formatTime(isoTime: IsoTime): string {
  return new Date(isoTime)
    .toLocaleString(locale, {
      dateStyle: "short",
      timeStyle: "short",
    })
    .replace(",", "")
    .replaceAll(/0(\d)\./g, "$1.");
}

/**
 * Checks if an ISO time or date is an ISO date
 *
 * @example
 * isIsoDate("2000-01-31"); // true
 * isIsoDate("2000-01-31T06:42:00Z"); // false
 */
function isIsoDate(isoTimeOrDate: IsoTime | IsoDate): isoTimeOrDate is IsoDate {
  return isoTimeOrDate.length === 10;
}

/**
 * Formats time or date to a string in the local time zone
 *
 * @example
 * formatTimeOrDate("2000-01-31"); // "31.1.2000"
 * formatTimeOrDate("2000-01-31T06:42:00Z"); // "31.1.2000 9:42" if running in UTC+3
 */
export function formatTimeOrDate(isoTimeOrDate: IsoTime | IsoDate): string {
  return isIsoDate(isoTimeOrDate)
    ? formatDate(isoTimeOrDate)
    : formatTime(isoTimeOrDate);
}

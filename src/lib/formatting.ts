import type { IsoDate, IsoTime } from "./primitive-values";

export function formatDate(isoTime: IsoTime | IsoDate): string {
  return new Date(isoTime)
    .toLocaleDateString("ru-RU")
    .replaceAll(/0(\d)\./g, "$1.");
}

export function formatTime(isoTime: IsoTime): string {
  return new Date(isoTime)
    .toLocaleString("ru-RU", {
      dateStyle: "short",
      timeStyle: "short",
    })
    .replace(",", "")
    .replaceAll(/0(\d)\./g, "$1.");
}

function isIsoDate(isoTimeOrDate: IsoTime | IsoDate): isoTimeOrDate is IsoDate {
  return isoTimeOrDate.length === 10; // 2000-01-01
}

export function formatTimeOrDate(isoTimeOrDate: IsoTime | IsoDate): string {
  return isIsoDate(isoTimeOrDate)
    ? formatDate(isoTimeOrDate)
    : formatTime(isoTimeOrDate);
}

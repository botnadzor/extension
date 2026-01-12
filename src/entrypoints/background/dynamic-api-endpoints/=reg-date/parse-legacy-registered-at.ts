import {
  type IsoDate,
  isoDateSchema,
  type IsoTime,
  isoTimeSchema,
} from "@/lib/primitive-values";

// cspell:ignore msk

export function parseLegacyRegisteredAt(
  registeredAt: string,
): IsoDate | IsoTime | undefined {
  const parts = registeredAt.split(" ");

  // Format: "10:02:10 20.8.2024" (time and date in MSK timezone)
  if (parts.length === 2) {
    const time = parts[0];
    const date = parts[1];

    if (!time || !date) {
      return undefined;
    }

    const timeParts = time.split(":");
    const dateParts = date.split(".");

    const hours = timeParts[0];
    const minutes = timeParts[1];
    const seconds = timeParts[2];
    const day = dateParts[0];
    const month = dateParts[1];
    const year = dateParts[2];

    if (!hours || !minutes || !seconds || !day || !month || !year) {
      return undefined;
    }

    // Parse as MSK time (UTC+3) and convert to UTC
    const mskDate = new Date(
      `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}:${seconds.padStart(2, "0")}+03:00`,
    );

    if (Number.isNaN(mskDate.getTime())) {
      return undefined;
    }

    const result = isoTimeSchema.safeParse(mskDate.toISOString());
    return result.success ? result.data : undefined;
  }

  // Format: "18.10.2025" (date only)
  if (parts.length === 1) {
    const datePart = parts[0];

    if (!datePart) {
      return undefined;
    }

    const dateParts = datePart.split(".");
    const day = dateParts[0];
    const month = dateParts[1];
    const year = dateParts[2];

    if (!day || !month || !year) {
      return undefined;
    }

    const result = isoDateSchema.safeParse(
      `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`,
    );
    return result.success ? result.data : undefined;
  }

  return undefined;
}

import { compareLogLevel, type LogLevel } from "@logtape/logtape";

import { getBackgroundLogger } from "@/shared/@logging/categories";
import {
  maxSerializedRecordCountPerLowestLogLevel,
  type SerializedLogLevel,
  type SerializedLogRecord,
  type SerializedLogRecordWithId,
} from "@/shared/@logging/serialization";
import { type LowestLogLevel, lowestLogLevels } from "@/shared/@logging/setup";
import {
  Pollable,
  type PollResult,
  type PollVersion,
} from "@/shared/@pollable/core";

const nurseryPromotionIntervalInMs = 500;
const nurseryRetentionInMs = 500;
const maxLogSequencePerMillisecond = 1000;
const logger = getBackgroundLogger(["logging-service"]);
const logLevelBySerializedLogLevel = {
  TRC: "trace",
  DBG: "debug",
  INF: "info",
  WRN: "warning",
  ERR: "error",
  FTL: "fatal",
} satisfies Record<SerializedLogLevel, LogLevel>;

function appendRecords(
  existingRecords: readonly SerializedLogRecordWithId[],
  newRecords: readonly SerializedLogRecordWithId[],
): readonly SerializedLogRecordWithId[] {
  if (newRecords.length === 0) {
    return existingRecords;
  }

  const combinedRecords = [...existingRecords, ...newRecords];

  if (combinedRecords.length <= maxSerializedRecordCountPerLowestLogLevel) {
    return combinedRecords;
  }

  return combinedRecords.slice(-maxSerializedRecordCountPerLowestLogLevel);
}

type PollableRecordsByLowestLogLevel = Record<
  LowestLogLevel,
  Pollable<readonly SerializedLogRecordWithId[]>
>;

export class LoggingService {
  private readonly pollableRecordsByLowestLogLevel: PollableRecordsByLowestLogLevel;
  private readonly initialTimestamp = Date.now();
  private nurseryRecords: readonly SerializedLogRecord[] = [];
  private nurseryPromotionTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    const pollableRecordsByLowestLogLevel: Partial<PollableRecordsByLowestLogLevel> =
      {};

    for (const logLevel of lowestLogLevels) {
      pollableRecordsByLowestLogLevel[logLevel] = new Pollable<
        readonly SerializedLogRecordWithId[]
      >([]);
    }

    this.pollableRecordsByLowestLogLevel =
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- all log levels are populated in the loop above
      pollableRecordsByLowestLogLevel as PollableRecordsByLowestLogLevel;
  }

  registerRecords(records: SerializedLogRecord[]): void {
    if (records.length === 0) {
      return;
    }

    this.nurseryRecords = [...this.nurseryRecords, ...records];
    this.scheduleNurseryPromotion();
  }

  async getRecords(
    lowestLogLevel: LowestLogLevel = "debug",
  ): Promise<readonly SerializedLogRecordWithId[]> {
    const result = await this.pollRecords(undefined, lowestLogLevel);
    return result.value;
  }

  async pollRecords(
    lastPollVersion: PollVersion | undefined,
    lowestLogLevel: LowestLogLevel = "debug",
  ): Promise<PollResult<readonly SerializedLogRecordWithId[]>> {
    return this.pollableRecordsByLowestLogLevel[lowestLogLevel].poll(
      lastPollVersion,
    );
  }

  async getRecordCount(
    lowestLogLevel: LowestLogLevel = "debug",
  ): Promise<number> {
    const result = await this.pollRecordCount(undefined, lowestLogLevel);
    return result.value;
  }

  async pollRecordCount(
    lastPollVersion: PollVersion | undefined,
    lowestLogLevel: LowestLogLevel = "debug",
  ): Promise<PollResult<number>> {
    const result = await this.pollRecords(lastPollVersion, lowestLogLevel);

    return {
      value: result.value.length,
      version: result.version,
    };
  }

  clearCollectedRecords(): void {
    this.nurseryRecords = [];

    if (this.nurseryPromotionTimer !== undefined) {
      clearTimeout(this.nurseryPromotionTimer);
      this.nurseryPromotionTimer = undefined;
    }

    for (const logLevel of lowestLogLevels) {
      this.pollableRecordsByLowestLogLevel[logLevel].setValue([]);
    }

    logger.debug("Collected log records were cleared");
  }

  private scheduleNurseryPromotion(): void {
    if (this.nurseryPromotionTimer !== undefined) {
      return;
    }

    this.nurseryPromotionTimer = setTimeout(() => {
      this.nurseryPromotionTimer = undefined;
      this.promoteNurseryRecords();
    }, nurseryPromotionIntervalInMs);
  }

  private promoteNurseryRecords(): void {
    if (this.nurseryRecords.length === 0) {
      return;
    }

    const nurseryCutoffTimestamp = Date.now() - nurseryRetentionInMs;
    const matureRecords: SerializedLogRecord[] = [];
    const remainingNurseryRecords: SerializedLogRecord[] = [];

    for (const record of this.nurseryRecords) {
      if (record[0] <= nurseryCutoffTimestamp) {
        matureRecords.push(record);
      } else {
        remainingNurseryRecords.push(record);
      }
    }

    this.nurseryRecords = remainingNurseryRecords;
    const sequenceByTimestamp = new Map<number, number>();
    const matureRecordsWithId: SerializedLogRecordWithId[] = matureRecords.map(
      (record) => {
        const timestamp = record[0];
        const sequence = sequenceByTimestamp.get(timestamp) ?? 0;

        sequenceByTimestamp.set(timestamp, sequence + 1);

        return [
          (timestamp - this.initialTimestamp) * maxLogSequencePerMillisecond +
            sequence,
          ...record,
        ];
      },
    );

    for (const logLevel of lowestLogLevels) {
      const recordsToAppend = matureRecordsWithId.filter(
        (record) =>
          compareLogLevel(logLevelBySerializedLogLevel[record[2]], logLevel) >=
          0,
      );

      if (recordsToAppend.length > 0) {
        this.pollableRecordsByLowestLogLevel[logLevel].setValue(
          appendRecords(
            this.pollableRecordsByLowestLogLevel[logLevel].getValue(),
            recordsToAppend,
          ),
        );
      }
    }

    if (this.nurseryRecords.length > 0) {
      this.scheduleNurseryPromotion();
    }
  }
}

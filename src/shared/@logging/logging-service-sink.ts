import type { LogRecord, Sink } from "@logtape/logtape";

import {
  serializedLogLevelLookup,
  type SerializedLogRecord,
} from "@/shared/@logging/serialization";
import {
  serializeMessage,
  serializeProperties,
} from "@/shared/@logging/serialization-helpers";

const batchSize = 100;
const flushInterval = 200;

type LoggingServiceRegistrar = Readonly<{
  registerRecords: (records: SerializedLogRecord[]) => void | Promise<void>;
}>;

function serializeLogRecord(record: LogRecord): SerializedLogRecord {
  return [
    record.timestamp,
    serializedLogLevelLookup[record.level],
    record.category,
    serializeMessage(record.message),
    serializeProperties(record.properties),
  ];
}

export function createLoggingServiceSink(
  loggingService: LoggingServiceRegistrar,
): Sink & Disposable {
  const buffer: SerializedLogRecord[] = [];
  const maxBufferSize = batchSize * 2;
  let disposed = false;
  let flushTimer: ReturnType<typeof setInterval> | undefined;
  let flushScheduled = false;
  let activeFlush: Promise<void> | undefined;

  async function flush(): Promise<void> {
    if (activeFlush) {
      return activeFlush;
    }

    activeFlush = (async () => {
      while (buffer.length > 0) {
        const records = buffer.splice(0, batchSize);
        await loggingService.registerRecords(records);
      }
    })().finally(() => {
      activeFlush = undefined;
    });

    return activeFlush;
  }

  function scheduleFlush(): void {
    if (flushScheduled || disposed) {
      return;
    }

    flushScheduled = true;

    setTimeout(() => {
      flushScheduled = false;
      void flush();
    }, 0);
  }

  function startFlushTimer(): void {
    if (flushTimer || disposed) {
      return;
    }

    flushTimer = setInterval(() => {
      void flush();
    }, flushInterval);
  }

  function sink(record: LogRecord): void {
    if (disposed) {
      return;
    }

    if (buffer.length >= maxBufferSize) {
      buffer.shift();
    }

    buffer.push(serializeLogRecord(record));

    if (buffer.length >= batchSize) {
      scheduleFlush();
      return;
    }

    startFlushTimer();
  }

  return Object.assign(sink, {
    [Symbol.dispose]: async () => {
      disposed = true;

      if (flushTimer) {
        clearInterval(flushTimer);
        flushTimer = undefined;
      }

      await flush();
    },
  });
}

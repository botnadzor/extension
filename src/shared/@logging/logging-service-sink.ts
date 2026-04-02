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
const defaultDisposalSymbols = {
  asyncDispose: Symbol.asyncDispose,
  dispose: Symbol.dispose,
} as const;

type LoggingServiceRegistrar = Readonly<{
  registerRecords: (records: SerializedLogRecord[]) => void | Promise<void>;
}>;

type DisposalSymbols = Readonly<{
  asyncDispose: symbol;
  dispose: symbol;
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

export function shouldAttachDisposeSymbolToFunctionSink(
  symbols: DisposalSymbols = defaultDisposalSymbols,
): boolean {
  return symbols.dispose !== symbols.asyncDispose;
}

export function createLoggingServiceSink(
  loggingService: LoggingServiceRegistrar,
): Sink {
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

  if (!shouldAttachDisposeSymbolToFunctionSink()) {
    return sink;
  }

  return Object.assign(sink, {
    [defaultDisposalSymbols.dispose]: () => {
      disposed = true;

      if (flushTimer) {
        clearInterval(flushTimer);
        flushTimer = undefined;
      }

      void flush();
    },
  });
}

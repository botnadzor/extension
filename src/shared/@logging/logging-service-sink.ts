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

/**
 * Firefox ESR 140.x misreports explicit resource management symbols in some
 * extension realms: `Symbol.dispose === Symbol.asyncDispose`.
 *
 * Our logging sink is a function object. When we attach `[Symbol.dispose]` to
 * that function in the affected runtime, Firefox also exposes the same property
 * through `[Symbol.asyncDispose]`. LogTape then treats this otherwise sync sink
 * as async-disposable and `configureSync()` throws during popup startup.
 *
 * This guard keeps the workaround narrowly targeted to the broken runtime
 * behavior instead of browser-version sniffing.
 *
 * Remove this once Firefox ESR ships distinct `Symbol.dispose` and
 * `Symbol.asyncDispose` values in extension contexts and we no longer reproduce
 * the popup crash there. At that point the sync dispose hook below can be
 * restored unconditionally.
 */
export function shouldAttachDisposeSymbolToFunctionSink(): boolean {
  const disposeSymbol: symbol = Symbol.dispose;
  const asyncDisposeSymbol: symbol = Symbol.asyncDispose;

  return disposeSymbol !== asyncDisposeSymbol;
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
    [Symbol.dispose]: () => {
      disposed = true;

      if (flushTimer) {
        clearInterval(flushTimer);
        flushTimer = undefined;
      }

      void flush();
    },
  });
}

import { LoaderCircleIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@/shared/@ui-primitives/button";

const initialChunkSize = 100;
const tailChunkThresholdMultiplier = 1.7;

type ItemChunk<T> = Readonly<{
  items: readonly T[];
  offset: number;
}>;

type ChunkState<T> = Readonly<{
  chunkSize: number;
  chunks: ReadonlyArray<ItemChunk<T>>;
  sourceItems: readonly T[];
}>;

type VisibleChunkState<T> = Readonly<{
  shownChunkCount: number;
  sourceItems: readonly T[];
}>;

function createChunk<T>(
  sourceItems: readonly T[],
  offset: number,
  endOffset: number,
): ItemChunk<T> {
  return {
    offset,
    items: sourceItems.slice(offset, endOffset),
  };
}

function createChunkState<T>(
  sourceItems: readonly T[],
  chunkSize: number,
): ChunkState<T> {
  const chunks: Array<ItemChunk<T>> = [];
  const tailChunkThreshold = chunkSize * tailChunkThresholdMultiplier;

  if (sourceItems.length < tailChunkThreshold) {
    return {
      chunkSize,
      chunks:
        sourceItems.length === 0
          ? []
          : [createChunk(sourceItems, 0, sourceItems.length)],
      sourceItems,
    };
  }

  chunks.push(createChunk(sourceItems, 0, chunkSize));

  for (
    let offset = chunkSize;
    offset < sourceItems.length;
    offset += chunkSize
  ) {
    if (sourceItems.length - offset < tailChunkThreshold) {
      chunks.push(createChunk(sourceItems, offset, sourceItems.length));
      break;
    }

    chunks.push(createChunk(sourceItems, offset, offset + chunkSize));
  }

  return {
    chunkSize,
    chunks,
    sourceItems,
  };
}

function useItemChunks<T>(sourceItems: readonly T[], chunkSize: number) {
  const [committedState] = React.useState(() =>
    createChunkState(sourceItems, chunkSize),
  );

  return committedState.sourceItems === sourceItems &&
    committedState.chunkSize === chunkSize
    ? committedState.chunks
    : createChunkState(sourceItems, chunkSize).chunks;
}

function waitForNextFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      resolve();
    });
  });
}

export function ChunkedAccordionRows<T>({
  chunkRenderer: ChunkRenderer,
  chunkSize = initialChunkSize,
  gridClassName,
  items,
}: {
  chunkRenderer: React.ComponentType<{
    items: readonly T[];
    offset: number;
  }>;
  chunkSize?: number;
  gridClassName: string;
  items: readonly T[];
}) {
  const itemChunks = useItemChunks(items, chunkSize);
  const [visibleChunkState, setVisibleChunkState] = React.useState<
    VisibleChunkState<T>
  >(() => ({
    shownChunkCount: itemChunks.length === 0 ? 0 : 1,
    sourceItems: items,
  }));
  const visibleChunkCount =
    visibleChunkState.sourceItems === items
      ? visibleChunkState.shownChunkCount
      : itemChunks.length === 0
        ? 0
        : 1;
  const visibleChunks = itemChunks.slice(0, visibleChunkCount);
  const [pending, startTransition] = React.useTransition();
  const hasMore = visibleChunkCount < itemChunks.length;

  function handleMoreClick() {
    startTransition(async () => {
      await waitForNextFrame();

      setVisibleChunkState((currentState) => {
        const currentChunkCount =
          currentState.sourceItems === items
            ? currentState.shownChunkCount
            : itemChunks.length === 0
              ? 0
              : 1;

        return {
          shownChunkCount: Math.min(currentChunkCount + 1, itemChunks.length),
          sourceItems: items,
        };
      });
    });
  }

  return (
    <>
      <div className={gridClassName}>
        {visibleChunks.map((chunk) => (
          <ChunkRenderer
            key={chunk.offset}
            items={chunk.items}
            offset={chunk.offset}
          />
        ))}
      </div>
      {hasMore && (
        <div className="pt-2">
          {pending ? (
            <div className="flex h-8 items-center justify-center">
              <span className="animate-in opacity-0 delay-300 duration-300 fade-in">
                <LoaderCircleIcon className="size-4 animate-spin text-muted-foreground" />
              </span>
            </div>
          ) : (
            <Button size="sm" variant="secondary" onClick={handleMoreClick}>
              Показать ещё
            </Button>
          )}
        </div>
      )}
    </>
  );
}

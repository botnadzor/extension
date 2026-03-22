import {
  EraserIcon,
  FileBracesIcon,
  FileTextIcon,
  MoreVerticalIcon,
} from "lucide-react";

import type {
  StaticListCombiningMode,
  StaticListPageEntry,
} from "@/shared/@model/static-list-helpers";
import type { StaticListId } from "@/shared/@model/static-lists";
import { Button } from "@/shared/@ui-primitives/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/@ui-primitives/dropdown-menu";
import { createMessage } from "@/shared/formatting";
import { staticListsService } from "@/shared/proxy-services";

const exportPageSize = 10_000;

async function fetchAllEntries(
  listId: StaticListId,
): Promise<StaticListPageEntry[]> {
  const entries: StaticListPageEntry[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const result = await staticListsService.getEntriesPage(listId, {
      offset,
      limit: exportPageSize,
    });

    entries.push(...result.items);
    offset += result.items.length;
    hasMore = offset < result.totalCount;
  }

  return entries;
}

async function handleCopyAsJson(listId: StaticListId) {
  const entries = await fetchAllEntries(listId);
  const text = JSON.stringify(
    entries.flatMap((entry) =>
      entry.interpretation.success ? [entry.interpretation.item] : [],
    ),
    undefined,
    2,
  );
  await navigator.clipboard.writeText(text);
}

async function handleCopyAsJsonl(listId: StaticListId) {
  const entries = await fetchAllEntries(listId);
  const text =
    entries.map((entry) => entry.sourceText).join("\n") +
    (entries.length > 0 ? "\n" : "");
  await navigator.clipboard.writeText(text);
}

async function handleDeleteAllLocal(
  listId: StaticListId,
  onDeleted?: () => void,
) {
  await staticListsService.setLocalItems(listId, []);
  onDeleted?.();
}

const eraseAllLocalMessage = createMessage(
  "Стереть {count, plural, one {# локальную запись} few {# локальные записи} other {# локальных записей}}",
);

export function ActionsDropdownMenu({
  combiningMode,
  listId,
  localItemCount,
  onDeletedAllLocal,
  totalItemCount = 0,
}: {
  combiningMode: StaticListCombiningMode;
  listId: StaticListId;
  localItemCount: number;
  onDeletedAllLocal: () => void;
  totalItemCount: number | undefined;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button size="iconSm" variant="outline">
            <MoreVerticalIcon />
          </Button>
        }
      />

      <DropdownMenuContent align="end" className="w-auto">
        <DropdownMenuItem
          onClick={() => void handleCopyAsJson(listId)}
          disabled={totalItemCount === 0}
        >
          <FileBracesIcon />
          Скопировать как JSON
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => void handleCopyAsJsonl(listId)}
          disabled={totalItemCount === 0}
        >
          <FileTextIcon />
          Скопировать как JSONL
        </DropdownMenuItem>

        {combiningMode !== "remoteOnly" && localItemCount > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() =>
                void handleDeleteAllLocal(listId, onDeletedAllLocal)
              }
            >
              <EraserIcon />
              {eraseAllLocalMessage.format({ count: localItemCount })}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

import {
  EraserIcon,
  FileBracesIcon,
  FileTextIcon,
  MoreVerticalIcon,
} from "lucide-react";

import type {
  StaticListCombiningMode,
  StaticListDefinition,
} from "@/shared/@model/static-list-helpers";
import {
  staticListDefinitionLookup,
  type StaticListId,
} from "@/shared/@model/static-lists";
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

async function fetchAllStoredItems(listId: StaticListId): Promise<unknown[]> {
  const rawItems: unknown[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const result = await staticListsService.getItemsPage(listId, {
      offset,
      limit: exportPageSize,
    });

    for (const pageItem of result.items) {
      rawItems.push(pageItem.item);
    }
    offset += result.items.length;
    hasMore = offset < result.totalCount;
  }

  return rawItems;
}

async function handleCopyAsJson(listId: StaticListId) {
  const rawItems = await fetchAllStoredItems(listId);
  const text = JSON.stringify(rawItems, undefined, 2);
  await navigator.clipboard.writeText(text);
}

async function handleCopyAsJsonl(listId: StaticListId) {
  const rawItems = await fetchAllStoredItems(listId);

  const definition: StaticListDefinition = staticListDefinitionLookup[listId];

  const text =
    rawItems
      .map((rawItem) => {
        const item = definition.storedItemSchema.safeParse(rawItem);

        return item.success
          ? definition.mapStoredToReceived(item.data)
          : undefined;
      })
      .filter((item) => item !== undefined)
      .map(
        (item) => definition.jsonlStringifyRow?.(item) ?? JSON.stringify(item),
      )
      .join("\n") + (rawItems.length > 0 ? "\n" : "");
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

import { PlusIcon } from "lucide-react";
import * as React from "react";

import type {
  StaticListCombiningMode,
  StaticListPageEntry,
} from "@/shared/@model/static-list-helpers";
import {
  staticListDefinitionLookup,
  type StaticListId,
} from "@/shared/@model/static-lists";
import { Button } from "@/shared/@ui-primitives/button";
import { ScrollArea } from "@/shared/@ui-primitives/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/@ui-primitives/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/@ui-primitives/tooltip";
import { createMessage } from "@/shared/formatting";
import { staticListsService } from "@/shared/proxy-services";

import { ActionsDropdownMenu } from "./static-list-tab-body/actions-dropdown-menu";
import { AdditionalInsertionControls } from "./static-list-tab-body/additional-insertion-controls";
import {
  ItemEditDialog,
  type ItemEditDialogMode,
} from "./static-list-tab-body/item-edit-dialog";
import { ItemRow } from "./static-list-tab-body/item-row";
import { LoadingSpinner } from "./static-list-tab-body/loading-spinner";

const pageSize = 100;

const itemCountMessage = createMessage(
  "{count, plural, one {# запись} few {# записи} many {# записей} other {# записей}}",
);

const combiningModeOptions: Array<{
  mode: StaticListCombiningMode;
  label: string;
}> = [
  { mode: "remoteOnly", label: "Remote only" },
  { mode: "remoteWithLocalOverrides", label: "Remote + local" },
  { mode: "localOnly", label: "Local only" },
];

export function StaticListTabBody({ listId }: { listId: StaticListId }) {
  const [combiningMode, setCombiningMode] =
    React.useState<StaticListCombiningMode>("remoteOnly");
  const [localItemCount, setLocalItemCount] = React.useState(0);
  const [totalItemCount, setTotalItemCount] = React.useState<
    number | undefined
  >(undefined);

  const [items, setItems] = React.useState<StaticListPageEntry[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(true);
  const [editDialog, setEditDialog] = React.useState<
    ItemEditDialogMode | undefined
  >(undefined);

  const listDefinition = staticListDefinitionLookup[listId];
  const indexNames = [
    listDefinition.logicalPrimaryKey.name,
    ...(listDefinition.secondaryIndexes ?? []).map((index) => index.name),
  ];

  const loadPage = React.useCallback(
    async (offset: number) => {
      setLoading(true);
      const result = await staticListsService.getEntriesPage(listId, {
        offset,
        limit: pageSize,
      });
      setTotalItemCount(result.totalCount);
      setItems((prev) =>
        offset === 0 ? result.items : [...prev, ...result.items],
      );
      setHasMore(offset + result.items.length < result.totalCount);
      setLoading(false);
    },
    [listId],
  );

  React.useEffect(() => {
    void staticListsService.getCombiningMode(listId).then(setCombiningMode);
  }, [listId]);

  React.useEffect(() => {
    if (
      combiningMode === "remoteWithLocalOverrides" ||
      combiningMode === "localOnly"
    ) {
      void staticListsService.getLocalListSummary(listId).then((summary) => {
        setLocalItemCount(summary.itemCount);
      });
    } else {
      // eslint-disable-next-line @eslint-react/set-state-in-effect, react-hooks/set-state-in-effect -- intentional reset when not in local mode
      setLocalItemCount(0);
    }
  }, [listId, combiningMode]);

  React.useEffect(() => {
    // eslint-disable-next-line @eslint-react/set-state-in-effect, react-hooks/set-state-in-effect -- intentional state reset when deps change
    setItems([]);
    // eslint-disable-next-line @eslint-react/set-state-in-effect -- intentional state reset when deps change
    setHasMore(true);
    // eslint-disable-next-line @eslint-react/set-state-in-effect -- intentional state reset when deps change
    setTotalItemCount(undefined);
    void loadPage(0);
  }, [loadPage, combiningMode]);

  async function handleCombiningModeChange(mode: StaticListCombiningMode) {
    await staticListsService.setCombiningMode(listId, mode);
    setCombiningMode(mode);
  }

  function handleLoadMore() {
    void loadPage(items.length);
  }

  function handleItemClick(entry: StaticListPageEntry) {
    if (entry.origin === "remote") {
      if (entry.interpretation.success) {
        setEditDialog({ type: "override", item: entry.interpretation.item });
      } else {
        setEditDialog({
          type: "viewRaw",
          origin: "remote",
          sourceText: entry.sourceText,
        });
      }
      return;
    }

    if (entry.interpretation.success) {
      setEditDialog({
        type: "edit",
        item: entry.interpretation.item,
        origin: entry.origin,
        rowKey: String(entry.rowKey),
      });
      return;
    }

    setEditDialog({
      type: "editRaw",
      origin: entry.origin,
      rowKey: String(entry.rowKey),
      sourceText: entry.sourceText,
    });
  }

  function handleDialogSaved() {
    setEditDialog(undefined);
    setItems([]);
    setHasMore(true);
    setTotalItemCount(undefined);
    void loadPage(0);
    void staticListsService.getLocalListSummary(listId).then((summary) => {
      setLocalItemCount(summary.itemCount);
    });
  }

  return (
    <div className="absolute inset-0 -m-1 flex flex-1 flex-col gap-3 p-1">
      <div className="flex flex-0 items-center justify-between gap-2">
        <div className="ml-2 text-muted-foreground">
          {totalItemCount === undefined ? (
            <LoadingSpinner />
          ) : (
            String(itemCountMessage.format({ count: totalItemCount }))
          )}
        </div>
        <div className="flex items-center gap-1">
          <Select
            value={combiningMode}
            onValueChange={(value) => {
              if (value) {
                void handleCombiningModeChange(value);
              }
            }}
          >
            <SelectTrigger size="sm">
              <SelectValue>
                {combiningModeOptions.find((o) => o.mode === combiningMode)
                  ?.label ?? combiningMode}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {combiningModeOptions.map(({ mode, label }) => (
                <SelectItem key={mode} value={mode}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  disabled={combiningMode === "remoteOnly"}
                  onClick={() => {
                    setEditDialog({ type: "add" });
                  }}
                  size="iconSm"
                  variant="outline"
                >
                  <PlusIcon />
                </Button>
              }
            />
            <TooltipContent>Добавить локальную запись</TooltipContent>
          </Tooltip>

          <ActionsDropdownMenu
            combiningMode={combiningMode}
            listId={listId}
            localItemCount={localItemCount}
            onDeletedAllLocal={() => {
              void loadPage(0);
              setLocalItemCount(0);
            }}
            totalItemCount={totalItemCount}
          />
        </div>
      </div>

      {items.length > 0 && (
        <div
          className="
            grid flex-0 gap-x-2 border-b border-border px-2 pb-1 font-medium
            text-muted-foreground
          "
          style={{
            gridTemplateColumns: `4rem repeat(${indexNames.length}, 1fr)`,
          }}
        >
          <div>Тип</div>
          {indexNames.map((indexName) => (
            <div key={indexName}>{indexName}</div>
          ))}
        </div>
      )}

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-px">
          {items.map((pageItem, index) => (
            <ItemRow
              indexNames={indexNames}
              item={pageItem}
              // eslint-disable-next-line @eslint-react/no-array-index-key -- items are append-only within a page
              key={index}
              onClick={() => {
                handleItemClick(pageItem);
              }}
            />
          ))}
        </div>

        {hasMore && (
          <Button
            className="mt-2"
            disabled={loading}
            onClick={handleLoadMore}
            size="sm"
            variant="outline"
          >
            {loading ? <LoadingSpinner /> : "Загрузить ещё"}
          </Button>
        )}
      </ScrollArea>

      {editDialog && (
        <ItemEditDialog
          combiningMode={combiningMode}
          listId={listId}
          mode={editDialog}
          onClose={() => {
            setEditDialog(undefined);
          }}
          onSaved={handleDialogSaved}
        />
      )}

      {listId === "insertions" && items.length > 0 && (
        <AdditionalInsertionControls />
      )}
    </div>
  );
}

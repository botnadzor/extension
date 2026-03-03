import { jsonrepair } from "jsonrepair";
import * as React from "react";

import type {
  StaticListCombiningMode,
  StaticListItemOrigin,
} from "@/shared/@model/static-list-helpers";
import {
  staticListDefinitionLookup,
  type StaticListId,
} from "@/shared/@model/static-lists";
import { Button } from "@/shared/@ui-primitives/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/@ui-primitives/dialog";
import { FieldError } from "@/shared/@ui-primitives/field";
import { Textarea } from "@/shared/@ui-primitives/textarea";
import { staticListsService } from "@/shared/proxy-services";

import { parsePastedContent } from "./item-edit-dialog/parse-pasted-content";

export type ItemEditDialogMode =
  | { type: "add" }
  | { type: "edit"; item: unknown; origin: StaticListItemOrigin }
  | { type: "override"; item: unknown };

export function ItemEditDialog({
  combiningMode,
  listId,
  mode,
  onClose,
  onSaved,
}: {
  combiningMode: StaticListCombiningMode;
  listId: StaticListId;
  mode: ItemEditDialogMode;
  onClose: () => void;
  onSaved: () => void;
}) {
  const listDefinition = staticListDefinitionLookup[listId];
  const firstIndex = listDefinition.indexes[0];

  const initialJson =
    mode.type === "add" ? "" : JSON.stringify(mode.item, undefined, 2);

  const [json, setJson] = React.useState(initialJson);
  const [error, setError] = React.useState<string | undefined>(undefined);
  const [saving, setSaving] = React.useState(false);

  const title =
    mode.type === "add"
      ? "Новая локальная запись"
      : mode.type === "override"
        ? "Запись с сервера"
        : "Локальная запись";

  async function handleSave() {
    setError(undefined);

    if (mode.type === "add") {
      const result = parsePastedContent(json, listDefinition);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setSaving(true);
      try {
        await Promise.all(
          result.storedItems.map((item) =>
            staticListsService.putLocalItem(listId, item),
          ),
        );
        onSaved();
      } catch (saveError: unknown) {
        setError(
          saveError instanceof Error ? saveError.message : "Ошибка сохранения",
        );
        setSaving(false);
      }
      return;
    }

    let parsed: unknown;
    try {
      const repaired = jsonrepair(json);
      parsed = JSON.parse(repaired);
    } catch {
      setError("Невалидный JSON");
      return;
    }

    const validation = listDefinition.storedItemSchema.safeParse(parsed);
    if (!validation.success) {
      setError(
        validation.error.issues
          .map(
            (issue) => `${issue.path.map(String).join(".")}: ${issue.message}`,
          )
          .join("\n"),
      );
      return;
    }

    setSaving(true);
    try {
      await staticListsService.putLocalItem(listId, validation.data);
      onSaved();
    } catch (saveError: unknown) {
      setError(
        saveError instanceof Error ? saveError.message : "Ошибка сохранения",
      );
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (mode.type === "add") {
      return;
    }

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- item is always a record from Dexie
    const itemRecord = mode.item as Record<string, unknown>;
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- firstIndex is always a string key
    const firstIndexKey = firstIndex as string;

    setSaving(true);
    try {
      /* eslint-disable @typescript-eslint/consistent-type-assertions -- generic Index cannot be inferred from union StaticListId; runtime values are correct */
      await (
        staticListsService.removeLocalItem as (
          listId: StaticListId,
          index: string,
          value: unknown,
        ) => Promise<{ deletedCount: number }>
      )(listId, firstIndexKey, itemRecord[firstIndexKey]);
      /* eslint-enable @typescript-eslint/consistent-type-assertions -- re-enable after block above */
      onSaved();
    } catch (deleteError: unknown) {
      setError(
        deleteError instanceof Error ? deleteError.message : "Ошибка удаления",
      );
      setSaving(false);
    }
  }

  const canDelete =
    mode.type === "edit" &&
    (mode.origin === "local" || mode.origin === "localOverride");

  return (
    <Dialog
      open={true}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent className="flex h-1/2 flex-col">
        <DialogHeader>
          <DialogTitle className="text-left">{title}</DialogTitle>
        </DialogHeader>

        <Textarea
          className="flex-1 font-mono text-xs"
          placeholder={
            mode.type === "add"
              ? "JSON, JSONL или содержимое .ts файла"
              : undefined
          }
          value={json}
          onChange={(event) => {
            setJson(event.target.value);
            if (mode.type === "add") {
              setError(undefined);
            }
          }}
        />

        {error && (
          <FieldError className="whitespace-pre-wrap">{error}</FieldError>
        )}

        {combiningMode === "remoteOnly" && (
          <div className="text-sm text-muted-foreground">
            Правка недоступна в режиме Remote only
          </div>
        )}

        <DialogFooter className="gap-x-2">
          {canDelete && (
            <Button
              disabled={saving}
              onClick={() => void handleDelete()}
              size="sm"
              variant="destructive"
            >
              Удалить
            </Button>
          )}
          <div className="-my-1 flex-1" />
          {combiningMode === "remoteOnly" ? (
            <>
              <DialogClose render={<Button size="sm" variant="outline" />}>
                Закрыть
              </DialogClose>
            </>
          ) : (
            <>
              <DialogClose render={<Button size="sm" variant="outline" />}>
                Отмена
              </DialogClose>
              <Button
                disabled={saving}
                onClick={() => void handleSave()}
                size="sm"
              >
                {saving
                  ? "Сохранение..."
                  : mode.type === "override"
                    ? "Перезаписать локально"
                    : mode.type === "edit"
                      ? "Сохранить локально"
                      : "Добавить локально"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

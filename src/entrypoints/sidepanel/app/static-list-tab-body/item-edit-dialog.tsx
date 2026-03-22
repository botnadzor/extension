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
  | {
      type: "edit";
      item: unknown;
      origin: StaticListItemOrigin;
      rowKey: string;
    }
  | {
      type: "editRaw";
      origin: Exclude<StaticListItemOrigin, "remote">;
      rowKey: string;
      sourceText: string;
    }
  | { type: "override"; item: unknown }
  | { type: "viewRaw"; origin: "remote"; sourceText: string };

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
  const initialJson =
    mode.type === "add"
      ? ""
      : mode.type === "editRaw" || mode.type === "viewRaw"
        ? mode.sourceText
        : JSON.stringify(mode.item, undefined, 2);

  const [json, setJson] = React.useState(initialJson);
  const [addMode, setAddMode] = React.useState<"typed" | "raw">("typed");
  const [error, setError] = React.useState<string | undefined>(undefined);
  const [saving, setSaving] = React.useState(false);

  const title =
    mode.type === "add"
      ? "Новая локальная запись"
      : mode.type === "viewRaw"
        ? "Невалидная запись с сервера"
        : mode.type === "editRaw"
          ? "Невалидная локальная запись"
          : mode.type === "override"
            ? "Запись с сервера"
            : "Локальная запись";

  const localRowKey =
    mode.type === "edit" || mode.type === "editRaw" ? mode.rowKey : undefined;

  async function handleSave() {
    setError(undefined);

    if (mode.type === "add") {
      setSaving(true);
      try {
        if (addMode === "typed") {
          const result = parsePastedContent(json, listDefinition);
          if (!result.success) {
            setError(result.error);
            setSaving(false);
            return;
          }

          const saveResult = await staticListsService.putLocalItems(
            listId,
            result.interpretedItems,
            { validate: true },
          );
          if (!saveResult.success) {
            setError(saveResult.error);
            setSaving(false);
            return;
          }
        } else {
          const lines = json
            .split("\n")
            .map((line) => line.trimEnd())
            .filter((line) => line.trim() !== "");
          const saveResult = await staticListsService.putLocalItems(
            listId,
            lines,
            { validate: false },
          );
          if (!saveResult.success) {
            setError(saveResult.error);
            setSaving(false);
            return;
          }
        }
        onSaved();
      } catch (saveError: unknown) {
        setError(
          saveError instanceof Error ? saveError.message : "Ошибка сохранения",
        );
        setSaving(false);
      }
      return;
    }

    if (mode.type === "editRaw") {
      setSaving(true);
      try {
        const saveResult = await staticListsService.putLocalItem(listId, json, {
          rowKey: mode.rowKey,
          validate: false,
        });
        if (!saveResult.success) {
          setError(saveResult.error);
          setSaving(false);
          return;
        }
        onSaved();
      } catch (saveError: unknown) {
        setError(
          saveError instanceof Error ? saveError.message : "Ошибка сохранения",
        );
        setSaving(false);
      }
      return;
    }

    if (mode.type === "viewRaw") {
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

    const validation = listDefinition.interpretedItemSchema.safeParse(parsed);
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
      const saveResult = await staticListsService.putLocalItem(
        listId,
        validation.data,
        {
          validate: true,
          ...(mode.type === "edit" ? { rowKey: mode.rowKey } : {}),
        },
      );
      if (!saveResult.success) {
        setError(saveResult.error);
        setSaving(false);
        return;
      }
      onSaved();
    } catch (saveError: unknown) {
      setError(
        saveError instanceof Error ? saveError.message : "Ошибка сохранения",
      );
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (localRowKey === undefined) {
      return;
    }

    setSaving(true);
    try {
      await staticListsService.removeLocalItem(listId, { rowKey: localRowKey });
      onSaved();
    } catch (deleteError: unknown) {
      setError(
        deleteError instanceof Error ? deleteError.message : "Ошибка удаления",
      );
      setSaving(false);
    }
  }

  const canDelete =
    (mode.type === "edit" || mode.type === "editRaw") &&
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
              ? addMode === "typed"
                ? "JSON, JSONL или содержимое .ts файла"
                : "Одна сырая JSONL-строка на запись"
              : undefined
          }
          readOnly={mode.type === "viewRaw"}
          value={json}
          onChange={(event) => {
            setJson(event.target.value);
            if (mode.type === "add") {
              setError(undefined);
            }
          }}
        />

        {mode.type === "add" && (
          <div className="flex gap-2 text-sm">
            <Button
              onClick={() => {
                setAddMode("typed");
                setError(undefined);
              }}
              size="sm"
              variant={addMode === "typed" ? "default" : "outline"}
            >
              Typed import
            </Button>
            <Button
              onClick={() => {
                setAddMode("raw");
                setError(undefined);
              }}
              size="sm"
              variant={addMode === "raw" ? "default" : "outline"}
            >
              Raw import
            </Button>
          </div>
        )}

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
          {combiningMode === "remoteOnly" || mode.type === "viewRaw" ? (
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
                    : mode.type === "editRaw"
                      ? "Сохранить raw"
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

import { produce } from "immer";
import { EyeIcon, EyeOffIcon, RotateCw } from "lucide-react";
import * as React from "react";

import { isoDateTimeSchema } from "@/shared/@primitives/temporal";
import { useDxConfig } from "@/shared/@ui-helpers/data-hooks";
import { Button } from "@/shared/@ui-primitives/button";
import { Checkbox } from "@/shared/@ui-primitives/checkbox";
import { Label } from "@/shared/@ui-primitives/label";
import { dxConfigService } from "@/shared/proxy-services";
import { cn } from "@/shared/tailwindcss-helpers";

export function AdditionalInsertionControls() {
  const dxConfig = useDxConfig();

  function handleFramingChange(checked: boolean) {
    void dxConfigService.set(
      produce(dxConfig, (draft) => {
        if (checked) {
          draft.insertionFraming = true;
        } else {
          delete draft.insertionFraming;
        }
      }),
    );
  }

  function handleLabelingChange(checked: boolean) {
    void dxConfigService.set(
      produce(dxConfig, (draft) => {
        if (checked) {
          draft.insertionLabeling = true;
        } else {
          delete draft.insertionLabeling;
        }
      }),
    );
  }

  function handleDataInDomChange(checked: boolean) {
    void dxConfigService.set(
      produce(dxConfig, (draft) => {
        if (checked) {
          draft.insertionDataInDom = true;
        } else {
          delete draft.insertionDataInDom;
        }
      }),
    );
  }

  function handleHiddenToggle() {
    const newConfig = produce(dxConfig, (draft) => {
      if (draft.insertionsRemoved) {
        delete draft.insertionsRemoved;
      } else {
        draft.insertionsRemoved = true;
      }
    });
    void dxConfigService.set(newConfig);
  }

  const [rotating, setRotating] = React.useState(false);

  function handleForceRerender() {
    const newConfig = produce(dxConfig, (draft) => {
      draft.insertionForceRerenderedAt = isoDateTimeSchema.parse(Date.now());
    });
    void dxConfigService.set(newConfig);

    if (rotating) {
      return;
    }

    setRotating(true);

    setTimeout(() => {
      setRotating(false);
    }, 600); // Match CSS transition duration
  }

  const insertionsRemoved = dxConfig.insertionsRemoved ?? false;

  return (
    <div
      className="
        flex flex-col gap-3
        md:flex-row
      "
    >
      <div
        className="
          flex flex-wrap items-center gap-3 border-l border-border/30 pl-2
        "
      >
        <Button size="sm" className="w-44" onClick={handleHiddenToggle}>
          {insertionsRemoved ? (
            <>
              <EyeIcon className="size-4" />
              Показать вставки
            </>
          ) : (
            <>
              <EyeOffIcon className="size-4" />
              Убрать все вставки
            </>
          )}
        </Button>
        <Button
          size="sm"
          className="gap-1.5"
          onClick={handleForceRerender}
          disabled={insertionsRemoved}
        >
          <RotateCw
            className="size-4"
            style={
              rotating
                ? {
                    transform: "rotate(360deg)",
                    transition: "transform 0.6s ease-in-out",
                  }
                : undefined
            }
          />
          Перерисовать
        </Button>
      </div>

      <div className="flex items-center gap-4 pl-2">
        <Label className={cn(insertionsRemoved && "text-foreground/50")}>
          <Checkbox
            checked={
              insertionsRemoved ? false : (dxConfig.insertionFraming ?? false)
            }
            onCheckedChange={handleFramingChange}
            disabled={insertionsRemoved}
          />
          Рамки вставок
        </Label>
        <Label className={cn(insertionsRemoved && "text-foreground/50")}>
          <Checkbox
            checked={
              insertionsRemoved ? false : (dxConfig.insertionLabeling ?? false)
            }
            onCheckedChange={handleLabelingChange}
            disabled={insertionsRemoved}
          />
          Метки вставок
        </Label>
        <Label className={cn(insertionsRemoved && "text-foreground/50")}>
          <Checkbox
            checked={
              insertionsRemoved ? false : (dxConfig.insertionDataInDom ?? false)
            }
            onCheckedChange={handleDataInDomChange}
            disabled={insertionsRemoved}
          />
          <code className="text-xs whitespace-nowrap">bn-insertion-*-data</code>
        </Label>
      </div>
    </div>
  );
}

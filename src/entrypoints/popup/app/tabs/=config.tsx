import * as React from "react";

import { Label } from "@/components/ui/label";
import {
  useNextStaticListSummary,
  useStaticListItems,
  useStaticListSummary,
} from "@/hooks/static-lists-service";
import { useUserConfig } from "@/hooks/user-service";
import {
  type HexColor,
  hexColorSchema,
  type TagId,
} from "@/lib/primitive-values";
import { userService } from "@/lib/proxy-services";
import { cn } from "@/lib/utils";
import { fallbackHexColor } from "@/services/affiliation-service";

import { Checkbox } from "../../../../components/ui/checkbox";
import { Reset } from "./=config/reset";
import { CollectingCommentsCheckbox, UpdatableCount } from "./helpers";

function ColorOverridePicker({
  colorOverride,
  defaultColor,

  onOverrideChange,
  tagId,
}: {
  colorOverride: HexColor | undefined;
  defaultColor: HexColor;
  onOverrideChange: ({
    tagId,
    colorOverride,
  }: {
    tagId: TagId;
    colorOverride: HexColor | undefined;
  }) => void;
  tagId: TagId;
}) {
  const [inputValue, setInputValue] = React.useState(colorOverride ?? "");

  const [oldOverride, setOldOverride] = React.useState(colorOverride);
  if (oldOverride !== colorOverride) {
    setOldOverride(colorOverride);
    setInputValue(colorOverride ?? "");
  }

  const inputValueResult = hexColorSchema.safeParse(
    inputValue.trim().toLowerCase(),
  );

  const colorPickerValue = inputValueResult.data ?? defaultColor;

  const onColorPick = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const rawColor = event.target.value;
      const colorResult = hexColorSchema.safeParse(rawColor);

      onOverrideChange({
        tagId,
        colorOverride: colorResult.success ? colorResult.data : undefined,
      });
    },
    [tagId, onOverrideChange],
  );

  const submitColorOverride = React.useCallback(() => {
    const newColorOverride =
      colorPickerValue === defaultColor ? undefined : colorPickerValue;

    onOverrideChange({
      tagId,
      colorOverride: newColorOverride,
    });

    setInputValue(newColorOverride ?? "");
    setOldOverride(newColorOverride);
  }, [colorPickerValue, defaultColor, onOverrideChange, tagId]);

  return (
    <div className="flex flex-none shrink items-center gap-1.5">
      <input
        type="color"
        value={colorPickerValue}
        className={cn(
          `
            relative inline-flex size-4 flex-none overflow-hidden rounded-full
            border p-0 u-ring
            [&::-moz-color-swatch]:absolute [&::-moz-color-swatch]:inset-0
            [&::-moz-color-swatch]:size-full [&::-moz-color-swatch]:rounded-full
            [&::-moz-color-swatch]:border-none [&::-moz-color-swatch]:p-0
            [&::-moz-color-swatch-wrapper]:absolute
            [&::-moz-color-swatch-wrapper]:inset-0
            [&::-moz-color-swatch-wrapper]:size-full
            [&::-moz-color-swatch-wrapper]:p-0
            [&::-webkit-color-swatch]:absolute [&::-webkit-color-swatch]:inset-0
            [&::-webkit-color-swatch]:size-full
            [&::-webkit-color-swatch]:rounded-full
            [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch]:p-0
            [&::-webkit-color-swatch-wrapper]:absolute
            [&::-webkit-color-swatch-wrapper]:inset-0
            [&::-webkit-color-swatch-wrapper]:size-full
            [&::-webkit-color-swatch-wrapper]:p-0
          `,
          colorPickerValue === defaultColor
            ? "border-input"
            : "border-foreground",
        )}
        onChange={onColorPick}
      />

      <input
        className="
          w-15.5 rounded-xs p-px font-mono placeholder-muted-foreground u-ring
          focus:placeholder-muted-foreground/30
        "
        onChange={(event) => {
          setInputValue(event.target.value);
        }}
        onBlur={submitColorOverride}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            submitColorOverride();
            event.currentTarget.select();
          }
        }}
        placeholder={defaultColor}
        type="text"
        value={inputValue}
      />
    </div>
  );
}

export function ConfigTabBody() {
  const userConfig = useUserConfig();
  const tags = useStaticListItems("tags");
  const accountListSummary = useStaticListSummary("accounts");
  const nextAccountListSummary = useNextStaticListSummary("accounts");

  const tagsToShow = tags.filter((tag) => tag.type === "accountCategory");

  const handleTagVisibilityClick = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- data-tag-id is set in a loop
      const tagId = event.currentTarget.dataset["tagId"] as TagId;

      const {
        [tagId]: override = {},
        ...tagOverrideLookupWithoutCurrentOverride
      } = userConfig.tagOverrideLookup;

      const { hidden, ...overrideWithoutHidden } = override;

      const newOverride = {
        ...overrideWithoutHidden,
        ...(hidden ? {} : { hidden: true }),
      };

      const newOverrideHasKeys = Object.keys(newOverride).length > 0;

      void userService.setConfig({
        ...userConfig,
        tagOverrideLookup: {
          ...tagOverrideLookupWithoutCurrentOverride,
          ...(newOverrideHasKeys ? { [tagId]: newOverride } : {}),
        },
      });
    },
    [userConfig],
  );

  const handleColorOverrideChange = React.useCallback(
    ({
      tagId,
      colorOverride,
    }: {
      tagId: TagId;
      colorOverride: HexColor | undefined;
    }) => {
      const { [tagId]: override, ...tagOverrideLookupWithoutCurrentOverride } =
        userConfig.tagOverrideLookup;

      const { color, ...overrideWithoutColor } = override ?? {};

      const newOverride = {
        ...overrideWithoutColor,
        ...(colorOverride ? { color: colorOverride } : {}),
      };

      const newOverrideHasKeys = Object.keys(newOverride).length > 0;

      void userService.setConfig({
        ...userConfig,
        tagOverrideLookup: {
          ...tagOverrideLookupWithoutCurrentOverride,
          ...(newOverrideHasKeys ? { [tagId]: newOverride } : {}),
        },
      });
    },
    [userConfig],
  );

  return (
    <div className="space-y-5 px-3 pt-3 text-sm">
      <Label>
        <Checkbox
          checked={userConfig.likesDisplay === "table"}
          onClick={() => {
            void userService.setConfig({
              ...userConfig,
              likesDisplay:
                userConfig.likesDisplay === "table" ? "default" : "table",
            });
          }}
        />
        Табличный вид лайков в окне
      </Label>

      <div className="space-y-1">
        {tagsToShow.map((tag) => {
          const override = userConfig.tagOverrideLookup[tag.id] ?? {};

          const visible = tag.visibilityLock ?? !override.hidden;

          return (
            <div key={tag.id} className="flex items-center gap-1">
              <ColorOverridePicker
                colorOverride={override.color}
                defaultColor={tag.color ?? fallbackHexColor}
                onOverrideChange={handleColorOverrideChange}
                tagId={tag.id}
              />

              <Label className="ml-2 flex-1">
                <Checkbox
                  disabled={tag.visibilityLock}
                  checked={visible}
                  data-tag-id={tag.id}
                  onClick={handleTagVisibilityClick}
                />

                <span className="flex-1 truncate">{tag.name}</span>
              </Label>
              <UpdatableCount
                className="text-muted-foreground"
                count={
                  accountListSummary.itemCount > 0
                    ? accountListSummary.itemCountByTagId[tag.id]
                    : undefined
                }
                nextCount={
                  nextAccountListSummary.itemCount > 0
                    ? (nextAccountListSummary.itemCountByTagId[tag.id] ?? 0)
                    : undefined
                }
              />
            </div>
          );
        })}
      </div>
      <CollectingCommentsCheckbox />
      <Reset />
    </div>
  );
}

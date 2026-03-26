import * as React from "react";

import { fallbackHexColor } from "@/shared/@model/account-affiliation";
import {
  type HexColor,
  hexColorSchema,
  type TagId,
} from "@/shared/@primitives/misc";
import {
  useRemoteStagingStaticListSummary,
  useStaticListItems,
  useStaticListSummary,
  useUserConfig,
} from "@/shared/@ui-helpers/data-hooks";
import { Checkbox } from "@/shared/@ui-primitives/checkbox";
import { Label } from "@/shared/@ui-primitives/label";
import { omitUndefined } from "@/shared/omit-undefined";
import { userConfigService } from "@/shared/proxy-services";
import { cn } from "@/shared/tailwindcss-helpers";

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

  function onColorPick(event: React.ChangeEvent<HTMLInputElement>) {
    const rawColor = event.target.value;
    const colorResult = hexColorSchema.safeParse(rawColor);

    onOverrideChange({
      tagId,
      colorOverride: colorResult.success ? colorResult.data : undefined,
    });
  }

  function submitColorOverride() {
    const newColorOverride =
      colorPickerValue === defaultColor ? undefined : colorPickerValue;

    onOverrideChange({
      tagId,
      colorOverride: newColorOverride,
    });

    setInputValue(newColorOverride ?? "");
    setOldOverride(newColorOverride);
  }

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
  const stagingAccountListSummary =
    useRemoteStagingStaticListSummary("accounts");

  const tagsToShow = tags.filter((tag) => tag.type === "accountCategory");

  function changeTagVisibility(tagId: TagId, visible: boolean) {
    const {
      [tagId]: override = {},
      ...tagOverrideLookupWithoutCurrentOverride
    } = userConfig.tagOverrideLookup;

    const { hidden, ...overrideWithoutHidden } = override;

    const newOverride = {
      ...overrideWithoutHidden,
      ...(visible ? {} : { hidden: true }),
    };

    const newOverrideHasKeys = Object.keys(newOverride).length > 0;

    void userConfigService.set({
      ...userConfig,
      tagOverrideLookup: {
        ...tagOverrideLookupWithoutCurrentOverride,
        ...(newOverrideHasKeys ? { [tagId]: newOverride } : {}),
      },
    });
  }

  function handleColorOverrideChange({
    tagId,
    colorOverride,
  }: {
    tagId: TagId;
    colorOverride: HexColor | undefined;
  }) {
    const { [tagId]: override, ...tagOverrideLookupWithoutCurrentOverride } =
      userConfig.tagOverrideLookup;

    const { colorForHighlight, ...overrideWithoutColor } = override ?? {};

    const newOverride = omitUndefined({
      ...overrideWithoutColor,
      colorForHighlight: colorOverride,
    });

    const newOverrideHasKeys = Object.keys(newOverride).length > 0;

    void userConfigService.set({
      ...userConfig,
      tagOverrideLookup: {
        ...tagOverrideLookupWithoutCurrentOverride,
        ...(newOverrideHasKeys ? { [tagId]: newOverride } : {}),
      },
    });
  }

  return (
    <div className="space-y-5 px-3 pt-3 text-sm">
      <Label>
        <Checkbox
          checked={userConfig.fansDisplay === "table"}
          onCheckedChange={(checked) => {
            void userConfigService.set({
              ...userConfig,
              fansDisplay: checked ? "table" : "default",
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
                colorOverride={override.colorForHighlight}
                defaultColor={tag.colorForHighlight ?? fallbackHexColor}
                onOverrideChange={handleColorOverrideChange}
                tagId={tag.id}
              />

              <Label className="ml-2 flex-1">
                <Checkbox
                  disabled={tag.visibilityLock}
                  checked={visible}
                  onCheckedChange={(checked) => {
                    changeTagVisibility(tag.id, checked);
                  }}
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
                stagingCount={
                  (stagingAccountListSummary?.itemCount ?? 0) > 0
                    ? (stagingAccountListSummary?.itemCountByTagId[tag.id] ?? 0)
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

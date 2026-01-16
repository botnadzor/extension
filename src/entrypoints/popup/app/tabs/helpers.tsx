import { produce } from "immer";
import { InfoIcon } from "lucide-react";

import {
  useAuthStatus,
  useFrontendBaseUrl,
  useUserConfig,
} from "@/shared/@ui-helpers/data-hooks";
import { Checkbox } from "@/shared/@ui-primitives/checkbox";
import { Label } from "@/shared/@ui-primitives/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/@ui-primitives/tooltip";
import { formatInt } from "@/shared/formatting";
import { userConfigService } from "@/shared/proxy-services";
import { cn } from "@/shared/tailwindcss-helpers";

export function CollectingCommentsCheckbox() {
  const userConfig = useUserConfig();
  const authStatus = useAuthStatus();
  const frontendBaseUrl = useFrontendBaseUrl();

  function handleCollectingCommentsChange() {
    void userConfigService.set(
      produce(userConfig, (draft) => {
        if (draft.collectingComments === undefined) {
          draft.collectingComments = true;
        } else {
          delete draft.collectingComments;
        }
      }),
    );
  }

  if (authStatus.state !== "valid") {
    return;
  }

  return (
    <Label>
      <Checkbox
        checked={userConfig.collectingComments ?? false}
        onClick={handleCollectingCommentsChange}
      />
      Сбор и отправка комментаторов
      <a
        href={`${frontendBaseUrl}/docs/extension#replies-collecting`}
        target="_blank"
        rel="noopener noreferrer"
        className="u-link rounded-full"
      >
        <InfoIcon className="size-4" />
      </a>
    </Label>
  );
}

export function UpdatableCount({
  className,
  count,
  nextCount,
}: {
  className?: string | undefined;
  count: number | undefined;
  nextCount: number | undefined;
  wrapper?: undefined | "parentheses";
}) {
  if (count === undefined && nextCount === undefined) {
    return;
  }

  const formattedCount =
    typeof count === "number" ? formatInt(count) : undefined;

  const formattedNextCount =
    typeof nextCount === "number" ? formatInt(nextCount) : undefined;

  const countToShow = formattedCount ?? formattedNextCount;

  if (nextCount === undefined) {
    return <span className={cn("tabular-nums", className)}>{countToShow}</span>;
  }
  return (
    <Tooltip>
      <TooltipTrigger className={cn("cursor-help tabular-nums", className)}>
        {countToShow}
      </TooltipTrigger>
      <TooltipContent className="tabular-nums">
        {count === undefined
          ? "Данные обрабатываются"
          : `Данные обновляются: ${formattedNextCount}`}
      </TooltipContent>
    </Tooltip>
  );
}

import { produce } from "immer";
import { InfoIcon } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useFrontendBaseUrl } from "@/hooks/frontend-service";
import { useAuthStatus, useUserConfig } from "@/hooks/user-service";
import { userService } from "@/lib/proxy-services";
import { cn } from "@/lib/utils";

export function CollectingCommentsCheckbox() {
  const userConfig = useUserConfig();
  const authStatus = useAuthStatus();
  const frontendBaseUrl = useFrontendBaseUrl();

  function handleCollectingCommentsChange() {
    void userService.setConfig(
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
    typeof count === "number" ? count.toLocaleString("ru-RU") : undefined;

  const formattedNextCount =
    typeof nextCount === "number"
      ? nextCount.toLocaleString("ru-RU")
      : undefined;

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

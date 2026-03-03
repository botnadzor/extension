import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/@ui-primitives/tooltip";

export function OptionalMark({
  mark,
  markTitle,
  markColor,
}: {
  mark?: string | undefined;
  markTitle?: string | undefined;
  markColor?: string | undefined;
}) {
  if (!mark) {
    return;
  }

  const markElement = (
    <div
      className="
        rounded-full bg-gray-200 px-2 text-xs whitespace-nowrap text-black
      "
      style={{ background: markColor }}
    >
      {mark}
    </div>
  );

  if (!markTitle) {
    return markElement;
  }

  return (
    <Tooltip>
      <TooltipTrigger render={markElement} />
      <TooltipContent>{markTitle}</TooltipContent>
    </Tooltip>
  );
}

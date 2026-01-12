import { XIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import type { IsoTime } from "@/lib/primitive-values";
import { useAnimate } from "@/lib/use-animate";
import { cn } from "@/lib/utils";

export function Toast({
  children,
  childrenWrapperClassName,
  extensionName = "default",
  header,
  onClose,
  triggeredAt,
}: {
  children: React.ReactNode;
  childrenWrapperClassName?: string | undefined;
  extensionName?: "short" | "default";
  header?: React.ReactNode;
  onClose?: (() => void) | undefined;
  triggeredAt?: IsoTime | undefined;
}) {
  const [triggeredForTheFirstTime, setTriggeredForTheFirstTime] =
    React.useState(true);
  const [lastTriggeredAt, setLastTriggeredAt] = React.useState<
    IsoTime | undefined
  >(triggeredAt);

  const { animationClassName, animate } = useAnimate();

  if (lastTriggeredAt !== triggeredAt) {
    setTriggeredForTheFirstTime(false);
    setLastTriggeredAt(triggeredAt);
    animate("bounce");
  }

  return (
    <div
      className={cn(
        `
          dark-theme fixed inset-x-2.5 bottom-2.5 z-999999 rounded-lg
          bg-background/85 p-4 text-foreground shadow-md backdrop-blur-xs
          sm:w-[320px]
        `,
        triggeredForTheFirstTime && "animate-in duration-100 fade-in zoom-in",
        animationClassName,
      )}
    >
      <div className="flex items-center gap-2.5 pb-2.5 font-play text-xs">
        {extensionName === "short" ? "Ботнадзор" : "Ботнадзор: подсветка ботов"}
      </div>
      {onClose && (
        <Button
          className="absolute top-0.5 right-0.5"
          size="iconSm"
          type="button"
          variant="ghost"
          onClick={onClose}
        >
          <XIcon />
        </Button>
      )}

      {Boolean(header) && (
        <h1 className="pb-2 text-base text-pretty">{header}</h1>
      )}

      <div
        className={cn(
          `
            text-sm
            [&_a]:text-primary
          `,
          childrenWrapperClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}

"use client";

import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";

import { cn } from "../tailwindcss-helpers";

function TooltipProvider({
  delay = 0,
  ...props
}: TooltipPrimitive.Provider.Props) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delay={delay}
      {...props}
    />
  );
}

function Tooltip({ ...props }: TooltipPrimitive.Root.Props) {
  return (
    <TooltipProvider>
      <TooltipPrimitive.Root data-slot="tooltip" {...props} />
    </TooltipProvider>
  );
}

function TooltipTrigger({ ...props }: TooltipPrimitive.Trigger.Props) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

function TooltipContent({
  className,
  side = "top",
  sideOffset = 0,
  align,
  alignOffset,
  children,
  ...props
}: TooltipPrimitive.Popup.Props &
  Pick<
    TooltipPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset"
  >) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        className="isolate z-999999"
      >
        <TooltipPrimitive.Popup
          data-slot="tooltip-content"
          className={cn(
            `
              z-999999 w-fit max-w-xs origin-(--transform-origin) rounded-md
              bg-foreground px-3 py-1.5 text-xs text-balance text-background
              data-closed:animate-out data-closed:fade-out-0
              data-closed:zoom-out-95
              data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95
              data-[side=bottom]:slide-in-from-top-2
              data-[side=left]:slide-in-from-right-2
              data-[side=right]:slide-in-from-left-2
              data-[side=top]:slide-in-from-bottom-2
            `,
            className,
          )}
          {...props}
        >
          {children}
          <TooltipPrimitive.Arrow
            className="
              size-2.5 translate-y-[calc(-50%-2px)] rotate-45 rounded-[2px]
              bg-foreground fill-foreground
              data-[side=bottom]:top-1
              data-[side=left]:top-1/2! data-[side=left]:-right-1
              data-[side=left]:-translate-y-1/2
              data-[side=right]:top-1/2! data-[side=right]:-left-1
              data-[side=right]:-translate-y-1/2
              data-[side=top]:-bottom-2.5
            "
          />
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };

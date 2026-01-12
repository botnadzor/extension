"use client";

import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import type * as React from "react";

import { cn } from "@/lib/utils";

function ScrollBar({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>) {
  return (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      data-slot="scroll-area-scrollbar"
      orientation={orientation}
      className={cn(
        "flex touch-none p-px transition-colors select-none",
        orientation === "vertical" &&
          "h-full w-3 border-x border-r border-x-transparent",
        orientation === "horizontal" &&
          "h-3 flex-col border-y border-y-transparent",
        className,
      )}
      {...props}
    >
      <ScrollAreaPrimitive.ScrollAreaThumb
        data-slot="scroll-area-thumb"
        className="relative flex-1 rounded-full bg-border"
      />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  );
}

function ScrollArea({
  className,
  children,
  scrollBar,
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.Root> & {
  scrollBar?: React.ReactNode;
}) {
  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      className={cn("relative", className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        data-slot="scroll-area-viewport"
        className="
          size-full rounded-[inherit] u-no-ring transition-[color,box-shadow]
        "
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      {scrollBar ?? <ScrollBar />}
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
}

export { ScrollArea, ScrollBar };

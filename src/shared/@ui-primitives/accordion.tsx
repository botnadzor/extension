"use client";

import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion";
import { ChevronDownIcon } from "lucide-react";

import { cn } from "../tailwindcss-helpers";

function Accordion({
  multiple = true,
  className,
  ...props
}: AccordionPrimitive.Root.Props) {
  return (
    <AccordionPrimitive.Root
      data-slot="accordion"
      multiple={multiple}
      className={cn("space-y-2", className)}
      {...props}
    />
  );
}

function AccordionItem({ className, ...props }: AccordionPrimitive.Item.Props) {
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={cn("rounded-md border-none", className)}
      {...props}
    />
  );
}

function AccordionTrigger({
  className,
  children,
  ...props
}: AccordionPrimitive.Trigger.Props) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(
          `
            flex flex-1 items-center justify-between rounded-md bg-muted px-3
            py-2.5 font-medium text-foreground u-ring transition-all
            hover:no-underline
            focus-visible:text-foreground
            disabled:opacity-50
            [&:focus-visible>svg]:text-foreground
            [&:hover>svg]:text-foreground
            [&>svg]:text-foreground/50
            [&[aria-expanded=true]>svg]:rotate-180
          `,
          className,
        )}
        {...props}
      >
        {children}
        <ChevronDownIcon
          className="
            mr-px size-4 shrink-0 transition-all duration-200
            in-data-disabled:hidden
          "
        />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

function AccordionContent({
  className,
  childClassName,
  children,
  ...props
}: AccordionPrimitive.Panel.Props & {
  childClassName?: string;
}) {
  return (
    <AccordionPrimitive.Panel
      data-slot="accordion-content"
      className={cn(
        `
          h-(--accordion-panel-height) overflow-hidden text-sm
          transition-[height] duration-200 ease-out
          data-ending-style:h-0
          data-starting-style:h-0
        `,
        className,
      )}
      {...props}
    >
      <div className={cn("px-3 pt-2 pb-4", childClassName)}>{children}</div>
    </AccordionPrimitive.Panel>
  );
}

export { Accordion, AccordionContent, AccordionItem, AccordionTrigger };

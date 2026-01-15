"use client";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { ChevronDownIcon } from "lucide-react";

import { cn } from "../tailwindcss-helpers";

function Accordion({
  className,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Root>) {
  return (
    <AccordionPrimitive.Root
      className={cn("space-y-2", className)}
      {...props}
    />
  );
}

function AccordionItem({
  className,
  ...props
}: AccordionPrimitive.AccordionItemProps) {
  return (
    <AccordionPrimitive.Item
      className={cn("rounded-md border-none", className)}
      {...props}
    />
  );
}

function AccordionTrigger({
  className,
  children,
  ...props
}: AccordionPrimitive.AccordionTriggerProps) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
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
            [&[data-state=open]>svg]:rotate-180
          `,
          className,
        )}
        {...props}
      >
        {children}
        <ChevronDownIcon
          className="
            size-4 shrink-0 transition-all duration-200
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
}: React.ComponentProps<typeof AccordionPrimitive.Content> & {
  childClassName?: string;
}) {
  return (
    <AccordionPrimitive.Content
      className={cn(
        `
          overflow-hidden text-sm transition-all
          data-[state=closed]:animate-accordion-up
          data-[state=open]:animate-accordion-down
        `,
        className,
      )}
      {...props}
    >
      <div className={cn("px-3 pt-2 pb-4", childClassName)}>{children}</div>
    </AccordionPrimitive.Content>
  );
}

export { Accordion, AccordionContent, AccordionItem, AccordionTrigger };

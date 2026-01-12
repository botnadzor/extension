"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import type * as React from "react";

import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

export const tabListClassName =
  "inline-flex flex-wrap items-center justify-center rounded-md bg-muted p-1 text-muted-foreground";

export const tabsTriggerClassName =
  "inline-flex flex-1 items-center justify-center whitespace-nowrap rounded-xs px-3 py-1.5 text-sm ring-offset-background transition-all focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs";

function TabsList({
  ref,
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      ref={ref}
      className={cn(tabListClassName, className)}
      {...props}
    />
  );
}

function TabsTrigger({
  ref,
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(tabsTriggerClassName, className)}
      {...props}
    />
  );
}

function TabsContent({
  ref,
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      ref={ref}
      className={cn("mt-2 u-no-ring", className)}
      {...props}
    />
  );
}

export { Tabs, TabsContent, TabsList, TabsTrigger };

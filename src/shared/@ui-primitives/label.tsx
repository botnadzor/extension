"use client";

import type * as React from "react";

import { cn } from "../tailwindcss-helpers";

function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    // eslint-disable-next-line jsx-a11y/label-has-associated-control -- Label wraps controls (e.g. Checkbox) via children
    <label
      data-slot="label"
      className={cn(
        `
          flex items-center gap-2 text-sm leading-none font-medium select-none
          group-data-[disabled=true]:pointer-events-none
          group-data-[disabled=true]:opacity-50
          peer-disabled:cursor-not-allowed peer-disabled:opacity-50
          peer-aria-disabled:cursor-not-allowed peer-aria-disabled:opacity-50
          peer-data-disabled:cursor-not-allowed peer-data-disabled:opacity-50
        `,
        className,
      )}
      {...props}
    />
  );
}

export { Label };

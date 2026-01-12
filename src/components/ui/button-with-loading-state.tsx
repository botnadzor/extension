import { LoaderCircleIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import { Button } from "./button";

export function ButtonWithLoadingState({
  className,
  children,
  disabled,
  loading,
  ...props
}: React.ComponentProps<"button"> & { loading: boolean }) {
  return (
    <Button
      className={cn(className, "relative")}
      disabled={loading || disabled}
      {...props}
    >
      <span className={cn("flex items-center gap-2", loading && "opacity-0")}>
        {children}
      </span>
      {loading && (
        <span
          className="
            absolute inset-0 flex items-center justify-center
            text-primary-foreground
          "
        >
          <LoaderCircleIcon className="size-4 animate-spin" />
        </span>
      )}
    </Button>
  );
}

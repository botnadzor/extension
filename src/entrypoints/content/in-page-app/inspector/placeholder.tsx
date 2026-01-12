import { cn } from "@/lib/utils";

export function Placeholder({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string | undefined;
}) {
  return (
    <div
      className={cn(
        `
          absolute inset-3 top-2 flex items-center justify-center rounded-md
          bg-muted text-sm text-muted-foreground
        `,
        className,
      )}
    >
      {children}
    </div>
  );
}

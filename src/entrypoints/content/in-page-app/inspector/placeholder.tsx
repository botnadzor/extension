import { cn } from "@/shared/tailwindcss-helpers";

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
          absolute inset-3 top-1.75 flex items-center justify-center rounded-md
          bg-muted px-10 text-center text-sm text-muted-foreground
        `,
        className,
      )}
    >
      {children}
    </div>
  );
}

import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../tailwindcss-helpers";

const buttonVariants = cva(
  [
    `
      inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm
      font-medium whitespace-nowrap u-ring transition-all outline-none
      disabled:pointer-events-none disabled:opacity-50
      aria-invalid:border-destructive aria-invalid:ring-destructive/20
      dark:aria-invalid:ring-destructive/40
      [&_svg]:pointer-events-none [&_svg]:shrink-0
    `,
  ],
  {
    variants: {
      variant: {
        default: `
          bg-primary text-primary-foreground shadow-xs
          hover:bg-primary/90
        `,
        destructive: `
          bg-destructive text-white shadow-xs
          hover:bg-destructive/90
          focus-visible:ring-destructive/20
          dark:bg-destructive/60
          dark:focus-visible:ring-destructive/40
        `,
        outline: `
          border border-border bg-background shadow-xs
          hover:bg-accent hover:text-accent-foreground
          dark:border-input dark:bg-input/30
          dark:hover:bg-input/50
        `,
        secondary: `
          bg-secondary text-secondary-foreground shadow-xs
          hover:bg-secondary/80
        `,
        ghost: `
          hover:bg-accent hover:text-accent-foreground
          dark:hover:bg-accent/50
        `,
        link: `
          text-primary underline-offset-4
          hover:underline
        `,
      },
      size: {
        default: `
          h-9 px-4 py-2
          has-[>svg]:px-3
          [&_svg:not([class*=size-])]:size-5
        `,
        sm: `
          h-8 gap-1.5 rounded-md px-3
          has-[>svg]:px-2.5
          [&_svg:not([class*=size-])]:size-4
        `,
        lg: `
          h-10 rounded-md px-6
          has-[>svg]:px-4
          [&_svg:not([class*=size-])]:size-6
        `,
        icon: `
          size-9
          [&_svg:not([class*=size-])]:size-5
        `,
        iconSm: `
          size-8
          [&_svg:not([class*=size-])]:size-4
        `,
        iconXs: `
          size-7
          [&_svg:not([class*=size-])]:size-4
        `,
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  type,
  ...props
}: Omit<ButtonPrimitive.Props, "type"> &
  VariantProps<typeof buttonVariants> & {
    type?: "submit" | undefined;
  }) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      type={type ?? "button"}
      {...props}
    />
  );
}

export { Button, buttonVariants };

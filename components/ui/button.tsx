import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";

// DESIGN.md: black fill for the one main action, black outline for the rest, never blue, no shadows.
const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-pill border border-carbon font-bold tracking-[0.03em] whitespace-nowrap transition-[transform,background-color] duration-200 ease-out-expo active:not-disabled:scale-[0.97] disabled:cursor-not-allowed disabled:border-[#999] disabled:bg-mist disabled:text-[#555] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        solid: "bg-carbon text-paper hover:not-disabled:bg-[#1f1f1f]",
        outline: "bg-paper text-carbon hover:not-disabled:bg-mist",
      },
      size: {
        md: "min-h-11 px-[18px] py-3 text-sm",
        sm: "min-h-9 px-3.5 py-2 text-[13px]",
      },
    },
    defaultVariants: { variant: "solid", size: "md" },
  },
);

function Button({
  className,
  variant,
  size,
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };

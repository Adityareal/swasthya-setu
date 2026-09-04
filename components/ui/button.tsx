import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Slot } from "radix-ui"

/**
 * Enamel-plate button. Three edits carry the identity and they are made here,
 * once, rather than at every call site: `rounded-plate`, a hard zero-blur
 * offset shadow, `border-2 border-line`, `min-h-touch` (Req 2.3 is a floor),
 * and the pressed state that translates the plate into its own shadow.
 */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-plate border-2 border-line bg-clip-padding font-semibold whitespace-nowrap shadow-plate transition-all duration-(--ss-dur-fast) ease-(--ss-ease) outline-none select-none min-h-touch active:translate-x-[2px] active:translate-y-[2px] active:shadow-[var(--ss-elev-pressed)] disabled:pointer-events-none disabled:border-line-soft disabled:bg-sunk disabled:text-ink-muted disabled:shadow-none aria-invalid:border-high [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        default: "bg-action text-action-fg hover:bg-[color-mix(in_srgb,var(--ss-action),var(--ss-ink)_14%)]",
        outline:
          "bg-surface text-ink hover:bg-sunk aria-expanded:bg-sunk",
        secondary: "bg-sunk text-ink hover:bg-[color-mix(in_srgb,var(--ss-sunk),var(--ss-ink)_8%)]",
        ghost:
          "border-transparent bg-transparent shadow-none hover:bg-sunk active:shadow-none",
        destructive:
          "bg-high text-white hover:bg-[color-mix(in_srgb,var(--ss-high),var(--ss-ink)_14%)]",
        low: "bg-low text-white hover:bg-[color-mix(in_srgb,var(--ss-low),var(--ss-ink)_14%)]",
        chrome: "bg-chrome text-chrome-fg border-line hover:bg-[color-mix(in_srgb,var(--ss-chrome),#fff_10%)]",
        link: "border-transparent bg-transparent text-action underline underline-offset-4 shadow-none active:shadow-none",
      },
      size: {
        /* 44px floor everywhere; 56px on primary field actions. */
        default: "min-h-touch px-4 py-2 text-field",
        sm: "min-h-touch px-3 py-1.5 text-body",
        lg: "min-h-touch-lg px-5 py-3 text-title",
        field: "min-h-touch-lg w-full px-5 py-3 text-title",
        icon: "size-touch p-0",
        "icon-lg": "size-touch-lg p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }

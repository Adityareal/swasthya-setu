import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Slot } from "radix-ui"

const badgeVariants = cva(
  "group/badge inline-flex w-fit shrink-0 items-center justify-center gap-1 rounded-chip border-2 border-line px-2 py-0.5 text-caption font-semibold whitespace-nowrap transition-all [&>svg]:pointer-events-none [&>svg]:size-3.5!",
  {
    variants: {
      variant: {
        default: "bg-action text-action-fg",
        secondary: "bg-sunk text-ink",
        destructive: "bg-high text-white",
        /* Ochre is a FILL with ink on top, never a foreground. */
        medium: "bg-med text-ink",
        low: "bg-low text-white",
        outline: "bg-surface text-ink",
        ghost: "border-transparent bg-transparent text-ink-muted",
        chrome: "border-chrome-muted bg-chrome-muted text-chrome",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }

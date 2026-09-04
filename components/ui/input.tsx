import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Sunk input on a light ground. 18px text floor — `md:text-sm` is removed
 * deliberately: nothing drops below 18px in the primary field flows, and a
 * sub-16px input also triggers iOS zoom-on-focus.
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "min-h-touch w-full min-w-0 rounded-plate border-2 border-line bg-sunk px-3 py-2 text-field text-ink transition-colors outline-none placeholder:text-ink-muted disabled:pointer-events-none disabled:cursor-not-allowed disabled:border-line-soft disabled:text-ink-muted aria-invalid:border-high aria-invalid:border-[3px]",
        className
      )}
      {...props}
    />
  )
}

export { Input }

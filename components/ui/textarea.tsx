import * as React from "react"
import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-touch-lg w-full rounded-plate border-2 border-line bg-sunk px-3 py-2 text-field text-ink transition-colors outline-none placeholder:text-ink-muted disabled:cursor-not-allowed disabled:border-line-soft disabled:text-ink-muted aria-invalid:border-high aria-invalid:border-[3px]",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }

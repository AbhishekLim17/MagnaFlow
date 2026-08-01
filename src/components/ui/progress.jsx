import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"
import { cn } from "@/lib/utils"

/**
 * @param {string} [tone] 'primary' | 'success' | 'warning' | 'destructive'
 *   Lets a bar carry meaning (over quota, at risk) without each caller
 *   inventing its own colour.
 */
const TONES = {
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  destructive: 'bg-destructive',
}

const Progress = React.forwardRef(({ className, value, tone = 'primary', ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn("relative h-2 w-full overflow-hidden rounded-full bg-muted", className)}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className={cn(
        "h-full w-full flex-1 rounded-full transition-transform duration-500 ease-premium",
        TONES[tone] || TONES.primary
      )}
      style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
    />
  </ProgressPrimitive.Root>
))
Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }

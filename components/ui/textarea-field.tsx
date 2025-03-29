import * as React from "react"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

interface TextareaFieldProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  description?: string
  fontSize?: "sm" | "base" | "lg" | "xl"
}

export const TextareaField = React.forwardRef<HTMLTextAreaElement, TextareaFieldProps>(
  ({ label, description, fontSize = "base", className, ...props }, ref) => {
    const fontSizeMap = {
      sm: "text-sm",
      base: "text-base",
      lg: "text-lg",
      xl: "text-xl"
    }

    return (
      <div className="grid w-full gap-2">
        {label && <Label className="text-muted-foreground">{label}</Label>}
        <Textarea
          ref={ref}
          className={cn(
            "rounded-2xl border border-gray-300 bg-white p-4 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200",
            fontSizeMap[fontSize],
            className
          )}
          {...props}
        />
        {description && (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        )}
      </div>
    )
  }
)

TextareaField.displayName = "TextareaField"

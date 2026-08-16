import * as React from "react"

import { cn } from "@/lib/utils"

/** @type {React.ForwardRefExoticComponent<import("react").InputHTMLAttributes<HTMLInputElement>>} */
const Input = React.forwardRef(({ className, type, ...props }, ref) => {
    return (
        (<input
            type={type}
            className={cn(
                "flex h-11 w-full rounded-xl border border-input bg-card/75 px-3.5 py-2 text-sm shadow-[inset_0_1px_1px_hsl(var(--foreground)/0.025)] transition-[color,background-color,border-color,box-shadow] duration-200 file:border-0 file:bg-transparent file:text-sm file:font-semibold file:text-foreground placeholder:text-muted-foreground/70 hover:border-border focus-visible:outline-none focus-visible:border-primary/70 focus-visible:bg-card focus-visible:ring-2 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50",
                className
            )}
            ref={ref}
            {...props} />)
    );
})
Input.displayName = "Input"

export { Input }

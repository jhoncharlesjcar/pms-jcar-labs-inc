import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const buttonVariants = cva(
    "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-transparent text-sm font-semibold leading-none transition-[color,background-color,border-color,box-shadow,transform] duration-200 active:scale-[0.98] active:duration-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 select-none",
    {
        variants: {
            variant: {
                default:
                    "border-primary/20 bg-primary text-primary-foreground shadow-[0_2px_4px_hsl(var(--primary)/0.18),0_10px_22px_-14px_hsl(var(--primary)/0.78)] hover:-translate-y-px hover:bg-primary/92 hover:shadow-[0_3px_7px_hsl(var(--primary)/0.2),0_14px_26px_-15px_hsl(var(--primary)/0.8)]",
                destructive:
                    "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 hover:shadow-md",
                outline:
                    "border-border/80 bg-card/80 text-foreground shadow-xs hover:border-border hover:bg-muted/70",
                secondary:
                    "border-border/40 bg-secondary/80 text-secondary-foreground shadow-xs hover:bg-secondary",
                emerald:
                    "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 active:scale-[0.98]",
                amber:
                    "bg-amber-500 text-white shadow-sm hover:bg-amber-600 dark:bg-amber-500 dark:hover:bg-amber-400 active:scale-[0.98]",
                glass:
                    "border-border/60 bg-card/75 text-foreground shadow-xs backdrop-blur-xl hover:bg-card",
                ghost: "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                link: "text-primary underline-offset-4 hover:underline",
            },
            size: {
                xs: "h-8 px-2.5 text-xs",
                sm: "h-9 px-3.5 text-xs",
                default: "h-11 px-4 text-sm",
                lg: "h-12 px-6 text-base font-bold",
                iconSm: "h-9 w-9 p-0",
                icon: "h-11 w-11 p-0",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    }
)

/** @type {React.ForwardRefExoticComponent<import("react").ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean, variant?: any, size?: any }>} */
const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
        (<Comp
            className={cn(buttonVariants({ variant, size, className }))}
            ref={ref}
            {...props} />)
    );
})
Button.displayName = "Button"

export { Button, buttonVariants }

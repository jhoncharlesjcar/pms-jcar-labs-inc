"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

/** @type {React.ForwardRefExoticComponent<any>} */
const DialogOverlay = React.forwardRef(({ className, ...props }, ref) => (
    <DialogPrimitive.Overlay
        ref={ref}
        className={cn(
            "fixed inset-0 z-50 bg-black/65 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-150",
            className
        )}
        {...props} />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

/** @type {React.ForwardRefExoticComponent<any>} */
const DialogContent = React.forwardRef(({ className, children, ...props }, ref) => (
    <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
            ref={ref}
            className={cn(
                "fixed left-[50%] top-[50%] z-50 grid w-[calc(100%-1rem)] sm:w-[calc(100%-2rem)] max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border border-border/60 bg-card/95 backdrop-blur-2xl p-4 sm:p-6 shadow-2xl duration-150 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-[0.98] data-[state=open]:zoom-in-[0.98] data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] rounded-2xl max-h-[85dvh] sm:max-h-[90vh] overflow-y-auto custom-scrollbar",
                className
            )}
            aria-describedby={props["aria-describedby"]}
            {...props}>
            {!props["aria-describedby"] && <DialogPrimitive.Description className="sr-only">Contenido del diálogo</DialogPrimitive.Description>}
            {children}
            <DialogPrimitive.Close
                aria-label="Cerrar ventana emergente"
                className="absolute right-3.5 top-3.5 w-8 h-8 rounded-xl bg-secondary/50 hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary">
                <X className="h-4 w-4" />
                <span className="sr-only">Cerrar</span>
            </DialogPrimitive.Close>
        </DialogPrimitive.Content>
    </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
    className = "",
    ...props
}) => (
    <div
        className={cn("flex flex-col space-y-1.5 text-left", className)}
        {...props} />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
    className = "",
    ...props
}) => (
    <div
        className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 gap-2 pt-2", className)}
        {...props} />
)
DialogFooter.displayName = "DialogFooter"

/** @type {React.ForwardRefExoticComponent<any>} */
const DialogTitle = React.forwardRef(({ className, ...props }, ref) => (
    <DialogPrimitive.Title
        ref={ref}
        className={cn("text-lg sm:text-xl font-bold leading-tight tracking-tight text-foreground", className)}
        {...props} />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

/** @type {React.ForwardRefExoticComponent<any>} */
const DialogDescription = React.forwardRef(({ className, ...props }, ref) => (
    <DialogPrimitive.Description
        ref={ref}
        className={cn("text-xs sm:text-sm text-muted-foreground font-medium", className)}
        {...props} />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
    Dialog,
    DialogPortal,
    DialogOverlay,
    DialogTrigger,
    DialogClose,
    DialogContent,
    DialogHeader,
    DialogFooter,
    DialogTitle,
    DialogDescription,
}
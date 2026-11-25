import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useEffect, useRef } from "react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

/** shadcn's Sonner wrapper, light theme only (no next-themes in this app) */
const Toaster = ({ ...props }: ToasterProps) => {
  // a manual popover sits in the top layer, so toasts stay visible over open modal <dialog>s
  const layer = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = layer.current
    if (!el || typeof el.showPopover !== "function") return
    try { el.showPopover() } catch {}
  }, [])
  return (
    <div ref={layer} popover="manual" data-toast-layer
      className="pointer-events-none inset-0 m-0 size-auto max-h-none max-w-none overflow-visible border-0 bg-transparent p-0 [&>*]:pointer-events-auto">
    <Sonner
      theme="light"
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
    </div>
  )
}

export { Toaster }

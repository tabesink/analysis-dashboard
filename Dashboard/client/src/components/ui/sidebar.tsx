"use client"

/**
 * Sidebar UI Primitives
 * 
 * SOLID Principles:
 * - Single Responsibility: Each component handles one specific UI element
 * - Open/Closed: Extensible through className and props without modification
 * - Dependency Inversion: Uses context for state management
 * 
 * Note: Mobile support intentionally removed for clean, bloat-free code.
 * This sidebar is designed for desktop-only use with fixed icon-only layout.
 */

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { PanelLeft } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

// Constants for sidebar dimensions
const SIDEBAR_COOKIE_NAME = "sidebar_state"
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7
const SIDEBAR_WIDTH = "4rem"  // 64px - icon only, fixed
const SIDEBAR_KEYBOARD_SHORTCUT = "b"

/**
 * Sidebar Context
 * Simplified for fixed icon-only sidebar (no expand/collapse state needed)
 */
type SidebarContextProps = {
  state: "collapsed"  // Always collapsed (icon-only)
}

const SidebarContext = React.createContext<SidebarContextProps>({
  state: "collapsed"
})

function useSidebar() {
  const context = React.useContext(SidebarContext)
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.")
  }
  return context
}

/**
 * SidebarProvider
 * Provides context and wrapper for the sidebar system.
 * Simplified - no toggle functionality needed for fixed sidebar.
 */
const SidebarProvider = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(
  (
    {
      className,
      style,
      children,
      ...props
    },
    ref
  ) => {
    const contextValue = React.useMemo<SidebarContextProps>(
      () => ({
        state: "collapsed"
      }),
      []
    )

    return (
      <SidebarContext.Provider value={contextValue}>
        <TooltipProvider delayDuration={0}>
          <div
            style={
              {
                "--sidebar-width": SIDEBAR_WIDTH,
                ...style,
              } as React.CSSProperties
            }
            className={cn(
              "group/sidebar-wrapper flex min-h-svh w-full bg-background",
              className
            )}
            ref={ref}
            {...props}
          >
            {children}
          </div>
        </TooltipProvider>
      </SidebarContext.Provider>
    )
  }
)
SidebarProvider.displayName = "SidebarProvider"

/**
 * Sidebar
 * Container component for the sidebar.
 * Fixed width, no collapsible behavior.
 */
const Sidebar = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    side?: "left" | "right"
    collapsible?: "none"
  }
>(
  (
    {
      side = "left",
      collapsible = "none",
      className,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          "sticky top-0 flex h-screen w-[--sidebar-width] flex-col bg-sidebar text-sidebar-foreground shrink-0",
          side === "left" ? "border-r border-sidebar-border/50" : "border-l border-sidebar-border/50",
          className
        )}
        data-side={side}
        {...props}
      >
        {children}
      </div>
    )
  }
)
Sidebar.displayName = "Sidebar"

/**
 * SidebarTrigger
 * Toggle button for sidebar. Retained for potential future use.
 */
const SidebarTrigger = React.forwardRef<
  React.ComponentRef<typeof Button>,
  React.ComponentProps<typeof Button>
>(({ className, onClick, ...props }, ref) => {
  return (
    <Button
      ref={ref}
      data-sidebar="trigger"
      variant="ghost"
      size="icon"
      className={cn("h-7 w-7", className)}
      {...props}
    >
      <PanelLeft />
      <span className="sr-only">Toggle Sidebar</span>
    </Button>
  )
})
SidebarTrigger.displayName = "SidebarTrigger"

/**
 * SidebarInset
 * Main content area adjacent to the sidebar.
 */
const SidebarInset = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"main">
>(({ className, ...props }, ref) => {
  return (
    <main
      ref={ref}
      className={cn(
        "relative flex flex-1 min-w-0 flex-col bg-background overflow-x-auto",
        className
      )}
      {...props}
    />
  )
})
SidebarInset.displayName = "SidebarInset"

/**
 * SidebarInput
 * Styled input for sidebar search/filter.
 */
const SidebarInput = React.forwardRef<
  React.ComponentRef<typeof Input>,
  React.ComponentProps<typeof Input>
>(({ className, ...props }, ref) => {
  return (
    <Input
      ref={ref}
      data-sidebar="input"
      className={cn(
        "h-8 w-full bg-background shadow-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
        className
      )}
      {...props}
    />
  )
})
SidebarInput.displayName = "SidebarInput"

/**
 * SidebarHeader
 * Fixed header section of the sidebar.
 */
const SidebarHeader = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      data-sidebar="header"
      className={cn("flex flex-col gap-2 p-2", className)}
      {...props}
    />
  )
})
SidebarHeader.displayName = "SidebarHeader"

/**
 * SidebarFooter
 * Fixed footer section of the sidebar.
 */
const SidebarFooter = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      data-sidebar="footer"
      className={cn("flex flex-col gap-2 p-2 mt-auto", className)}
      {...props}
    />
  )
})
SidebarFooter.displayName = "SidebarFooter"

/**
 * SidebarSeparator
 * Visual separator within the sidebar.
 */
const SidebarSeparator = React.forwardRef<
  React.ComponentRef<typeof Separator>,
  React.ComponentProps<typeof Separator>
>(({ className, ...props }, ref) => {
  return (
    <Separator
      ref={ref}
      data-sidebar="separator"
      className={cn("mx-2 w-auto bg-sidebar-border", className)}
      {...props}
    />
  )
})
SidebarSeparator.displayName = "SidebarSeparator"

/**
 * SidebarContent
 * Scrollable content area of the sidebar.
 */
const SidebarContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      data-sidebar="content"
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-2 overflow-auto",
        className
      )}
      {...props}
    />
  )
})
SidebarContent.displayName = "SidebarContent"

/**
 * SidebarGroup
 * Logical grouping of sidebar items.
 */
const SidebarGroup = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      data-sidebar="group"
      className={cn("relative flex w-full min-w-0 flex-col p-2", className)}
      {...props}
    />
  )
})
SidebarGroup.displayName = "SidebarGroup"

/**
 * SidebarGroupLabel
 * Label for a sidebar group. Hidden in icon-only mode.
 */
const SidebarGroupLabel = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & { asChild?: boolean }
>(({ className, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "div"

  return (
    <Comp
      ref={ref}
      data-sidebar="group-label"
      className={cn(
        "flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium text-sidebar-foreground/70 outline-none ring-sidebar-ring transition-opacity duration-200 focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
        "opacity-0 h-0 overflow-hidden", // Hidden in icon-only mode
        className
      )}
      {...props}
    />
  )
})
SidebarGroupLabel.displayName = "SidebarGroupLabel"

/**
 * SidebarGroupAction
 * Action button for a sidebar group. Hidden in icon-only mode.
 */
const SidebarGroupAction = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> & { asChild?: boolean }
>(({ className, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      ref={ref}
      data-sidebar="group-action"
      className={cn(
        "absolute right-3 top-3.5 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-sidebar-foreground outline-none ring-sidebar-ring transition-transform hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
        "after:absolute after:-inset-2",
        "hidden", // Hidden in icon-only mode
        className
      )}
      {...props}
    />
  )
})
SidebarGroupAction.displayName = "SidebarGroupAction"

/**
 * SidebarGroupContent
 * Content wrapper for a sidebar group.
 */
const SidebarGroupContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-sidebar="group-content"
    className={cn("w-full text-sm", className)}
    {...props}
  />
))
SidebarGroupContent.displayName = "SidebarGroupContent"

/**
 * SidebarMenu
 * List container for menu items.
 */
const SidebarMenu = React.forwardRef<
  HTMLUListElement,
  React.ComponentProps<"ul">
>(({ className, ...props }, ref) => (
  <ul
    ref={ref}
    data-sidebar="menu"
    className={cn("flex w-full min-w-0 flex-col gap-1", className)}
    {...props}
  />
))
SidebarMenu.displayName = "SidebarMenu"

/**
 * SidebarMenuItem
 * Individual menu item wrapper.
 */
const SidebarMenuItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentProps<"li">
>(({ className, ...props }, ref) => (
  <li
    ref={ref}
    data-sidebar="menu-item"
    className={cn("group/menu-item relative flex justify-center", className)}
    {...props}
  />
))
SidebarMenuItem.displayName = "SidebarMenuItem"

/**
 * SidebarMenuButton variants
 * Styled button for menu items with icon-only support.
 */
const sidebarMenuButtonVariants = cva(
  "peer/menu-button flex items-center justify-center overflow-hidden rounded-xl p-2 text-left outline-none ring-sidebar-ring transition-all hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground [&>svg]:size-5 [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        outline:
          "bg-background shadow-[0_0_0_1px_hsl(var(--sidebar-border))] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:shadow-[0_0_0_1px_hsl(var(--sidebar-accent))]",
      },
      size: {
        default: "size-10",
        sm: "size-8",
        lg: "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

/**
 * SidebarMenuButton
 * Interactive button for menu items with tooltip support.
 */
const SidebarMenuButton = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> & {
    asChild?: boolean
    isActive?: boolean
    tooltip?: string | React.ComponentProps<typeof TooltipContent>
  } & VariantProps<typeof sidebarMenuButtonVariants>
>(
  (
    {
      asChild = false,
      isActive = false,
      variant = "default",
      size = "default",
      tooltip,
      className,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "button"

    const button = (
      <Comp
        ref={ref}
        data-sidebar="menu-button"
        data-size={size}
        data-active={isActive}
        className={cn(sidebarMenuButtonVariants({ variant, size }), className)}
        {...props}
      />
    )

    if (!tooltip) {
      return button
    }

    const tooltipProps = typeof tooltip === "string" ? { children: tooltip } : tooltip

    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent
          side="right"
          align="center"
          {...tooltipProps}
        />
      </Tooltip>
    )
  }
)
SidebarMenuButton.displayName = "SidebarMenuButton"

/**
 * SidebarMenuAction
 * Action button within a menu item. Hidden in icon-only mode.
 */
const SidebarMenuAction = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> & {
    asChild?: boolean
    showOnHover?: boolean
  }
>(({ className, asChild = false, showOnHover = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      ref={ref}
      data-sidebar="menu-action"
      className={cn(
        "absolute right-1 top-1.5 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-sidebar-foreground outline-none ring-sidebar-ring transition-transform hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
        "hidden", // Hidden in icon-only mode
        className
      )}
      {...props}
    />
  )
})
SidebarMenuAction.displayName = "SidebarMenuAction"

/**
 * SidebarMenuBadge
 * Badge for menu items. Hidden in icon-only mode.
 */
const SidebarMenuBadge = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-sidebar="menu-badge"
    className={cn(
      "pointer-events-none absolute right-1 flex h-5 min-w-5 select-none items-center justify-center rounded-md px-1 text-xs font-medium tabular-nums text-sidebar-foreground",
      "hidden", // Hidden in icon-only mode
      className
    )}
    {...props}
  />
))
SidebarMenuBadge.displayName = "SidebarMenuBadge"

/**
 * SidebarMenuSkeleton
 * Loading skeleton for menu items.
 */
const SidebarMenuSkeleton = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    showIcon?: boolean
  }
>(({ className, showIcon = true, ...props }, ref) => {
  return (
    <div
      ref={ref}
      data-sidebar="menu-skeleton"
      className={cn("flex h-10 w-10 items-center justify-center rounded-xl", className)}
      {...props}
    >
      {showIcon && (
        <Skeleton
          className="size-5 rounded-md"
          data-sidebar="menu-skeleton-icon"
        />
      )}
    </div>
  )
})
SidebarMenuSkeleton.displayName = "SidebarMenuSkeleton"

/**
 * SidebarMenuSub
 * Submenu container. Hidden in icon-only mode.
 */
const SidebarMenuSub = React.forwardRef<
  HTMLUListElement,
  React.ComponentProps<"ul">
>(({ className, ...props }, ref) => (
  <ul
    ref={ref}
    data-sidebar="menu-sub"
    className={cn(
      "hidden", // Hidden in icon-only mode
      className
    )}
    {...props}
  />
))
SidebarMenuSub.displayName = "SidebarMenuSub"

/**
 * SidebarMenuSubItem
 * Submenu item. Hidden in icon-only mode.
 */
const SidebarMenuSubItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentProps<"li">
>(({ className, ...props }, ref) => (
  <li 
    ref={ref} 
    className={cn("hidden", className)} // Hidden in icon-only mode
    {...props} 
  />
))
SidebarMenuSubItem.displayName = "SidebarMenuSubItem"

/**
 * SidebarMenuSubButton
 * Submenu button. Hidden in icon-only mode.
 */
const SidebarMenuSubButton = React.forwardRef<
  HTMLAnchorElement,
  React.ComponentProps<"a"> & {
    asChild?: boolean
    size?: "sm" | "md"
    isActive?: boolean
  }
>(({ asChild = false, size = "md", isActive, className, ...props }, ref) => {
  const Comp = asChild ? Slot : "a"

  return (
    <Comp
      ref={ref}
      data-sidebar="menu-sub-button"
      data-size={size}
      data-active={isActive}
      className={cn(
        "hidden", // Hidden in icon-only mode
        className
      )}
      {...props}
    />
  )
})
SidebarMenuSubButton.displayName = "SidebarMenuSubButton"

// Retained for API compatibility but not functional in icon-only mode
const SidebarRail = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button">
>(({ className, ...props }, ref) => {
  return null // Not needed for fixed sidebar
})
SidebarRail.displayName = "SidebarRail"

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
}

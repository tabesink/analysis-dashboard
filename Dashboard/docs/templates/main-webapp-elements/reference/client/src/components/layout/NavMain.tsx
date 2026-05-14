"use client"

/**
 * NavMain Component
 *
 * SOLID Principles Applied:
 * - Single Responsibility: Renders main navigation items.
 * - Open/Closed: Extensible through items prop and `requirePermission` gating
 *   without touching this component's internals.
 *
 * Design: Icon-only navigation with hover tooltips. Items whose
 * `requirePermission` is unmet by the current user render disabled (grayed)
 * and inert.
 */

import Link from "next/link"
import React from "react"
import { usePathname } from "next/navigation"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"
import { selectCanWrite, selectIsAdmin, useAuthStore } from "@/stores/auth-store"
import type { NavigationItem } from "@/types/layout"

export interface NavMainProps {
  items: NavigationItem[]
}

export function NavMain({ items }: NavMainProps) {
  const pathname = usePathname()
  const isAdmin = useAuthStore(selectIsAdmin)
  const canWrite = useAuthStore(selectCanWrite)

  const isPermitted = (item: NavigationItem): boolean => {
    if (!item.requirePermission) return true
    if (item.requirePermission === "admin") return isAdmin
    if (item.requirePermission === "write") return canWrite
    return true
  }

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu className="gap-2 px-1">
          {items.map((item) => {
            const routeActive = pathname === item.url ||
              (item.url !== "/" && pathname.startsWith(item.url))
            const isDatabaseEntry = item.url === "/database"
            const isFilterEditorEntry = item.url === "/database/edit"
            const permitted = isPermitted(item)
            const isActive = permitted && routeActive
            const tooltipLabel = !permitted
              ? (item.disabledTooltip ?? `${item.title} (no access)`)
              : item.title

            return (
              <React.Fragment key={item.title}>
                {isDatabaseEntry && (
                  <SidebarSeparator className="my-1 mx-auto w-8 opacity-60" />
                )}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild={permitted}
                    tooltip={tooltipLabel}
                    isActive={isActive}
                    aria-disabled={!permitted}
                    className={cn(
                      "transition-all duration-200",
                      isActive && "bg-sidebar-accent shadow-sm",
                      !permitted && "cursor-not-allowed opacity-50",
                    )}
                  >
                    {permitted ? (
                      <Link href={item.url}>
                        {item.icon && (
                          <item.icon
                            className={cn(
                              "size-5 transition-colors",
                              isActive
                                ? "text-sidebar-accent-foreground"
                                : "text-sidebar-foreground/70"
                            )}
                          />
                        )}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => e.preventDefault()}
                        aria-label={`${item.title} (disabled)`}
                      >
                        {item.icon && (
                          <item.icon className="size-5 text-sidebar-foreground/40" />
                        )}
                      </button>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
                {isFilterEditorEntry && (
                  <SidebarSeparator className="my-2 mx-auto w-8 opacity-100 bg-sidebar-border/90" />
                )}
              </React.Fragment>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

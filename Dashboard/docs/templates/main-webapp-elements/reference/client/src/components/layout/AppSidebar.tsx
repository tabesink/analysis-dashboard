"use client"

/**
 * AppSidebar Component
 *
 * SOLID Principles Applied:
 * - Single Responsibility: Only responsible for rendering sidebar structure
 * - Open/Closed: Extensible through props and config injection
 * - Dependency Inversion: Depends on abstractions (SidebarConfig) rather than
 *   concrete implementations.
 *
 * Design: Icon-only (64px) fixed sidebar with hover tooltips.
 * Mobile support intentionally removed for clean, bloat-free code.
 */

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Info, LogIn, LogOut, Settings } from "lucide-react"
import { NavMain } from "./NavMain"
import { LogoHeader } from "./LogoHeader"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import type { SidebarConfig } from "@/types/layout"
import { getSidebarConfig } from "@/config/sidebar-config"
import { selectIsAdmin, useAuthStore } from "@/stores/auth-store"
import { usersApi } from "@/lib/api/users"
import { cn } from "@/lib/utils"

export interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  config?: SidebarConfig;
}

export function AppSidebar({
  config,
  ...props
}: AppSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const status = useAuthStore((s) => s.status)
  const logout = useAuthStore((s) => s.logout)
  const isAdmin = useAuthStore(selectIsAdmin)

  const sidebarConfig = config ?? getSidebarConfig();

  const isAuthed = Boolean(user)
  const isBusy = status === "loading"
  const settingsActive = pathname.startsWith("/settings")

  const [pendingCount, setPendingCount] = React.useState(0)

  const refreshPending = React.useCallback(async () => {
    if (!isAdmin) {
      setPendingCount(0)
      return
    }
    try {
      const result = await usersApi.pendingCount()
      setPendingCount(result.count)
    } catch {
      // Silently swallow; the dot is a best-effort affordance.
    }
  }, [isAdmin])

  React.useEffect(() => {
    void refreshPending()
  }, [refreshPending, pathname])

  const onSettingsClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!isAdmin) {
      event.preventDefault()
      return
    }
    void usersApi
      .markVisited()
      .catch(() => undefined)
      .finally(() => {
        setPendingCount(0)
      })
  }

  return (
    <Sidebar collapsible="none" {...props}>
      <SidebarHeader className="py-3">
        <LogoHeader />
      </SidebarHeader>
      <SidebarContent className="py-2">
        <NavMain items={sidebarConfig.navMain} />
        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu className="px-1">
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip="Changelog"
                  isActive={pathname === "/changelog"}
                  aria-label="Changelog"
                >
                  <Link href="/changelog">
                    <Info className="size-5" />
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border/50 pt-3">
        <SidebarMenu className="px-1">
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild={isAdmin}
              tooltip="Admin settings"
              isActive={isAdmin && settingsActive}
              aria-disabled={!isAdmin}
              aria-label="Admin settings"
              className={cn(
                "relative",
                !isAdmin && "cursor-not-allowed opacity-50",
              )}
            >
              {isAdmin ? (
                <Link href="/settings/users" onClick={onSettingsClick}>
                  <Settings
                    className={cn(
                      "size-5 transition-colors",
                      settingsActive
                        ? "text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/70",
                    )}
                  />
                  {pendingCount > 0 && (
                    <span
                      className="absolute right-2 top-2 inline-block size-2 rounded-full bg-destructive"
                      aria-label={`${pendingCount} new user${pendingCount === 1 ? "" : "s"}`}
                    />
                  )}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={(e) => e.preventDefault()}
                  aria-label="Admin settings (disabled)"
                >
                  <Settings className="size-5 text-sidebar-foreground/40" />
                </button>
              )}
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            {isAuthed ? (
              <SidebarMenuButton
                tooltip={user ? `${user.username} • Logout` : "Logout"}
                onClick={() => void logout()}
                disabled={isBusy}
                aria-label="Logout"
              >
                <LogOut className="size-5" />
              </SidebarMenuButton>
            ) : (
              <SidebarMenuButton
                asChild
                tooltip="Login"
                isActive={pathname === "/login"}
                aria-label="Login"
              >
                <Link href="/login">
                  <LogIn className="size-5" />
                </Link>
              </SidebarMenuButton>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}

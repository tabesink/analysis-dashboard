"use client"

/**
 * LogoHeader Component
 * 
 * SOLID Principles Applied:
 * - Single Responsibility: Only responsible for rendering the logo in sidebar header
 * 
 * Design: Centered Multimatic logo, links to home page.
 */

import * as React from "react"
import Link from "next/link"
import {
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export function LogoHeader() {
  return (
    <SidebarMenu>
      <SidebarMenuItem className="flex justify-center">
        <Tooltip>
          <TooltipTrigger asChild>
            <Link 
              href="/" 
              className="flex items-center justify-center size-10 rounded-xl transition-transform hover:scale-105"
            >
              <img 
                src="/logo.svg" 
                alt="Multimatic" 
                className="size-10 object-contain"
              />
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right" align="center">
            <p>RSP Data Analytics</p>
          </TooltipContent>
        </Tooltip>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

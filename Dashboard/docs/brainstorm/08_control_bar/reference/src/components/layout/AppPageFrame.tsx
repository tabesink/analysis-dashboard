"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogIn, LogOut, Settings } from "lucide-react";
import type { ReactNode } from "react";
import { useAuthStore } from "@/stores/auth-store";

type AppPageFrameProps = {
  children: ReactNode;
  contentClassName?: string;
};

export function AppPageFrame({ children, contentClassName = "" }: AppPageFrameProps) {
  const pathname = usePathname();
  const status = useAuthStore((state) => state.status);
  const logout = useAuthStore((state) => state.logout);
  const authenticated = status === "authenticated";

  return (
    <section className="flex min-h-screen flex-1 p-5">
      <div className="relative h-[calc(100vh-2.5rem)] min-h-[540px] w-full overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--background)]">
        <div className={`h-full min-h-0 ${contentClassName}`}>{children}</div>
        <div className="absolute bottom-1.5 left-1.5 z-30 flex flex-col gap-1.5 rounded-2xl bg-[var(--background)]/90 p-1 backdrop-blur">
          <Link
            href="/chat"
            aria-label="Chat"
            className={`inline-flex size-10 items-center justify-center rounded-xl transition-colors ${
              pathname.startsWith("/chat")
                ? "bg-[var(--secondary)] text-[var(--foreground)]"
                : "text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-5"
              aria-hidden
            >
              <path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <path d="M12 17h.01" />
            </svg>
          </Link>
          <Link
            href="/database-visualize"
            aria-label="Database visualize"
            className={`inline-flex size-10 items-center justify-center rounded-xl transition-colors ${
              pathname.startsWith("/database-visualize")
                ? "bg-[var(--secondary)] text-[var(--foreground)]"
                : "text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-5"
              aria-hidden
            >
              <path d="M21 11.693V5" />
              <path d="m22 22-1.875-1.875" />
              <path d="M3 12a9 3 0 0 0 8.697 2.998" />
              <path d="M3 5v14a9 3 0 0 0 9.28 2.999" />
              <circle cx="18" cy="18" r="3" />
              <ellipse cx="12" cy="5" rx="9" ry="3" />
            </svg>
          </Link>
          <Link
            href="/settings/users"
            aria-label="Settings"
            className={`inline-flex size-10 items-center justify-center rounded-xl transition-colors ${
              pathname.startsWith("/settings")
                ? "bg-[var(--secondary)] text-[var(--foreground)]"
                : "text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            <Settings className="size-5" aria-hidden />
          </Link>
          {authenticated ? (
            <button
              type="button"
              onClick={() => void logout()}
              aria-label="Logout"
              className="inline-flex size-10 items-center justify-center rounded-xl text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
            >
              <LogOut className="size-5" aria-hidden />
            </button>
          ) : (
            <Link
              href="/login"
              aria-label="Login"
              className="inline-flex size-10 items-center justify-center rounded-xl text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
            >
              <LogIn className="size-5" aria-hidden />
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

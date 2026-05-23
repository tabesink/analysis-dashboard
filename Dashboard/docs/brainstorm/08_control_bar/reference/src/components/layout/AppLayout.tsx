"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import type { ReactNode } from "react";
import { useAuthStore } from "@/stores/auth-store";

export function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const status = useAuthStore((state) => state.status);
  const isLogin = pathname === "/login";

  useEffect(() => {
    if (!isLogin && status === "unauthenticated") {
      router.replace("/login");
    }
    if (isLogin && status === "authenticated") {
      router.replace("/chat");
    }
  }, [isLogin, router, status]);

  if (isLogin) {
    return <>{children}</>;
  }

  if (status === "idle" || status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)] text-sm text-[var(--muted-foreground)]">
        Loading session...
      </div>
    );
  }

  if (status === "unauthenticated") {
    return null;
  }

  return (
    <div className="flex min-h-screen min-w-0 flex-col bg-[var(--background)] text-[var(--foreground)]">
      {children}
    </div>
  );
}

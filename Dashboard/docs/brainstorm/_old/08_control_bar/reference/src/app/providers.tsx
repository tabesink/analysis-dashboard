"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { Toaster } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuthStore } from "@/stores/auth-store";

export function Providers({ children }: { children: ReactNode }) {
  const bootstrap = useAuthStore((state) => state.bootstrap);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  return (
    <AppLayout>
      {children}
      <Toaster richColors closeButton />
    </AppLayout>
  );
}

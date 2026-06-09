"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";
import { APIError } from "@/lib/api/client";
import { useAuthStore } from "@/stores/auth-store";

function errorMessage(error: unknown) {
  if (error instanceof APIError) {
    const body = error.body as { detail?: unknown } | null;
    if (typeof body?.detail === "string") return body.detail;
  }
  if (error instanceof Error && error.message) return error.message;
  return "Login failed";
}

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((state) => state.login);
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(username.trim(), password);
      router.replace("/chat");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-6 py-10">
      <form onSubmit={onSubmit} className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Image src="/logo.svg" alt="LightRAG" width={72} height={72} priority className="size-18" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-[var(--foreground)]">Sign in</h1>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">Use your local team account to access chat.</p>
          </div>
        </div>

        <label className="block text-sm font-medium text-[var(--foreground)]" htmlFor="username">
          Username
        </label>
        <input
          id="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          autoComplete="username"
          className="mt-2 w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
          required
        />

        <label className="mt-4 block text-sm font-medium text-[var(--foreground)]" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          type="password"
          autoComplete="current-password"
          className="mt-2 w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
          required
        />

        {error ? <p className="mt-4 rounded-xl bg-[var(--muted)] px-3 py-2 text-sm text-[var(--foreground)]">{error}</p> : null}

        <button
          type="submit"
          disabled={busy}
          className="mt-5 w-full rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-[var(--primary-foreground)] transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </main>
  );
}

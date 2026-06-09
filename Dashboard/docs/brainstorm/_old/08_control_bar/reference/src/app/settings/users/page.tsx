"use client";

import * as React from "react";
import { MoreHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { AppPageFrame } from "@/components/layout/AppPageFrame";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { APIError } from "@/lib/api/client";
import { usersApi } from "@/lib/api/users";
import { selectIsAdmin, useAuthStore } from "@/stores/auth-store";
import type {
  AdminUser,
  CreateUserPayload,
  UpdateUserPayload,
  UserRole,
} from "@/types/user";

interface CreateState {
  open: boolean;
  username: string;
  password: string;
  role: UserRole;
  can_write: boolean;
  busy: boolean;
  error: string | null;
}

interface ResetState {
  user: AdminUser | null;
  password: string;
  confirm: string;
  busy: boolean;
  error: string | null;
}

interface DeleteState {
  user: AdminUser | null;
  busy: boolean;
  error: string | null;
}

const initialCreate: CreateState = {
  open: false,
  username: "",
  password: "",
  role: "user",
  can_write: false,
  busy: false,
  error: null,
};

function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof APIError) {
    const body = error.body as { detail?: unknown } | null;
    if (body && typeof body.detail === "string") return body.detail;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export default function SettingsUsersPage() {
  const router = useRouter();
  const currentUser = useAuthStore((state) => state.user);
  const status = useAuthStore((state) => state.status);
  const isAdmin = useAuthStore(selectIsAdmin);

  const [users, setUsers] = React.useState<AdminUser[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [listError, setListError] = React.useState<string | null>(null);
  const [lastVisitAt, setLastVisitAt] = React.useState<number | null>(null);
  const [create, setCreate] = React.useState<CreateState>(initialCreate);
  const [reset, setReset] = React.useState<ResetState>({
    user: null,
    password: "",
    confirm: "",
    busy: false,
    error: null,
  });
  const [del, setDel] = React.useState<DeleteState>({
    user: null,
    busy: false,
    error: null,
  });

  const loadUsers = React.useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const list = await usersApi.list();
      setUsers(list);
    } catch (error) {
      setListError(getErrorMessage(error, "Failed to load users"));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (status === "idle" || status === "loading") return;
    if (!isAdmin) router.replace("/chat");
  }, [isAdmin, router, status]);

  React.useEffect(() => {
    if (!isAdmin) return;
    const task = window.setTimeout(() => {
      void loadUsers();
    }, 0);
    setLastVisitAt(Date.now());
    void usersApi.markVisited().catch(() => undefined);
    return () => window.clearTimeout(task);
  }, [isAdmin, loadUsers]);

  if (!isAdmin) return null;

  const onCreateSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreate((state) => ({ ...state, busy: true, error: null }));
    const payload: CreateUserPayload = {
      username: create.username.trim(),
      password: create.password,
      role: create.role,
      can_write: create.role === "admin" ? true : create.can_write,
    };

    try {
      const newUser = await usersApi.create(payload);
      setUsers((previous) => [...previous, newUser]);
      setCreate(initialCreate);
    } catch (error) {
      setCreate((state) => ({
        ...state,
        busy: false,
        error: getErrorMessage(error, "Failed to create user"),
      }));
    }
  };

  const onUpdate = async (user: AdminUser, payload: UpdateUserPayload) => {
    setListError(null);
    try {
      const updated = await usersApi.update(user.id, payload);
      setUsers((previous) =>
        previous.map((item) => (item.id === user.id ? updated : item))
      );
    } catch (error) {
      setListError(getErrorMessage(error, "Failed to update user"));
    }
  };

  const onResetSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!reset.user) return;
    if (reset.password.length < 8) {
      setReset((state) => ({
        ...state,
        error: "Password must be at least 8 characters",
      }));
      return;
    }
    if (reset.password !== reset.confirm) {
      setReset((state) => ({ ...state, error: "Passwords do not match" }));
      return;
    }

    setReset((state) => ({ ...state, busy: true, error: null }));
    try {
      await usersApi.resetPassword(reset.user.id, { new_password: reset.password });
      setUsers((previous) =>
        previous.map((item) =>
          item.id === reset.user?.id ? { ...item, has_password: true } : item
        )
      );
      setReset({ user: null, password: "", confirm: "", busy: false, error: null });
    } catch (error) {
      setReset((state) => ({
        ...state,
        busy: false,
        error: getErrorMessage(error, "Failed to reset password"),
      }));
    }
  };

  const onDeleteConfirm = async () => {
    if (!del.user) return;
    setDel((state) => ({ ...state, busy: true, error: null }));
    try {
      await usersApi.remove(del.user.id);
      setUsers((previous) => previous.filter((item) => item.id !== del.user?.id));
      setDel({ user: null, busy: false, error: null });
    } catch (error) {
      setDel((state) => ({
        ...state,
        busy: false,
        error: getErrorMessage(error, "Failed to delete user"),
      }));
    }
  };

  const isNewUser = (user: AdminUser): boolean => {
    if (!user.created_at || !lastVisitAt) return false;
    const created = new Date(user.created_at).getTime();
    return Number.isFinite(created) && created > lastVisitAt - 60_000;
  };

  return (
    <AppPageFrame contentClassName="overflow-y-auto">
      <section className="mx-auto w-full max-w-5xl px-6 py-8 pb-24 md:px-8 md:py-10">
        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">User management</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage user accounts, write permissions, and admin access.
          </p>
        </header>

        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="text-base">Users</CardTitle>
              <CardDescription>
                {users.length} {users.length === 1 ? "account" : "accounts"}
              </CardDescription>
            </div>
            <Button onClick={() => setCreate({ ...initialCreate, open: true })}>
              New user
            </Button>
          </CardHeader>
          <CardContent>
            {listError ? (
              <p className="mb-3 text-sm text-destructive">{listError}</p>
            ) : null}
            <div className="rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Username</TableHead>
                    <TableHead>Password</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Write access</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-12 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center text-muted-foreground"
                      >
                        Loading users...
                      </TableCell>
                    </TableRow>
                  ) : users.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center text-muted-foreground"
                      >
                        No users yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map((user) => {
                      const isSelf = user.id === currentUser?.id;
                      const showNew = !isSelf && isNewUser(user);
                      const writeForced = user.role === "admin";
                      return (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <span>{user.username}</span>
                              {isSelf ? <Badge variant="muted">You</Badge> : null}
                              {showNew ? <Badge variant="muted">New</Badge> : null}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <span className="font-mono text-muted-foreground">
                                ••••••••
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {user.has_password ? "Set" : "Not set"}
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setReset({
                                    user,
                                    password: "",
                                    confirm: "",
                                    busy: false,
                                    error: null,
                                  })
                                }
                              >
                                Reset
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={user.role}
                              onValueChange={(value) =>
                                onUpdate(user, { role: value as UserRole })
                              }
                              disabled={isSelf}
                            >
                              <SelectTrigger size="sm" className="w-28">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="user">User</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={writeForced ? true : user.can_write}
                                onCheckedChange={(checked) =>
                                  onUpdate(user, { can_write: checked })
                                }
                                disabled={isSelf || writeForced}
                                aria-label={`Toggle write access for ${user.username}`}
                              />
                              {writeForced ? (
                                <span className="text-xs text-muted-foreground">
                                  Always on
                                </span>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(user.created_at)}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" disabled={isSelf}>
                                  <MoreHorizontal className="size-4" />
                                  <span className="sr-only">Actions</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onSelect={() =>
                                    setDel({ user, busy: false, error: null })
                                  }
                                >
                                  Delete user
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Dialog
          open={create.open}
          onOpenChange={(open) => setCreate((state) => (open ? state : initialCreate))}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create user</DialogTitle>
              <DialogDescription>
                Set a starting password and choose role and write access.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={onCreateSubmit} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="new-username">Username</Label>
                <Input
                  id="new-username"
                  value={create.username}
                  onChange={(event) =>
                    setCreate((state) => ({ ...state, username: event.target.value }))
                  }
                  required
                  minLength={3}
                  maxLength={64}
                  autoComplete="off"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="new-user-password">Password</Label>
                <Input
                  id="new-user-password"
                  type="password"
                  value={create.password}
                  onChange={(event) =>
                    setCreate((state) => ({ ...state, password: event.target.value }))
                  }
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="new-user-role">Role</Label>
                <Select
                  value={create.role}
                  onValueChange={(value) =>
                    setCreate((state) => ({ ...state, role: value as UserRole }))
                  }
                >
                  <SelectTrigger id="new-user-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <div>
                  <Label htmlFor="new-user-write">Write access</Label>
                  <p className="text-xs text-muted-foreground">
                    {create.role === "admin"
                      ? "Always on for admin accounts."
                      : "Allow this user to upload, edit, and delete data."}
                  </p>
                </div>
                <Switch
                  id="new-user-write"
                  checked={create.role === "admin" ? true : create.can_write}
                  onCheckedChange={(checked) =>
                    setCreate((state) => ({ ...state, can_write: checked }))
                  }
                  disabled={create.role === "admin"}
                  aria-label="New user write access"
                />
              </div>
              {create.error ? (
                <p className="text-sm text-destructive">{create.error}</p>
              ) : null}
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreate(initialCreate)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={create.busy}>
                  {create.busy ? "Creating..." : "Create user"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog
          open={reset.user !== null}
          onOpenChange={(open) =>
            setReset((state) =>
              open
                ? state
                : { user: null, password: "", confirm: "", busy: false, error: null }
            )
          }
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reset password</DialogTitle>
              <DialogDescription>
                Set a new password for{" "}
                <span className="font-medium text-foreground">
                  {reset.user?.username ?? ""}
                </span>
                .
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={onResetSubmit} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="reset-password">New password</Label>
                <Input
                  id="reset-password"
                  type="password"
                  value={reset.password}
                  onChange={(event) =>
                    setReset((state) => ({ ...state, password: event.target.value }))
                  }
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="reset-password-confirm">
                  Confirm new password
                </Label>
                <Input
                  id="reset-password-confirm"
                  type="password"
                  value={reset.confirm}
                  onChange={(event) =>
                    setReset((state) => ({ ...state, confirm: event.target.value }))
                  }
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
              {reset.error ? (
                <p className="text-sm text-destructive">{reset.error}</p>
              ) : null}
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setReset({
                      user: null,
                      password: "",
                      confirm: "",
                      busy: false,
                      error: null,
                    })
                  }
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={reset.busy}>
                  {reset.busy ? "Saving..." : "Save password"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <AlertDialog
          open={del.user !== null}
          onOpenChange={(open) =>
            setDel((state) =>
              open ? state : { user: null, busy: false, error: null }
            )
          }
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete user</AlertDialogTitle>
              <AlertDialogDescription>
                {del.user
                  ? `Permanently remove "${del.user.username}". This cannot be undone.`
                  : ""}
              </AlertDialogDescription>
            </AlertDialogHeader>
            {del.error ? (
              <p className="px-6 text-sm text-destructive">{del.error}</p>
            ) : null}
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={onDeleteConfirm}
                disabled={del.busy}
              >
                {del.busy ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>
    </AppPageFrame>
  );
}

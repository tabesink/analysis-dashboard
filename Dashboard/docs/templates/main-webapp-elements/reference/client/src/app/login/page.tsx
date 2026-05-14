'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuthStore } from '@/stores/auth-store';

const POST_AUTH_ROUTE = '/dashboard';

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);

  const [tab, setTab] = useState<'signin' | 'register'>('signin');

  const [signInUsername, setSignInUsername] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [signInError, setSignInError] = useState('');

  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm, setRegConfirm] = useState('');
  const [regError, setRegError] = useState('');

  useEffect(() => {
    if (user) {
      router.replace(POST_AUTH_ROUTE);
    }
  }, [user, router]);

  const onSignIn = async (event: FormEvent) => {
    event.preventDefault();
    setSignInError('');
    try {
      await login(signInUsername.trim(), signInPassword);
      router.replace(POST_AUTH_ROUTE);
    } catch (e) {
      setSignInError(e instanceof Error ? e.message : 'Login failed');
    }
  };

  const onRegister = async (event: FormEvent) => {
    event.preventDefault();
    setRegError('');
    if (regPassword.length < 8) {
      setRegError('Password must be at least 8 characters.');
      return;
    }
    if (regPassword !== regConfirm) {
      setRegError('Passwords do not match.');
      return;
    }
    try {
      await register(regUsername.trim(), regPassword);
      router.replace(POST_AUTH_ROUTE);
    } catch (e) {
      setRegError(e instanceof Error ? e.message : 'Registration failed');
    }
  };

  const isBusy = status === 'loading';

  return (
    <main className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader>
            <CardTitle>Welcome</CardTitle>
            <CardDescription>
              Sign in to an existing account or register a new read-only account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={tab} onValueChange={(value) => setTab(value as 'signin' | 'register')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="register">Register</TabsTrigger>
              </TabsList>

              <TabsContent value="signin" className="pt-4">
                <form onSubmit={onSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-username">Username</Label>
                    <Input
                      id="signin-username"
                      value={signInUsername}
                      onChange={(e) => setSignInUsername(e.target.value)}
                      placeholder="username"
                      autoComplete="username"
                      required
                      minLength={3}
                      maxLength={64}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Password</Label>
                    <Input
                      id="signin-password"
                      type="password"
                      value={signInPassword}
                      onChange={(e) => setSignInPassword(e.target.value)}
                      autoComplete="current-password"
                      required
                      minLength={8}
                    />
                  </div>
                  {signInError ? (
                    <p className="text-sm text-destructive">{signInError}</p>
                  ) : null}
                  <Button type="submit" className="w-full" disabled={isBusy}>
                    {isBusy ? 'Signing in...' : 'Sign In'}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="register" className="pt-4">
                <form onSubmit={onRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="register-username">Username</Label>
                    <Input
                      id="register-username"
                      value={regUsername}
                      onChange={(e) => setRegUsername(e.target.value)}
                      placeholder="username"
                      autoComplete="username"
                      required
                      minLength={3}
                      maxLength={64}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-password">Password</Label>
                    <Input
                      id="register-password"
                      type="password"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      autoComplete="new-password"
                      required
                      minLength={8}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-confirm">Confirm password</Label>
                    <Input
                      id="register-confirm"
                      type="password"
                      value={regConfirm}
                      onChange={(e) => setRegConfirm(e.target.value)}
                      autoComplete="new-password"
                      required
                      minLength={8}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    New accounts start with read-only access. An administrator can grant
                    write permissions later.
                  </p>
                  {regError ? <p className="text-sm text-destructive">{regError}</p> : null}
                  <Button type="submit" className="w-full" disabled={isBusy}>
                    {isBusy ? 'Creating account...' : 'Create account'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

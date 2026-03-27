import { redirect } from 'next/navigation';
import { AlertCircle, LockKeyhole } from 'lucide-react';
import { ThemeSwitcher } from '@/components/theme/ThemeSwitcher';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { LoginForm } from '@/components/auth/LoginForm';
import { getAuthConfig } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  const authConfig = getAuthConfig();

  if (!authConfig.enabled) {
    redirect('/');
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-md items-center px-4">
          <div>
            <h1 className="text-base font-semibold leading-tight">Grocy-Mealie Sync</h1>
            <p className="text-xs text-muted-foreground">Authentication required</p>
          </div>
          <div className="ml-auto">
            <ThemeSwitcher />
          </div>
        </div>
      </header>

      <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-md items-center px-4 py-10">
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LockKeyhole className="size-4" />
              Sign in
            </CardTitle>
            <CardDescription>
              Enter the shared app secret to access the dashboard and API.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!authConfig.configured ? (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertTitle>Authentication is misconfigured</AlertTitle>
                <AlertDescription>
                  Set `AUTH_SECRET` or disable auth by setting `AUTH_ENABLED=false`.
                </AlertDescription>
              </Alert>
            ) : (
              <LoginForm />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

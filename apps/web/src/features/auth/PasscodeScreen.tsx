import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { Button, Field, Input } from '@/components/ui';
import { useAuth } from '@/app/auth/auth-context';

export function PasscodeScreen() {
  const { signedIn, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (signedIn) return <Navigate to={from} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const ok = await signIn(passcode);
    setBusy(false);
    if (ok) void navigate(from, { replace: true });
    else setError("That passcode isn't right. Try again.");
  };

  return (
    <main data-screen-ready className="flex min-h-dvh flex-col bg-paper">
      <div className="flex flex-1 items-center justify-center px-5">
        <div className="w-full max-w-[340px]">
          <img src="/sample/maxsen-logo.svg" alt="Maxsen" className="mb-10 h-8 w-auto" />
          <p className="text-meta text-ink-2">Maxsen Smart Home Planner</p>
          <h1 className="mt-1 text-title text-ink">Enter the team passcode</h1>
          <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
            <Field label="Passcode" error={error}>
              <Input
                type="password"
                autoFocus
                autoComplete="current-password"
                value={passcode}
                onChange={(e) => {
                  setPasscode(e.target.value);
                  setError(null);
                }}
              />
            </Field>
            <Button type="submit" variant="primary" loading={busy} className="w-full">
              Sign in
            </Button>
          </form>
        </div>
      </div>
      <p className="px-5 pb-6 text-meta text-ink-3">
        For Maxsen Smart Solutions staff. Ask your manager for the passcode.
      </p>
    </main>
  );
}

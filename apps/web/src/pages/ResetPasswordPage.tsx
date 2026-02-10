import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useResetPassword } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Anchor, Eye, EyeOff, CheckCircle, ShieldCheck } from 'lucide-react';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get('token') || '';

  const [token, setToken] = useState(tokenFromUrl);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [validationError, setValidationError] = useState('');
  const resetPassword = useResetPassword();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');

    if (!token.trim()) {
      setValidationError('Reset token is required');
      return;
    }
    if (password.length < 8) {
      setValidationError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      setValidationError('Passwords do not match');
      return;
    }

    resetPassword.mutate({ token: token.trim(), password });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-3">
            <Anchor className="h-12 w-12 text-ocean" />
            <div>
              <h1 className="text-2xl font-bold text-white">MarineStream</h1>
              <p className="text-sm text-slate-400">Vessel Management Platform</p>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader className="text-center">
            {resetPassword.isSuccess ? (
              <>
                <div className="flex justify-center mb-2">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  </div>
                </div>
                <CardTitle className="text-xl">Password reset!</CardTitle>
                <CardDescription>
                  Your password has been changed successfully. You can now sign in with your new password.
                </CardDescription>
              </>
            ) : (
              <>
                <div className="flex justify-center mb-2">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-ocean/10">
                    <ShieldCheck className="h-6 w-6 text-ocean" />
                  </div>
                </div>
                <CardTitle className="text-xl">Set new password</CardTitle>
                <CardDescription>
                  Enter your reset token and choose a new password.
                </CardDescription>
              </>
            )}
          </CardHeader>
          <CardContent>
            {resetPassword.isSuccess ? (
              <Button asChild className="w-full">
                <Link to="/login">Go to sign in</Link>
              </Button>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {!tokenFromUrl && (
                  <div className="space-y-2">
                    <Label htmlFor="token">Reset token</Label>
                    <Input
                      id="token"
                      placeholder="Paste your reset token here"
                      value={token}
                      onChange={(e) => { setToken(e.target.value); setValidationError(''); }}
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Check the API console output or the email you received.
                    </p>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="password">New password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Minimum 8 characters"
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setValidationError(''); }}
                      autoComplete="new-password"
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm new password</Label>
                  <Input
                    id="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Type your password again"
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setValidationError(''); }}
                    autoComplete="new-password"
                    required
                  />
                </div>

                {(validationError || resetPassword.error) && (
                  <div className="rounded-md bg-red-50 border border-red-200 p-3">
                    <p className="text-sm text-red-600">
                      {validationError || (resetPassword.error as any)?.response?.data?.error?.message || 'Password reset failed'}
                    </p>
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={resetPassword.isPending}>
                  {resetPassword.isPending ? 'Resetting...' : 'Reset password'}
                </Button>
              </form>
            )}
          </CardContent>
          {!resetPassword.isSuccess && (
            <CardFooter className="justify-center">
              <p className="text-sm text-muted-foreground">
                Remember your password?{' '}
                <Link to="/login" className="font-medium text-ocean hover:text-ocean/80 hover:underline">
                  Sign in
                </Link>
              </p>
            </CardFooter>
          )}
        </Card>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForgotPassword } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Anchor, ArrowLeft, Mail, CheckCircle } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const forgotPassword = useForgotPassword();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    forgotPassword.mutate(email);
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
            {forgotPassword.isSuccess ? (
              <>
                <div className="flex justify-center mb-2">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  </div>
                </div>
                <CardTitle className="text-xl">Check your email</CardTitle>
                <CardDescription>
                  If an account exists for <span className="font-medium text-foreground">{email}</span>,
                  we've sent password reset instructions.
                </CardDescription>
              </>
            ) : (
              <>
                <div className="flex justify-center mb-2">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-ocean/10">
                    <Mail className="h-6 w-6 text-ocean" />
                  </div>
                </div>
                <CardTitle className="text-xl">Forgot your password?</CardTitle>
                <CardDescription>
                  Enter your email and we'll send you a link to reset your password.
                </CardDescription>
              </>
            )}
          </CardHeader>
          <CardContent>
            {forgotPassword.isSuccess ? (
              <div className="space-y-4">
                <div className="rounded-md bg-blue-50 border border-blue-200 p-3">
                  <p className="text-sm text-blue-700">
                    <strong>Development mode:</strong> Check the API server console for the reset token/link.
                  </p>
                </div>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/login">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to sign in
                  </Link>
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                </div>
                {forgotPassword.error && (
                  <div className="rounded-md bg-red-50 border border-red-200 p-3">
                    <p className="text-sm text-red-600">Something went wrong. Please try again.</p>
                  </div>
                )}
                <Button type="submit" className="w-full" disabled={forgotPassword.isPending}>
                  {forgotPassword.isPending ? 'Sending...' : 'Send reset link'}
                </Button>
              </form>
            )}
          </CardContent>
          {!forgotPassword.isSuccess && (
            <CardFooter className="justify-center">
              <Link to="/login" className="flex items-center text-sm text-muted-foreground hover:text-foreground">
                <ArrowLeft className="mr-1 h-3 w-3" /> Back to sign in
              </Link>
            </CardFooter>
          )}
        </Card>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/button';
import { GraviumLogo } from '@/components/common/GraviumLogo';
import { ThemeModeToggle } from '@/components/common/ThemeModeToggle';

export default function CreateAdminPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [adminKey, setAdminKey] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const navigate = useNavigate();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (adminKey !== 'GRAVIUM_ADMIN_2024') {
      setError('Invalid admin key.');
      return;
    }

    setLoading(true);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: 'super_admin',
        },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      await supabase
        .from('profiles')
        .update({ role: 'super_admin', full_name: fullName })
        .eq('id', data.user.id);

      setSuccess(true);
      setTimeout(() => navigate('/login/admin'), 2000);
    }

    setLoading(false);
  };

  return (
    <div className="relative flex min-h-screen bg-background text-foreground">
      <div className="absolute right-6 top-6 z-20">
        <ThemeModeToggle />
      </div>

      <div className="relative hidden overflow-hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-16">
        <img
          src="/loginbg.jpg"
          alt="Background"
          className="absolute inset-0 h-full w-full object-cover"
        />

        <div className="absolute inset-0 bg-black/75" />

        <div className="relative z-10 flex flex-col items-center text-center">
          <GraviumLogo
            variant="icon"
            logoTheme="dark"
            className="h-[200px] w-auto object-contain"
          />
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto p-6 py-16 sm:p-8 lg:p-16">
        <div className="w-full max-w-md">
          <div className="mb-10 flex items-center justify-center gap-2 lg:hidden">
            <GraviumLogo
              variant="wordmark"
              className="h-8 w-auto object-contain"
            />
            <span className="text-2xl font-medium text-foreground">OS</span>
          </div>

          <h1 className="mb-2 text-2xl font-bold text-foreground">
            Create Admin Account
          </h1>

          <p className="mb-8 text-xs text-muted-foreground">
            Set up your Super Admin account for Gravium OS
          </p>

        {success && (
          <div className="mb-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
            <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
              Admin account created!
            </p>
            <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">
              Redirecting to login...
            </p>
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-2xl border border-destructive/20 bg-destructive/10 p-4">
            <p className="text-sm font-medium text-destructive">Error</p>
            <p className="mt-1 text-sm text-destructive/80">{error}</p>
          </div>
        )}

        <form onSubmit={handleCreate} className="flex flex-col gap-5">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Full Name
            </label>

            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              required
              placeholder="John Doe"
              className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Email address
            </label>

            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="admin@gravium.com"
              className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Password
            </label>

            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="Min. 8 characters"
                className="h-11 w-full rounded-xl border border-border bg-background px-3 pr-12 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:border-primary focus:outline-none"
              />

              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Confirm Password
            </label>

            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
              placeholder="Repeat password"
              className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Admin Key
            </label>

            <div className="relative">
              <input
                type="password"
                value={adminKey}
                onChange={e => setAdminKey(e.target.value)}
                required
                placeholder="Enter the admin key"
                className="h-11 w-full rounded-xl border border-border bg-background px-3 pr-12 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:border-primary focus:outline-none"
              />

              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Lock size={18} className="text-muted-foreground" />
              </div>
            </div>

            <p className="mt-1 text-xs text-muted-foreground">
              Contact the Super Admin to obtain the admin key.
            </p>
          </div>

          <Button type="submit" disabled={loading} className="mt-2 h-11 w-full rounded-xl">
            {loading ? 'Creating...' : 'Create Admin Account'}
          </Button>
        </form>

          <div className="mt-8 border-t border-border pt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link
                to="/login/admin"
                className="font-medium text-foreground underline hover:text-muted-foreground"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
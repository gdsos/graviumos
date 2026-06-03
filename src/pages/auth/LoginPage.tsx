import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/button';
import { GraviumLogo } from '@/components/common/GraviumLogo';
import { ThemeModeToggle } from '@/components/common/ThemeModeToggle';

interface LoginPageProps {
  portalType: 'admin' | 'employee';
}

export default function LoginPage({ portalType }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      let userRole: string | null = null;

      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) await new Promise(r => setTimeout(r, 500));

        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .maybeSingle();

        if (profile?.role) {
          userRole = profile.role;
          break;
        }
      }

      if (portalType === 'admin' && userRole !== 'super_admin') {
        await supabase.auth.signOut();
        setError('Access denied. This portal is for administrators only.');
        setLoading(false);
        return;
      }

      if (portalType === 'employee' && userRole === 'super_admin') {
        navigate('/admin/dashboard');
        return;
      }

      navigate(portalType === 'admin' ? '/admin/dashboard' : '/portal/overview');
    }

    setLoading(false);
  };

  return (
    <div className="relative flex min-h-screen bg-background text-foreground">
      <div className="absolute right-6 top-6 z-20">
        <ThemeModeToggle />
      </div>

      {/* Left branding panel */}
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

      {/* Right login form */}
      <div className="flex flex-1 flex-col items-center justify-center p-8 lg:p-16">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="mb-10 flex items-center justify-center gap-2 lg:hidden">
            <GraviumLogo
              variant="wordmark"
              className="h-8 w-auto object-contain"
            />
            <span className="text-2xl font-medium text-foreground">OS</span>
          </div>

          <h1 className="mb-2 text-2xl font-bold text-foreground">
            {portalType === 'admin' ? 'Admin Sign In' : 'Welcome Back'}
          </h1>

          <p className="mb-8 text-xs text-muted-foreground">
            Sign in to your {portalType === 'admin' ? 'admin' : 'employee'} dashboard
          </p>

          {error && (
            <div className="mb-6 rounded-2xl border border-destructive/20 bg-destructive/10 p-4">
              <p className="text-sm font-medium text-destructive">Login failed</p>
              <p className="mt-1 text-sm text-destructive/80">{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="flex flex-col gap-5">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Email address
              </label>

              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="you@gravium.com"
                className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-medium text-foreground placeholder:text-muted-foreground transition-colors focus:border-primary focus:outline-none"
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
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="h-11 w-full rounded-xl border border-border bg-background px-3 pr-16 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:border-primary focus:outline-none"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <Button type="submit" disabled={loading} className="mt-2 h-11 w-full rounded-xl">
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          <div className="mt-8 border-t border-border pt-6">
            {portalType === 'admin' ? (
              <div className="flex flex-col gap-3 text-center">
                <p className="text-sm text-muted-foreground">
                  Employee?{' '}
                  <Link
                    to="/login/employee"
                    className="font-medium text-foreground underline hover:text-muted-foreground"
                  >
                    Switch to Employee Portal
                  </Link>
                </p>

                <p className="text-sm text-muted-foreground">
                  First time?{' '}
                  <Link
                    to="/admin/create"
                    className="font-medium text-foreground underline hover:text-muted-foreground"
                  >
                    Create Admin Account
                  </Link>
                </p>
              </div>
            ) : (
              <p className="text-center text-sm text-muted-foreground">
                Admin?{' '}
                <Link
                  to="/login/admin"
                  className="font-medium text-foreground underline hover:text-muted-foreground"
                >
                  Switch to Admin Portal
                </Link>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
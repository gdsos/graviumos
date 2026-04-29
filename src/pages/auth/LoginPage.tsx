import { useState } from 'react';
import { PButton, PText, PHeading, PInlineNotification } from '@porsche-design-system/components-react';
import { supabase } from '../../lib/supabase';
import { useNavigate, Link } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';

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
  const { theme } = useTheme();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      // Retry profile fetch up to 3 times (trigger may need a moment)
      let userRole: string | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) await new Promise(r => setTimeout(r, 500));
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .maybeSingle();
        if (profile?.role) { userRole = profile.role; break; }
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

  const isDark = theme === 'dark';

  return (
    <div className={`min-h-screen flex ${isDark ? 'bg-canvas' : 'bg-canvas'}`}>
      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary flex-col items-center justify-center p-16 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-20 left-20 w-64 h-64 rounded-full border-2 border-white"></div>
          <div className="absolute bottom-20 right-20 w-96 h-96 rounded-full border border-white"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-128 h-128 rounded-full border border-white"></div>
        </div>
        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="flex items-center gap-2 mb-8">
            <img
              src="/GRAVIUM.png"
              alt="GRAVIUM"
              className="h-10 brightness-0 invert"
              style={{ height: '40px' }}
            />
            <span className="text-white font-bold text-3xl tracking-tight" style={{ fontFamily: "'Montserrat', 'Arial Narrow', Arial, sans-serif" }}>OS</span>
          </div>
          <PHeading tag="h2" size="large" theme="dark" className="mb-4 text-white">
            {portalType === 'admin' ? 'Admin Portal' : 'Employee Portal'}
          </PHeading>
          <PText theme="dark" color="contrast-medium">
            {portalType === 'admin'
              ? 'Full control over your organization'
              : 'Your personal workspace'}
          </PText>
        </div>
      </div>

      {/* Right login form */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 lg:p-16">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-10 justify-center">
            <img
              src={isDark ? '/Logo-Icon.png' : '/Logo-Icon.png'}
              alt="GRAVIUM"
              style={{ height: '36px', filter: isDark ? 'invert(1)' : 'none' }}
            />
            <span className="font-bold text-2xl text-primary" style={{ fontFamily: "'Montserrat', 'Arial Narrow', Arial, sans-serif" }}>OS</span>
          </div>

          <PHeading tag="h1" size="x-large" className="mb-2">
            {portalType === 'admin' ? 'Admin Sign In' : 'Employee Sign In'}
          </PHeading>
          <PText color="contrast-medium" className="mb-8">
            Sign in to your {portalType === 'admin' ? 'admin' : 'employee'} account
          </PText>

          {error && (
            <div className="mb-6">
              <PInlineNotification
                heading="Login failed"
                description={error}
                state="error"
                dismissButton={false}
              />
            </div>
          )}

          <form onSubmit={handleLogin} className="flex flex-col gap-5">
            <div>
              <label className="block text-sm font-medium text-primary mb-1.5" style={{ fontFamily: "'Montserrat', 'Arial Narrow', Arial, sans-serif" }}>
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="you@gravium.com"
                className="w-full px-4 py-3 rounded-lg border-2 border-contrast-low bg-canvas text-primary placeholder:text-contrast-medium focus:outline-none focus:border-primary transition-colors"
                style={{ fontFamily: "'Montserrat', 'Arial Narrow', Arial, sans-serif" }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-primary mb-1.5" style={{ fontFamily: "'Montserrat', 'Arial Narrow', Arial, sans-serif" }}>
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
                  className="w-full px-4 py-3 rounded-lg border-2 border-contrast-low bg-canvas text-primary placeholder:text-contrast-medium focus:outline-none focus:border-primary transition-colors pr-16"
                  style={{ fontFamily: "'Montserrat', 'Arial Narrow', Arial, sans-serif" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-contrast-medium hover:text-primary transition-colors"
                  style={{ fontFamily: "'Montserrat', 'Arial Narrow', Arial, sans-serif" }}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <PButton type="submit" loading={loading} className="mt-2">
              Sign In
            </PButton>
            <button type="submit" className="hidden" tabIndex={-1} aria-hidden="true">Submit</button>
          </form>

          <div className="mt-8 pt-6 border-t border-contrast-low">
            {portalType === 'admin' ? (
              <div className="flex flex-col gap-3 text-center">
                <PText color="contrast-medium" size="x-small">
                  Employee?{' '}
                  <Link to="/login/employee" className="text-primary underline font-medium">
                    Switch to Employee Portal
                  </Link>
                </PText>
                <PText color="contrast-medium" size="x-small">
                  First time?{' '}
                  <Link to="/admin/create" className="text-primary underline font-medium">
                    Create Admin Account
                  </Link>
                </PText>
              </div>
            ) : (
              <PText color="contrast-medium" size="x-small" className="text-center">
                Admin?{' '}
                <Link to="/login/admin" className="text-primary underline font-medium">
                  Switch to Admin Portal
                </Link>
              </PText>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

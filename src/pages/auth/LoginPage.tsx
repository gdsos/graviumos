import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useNavigate, Link } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { Button } from '../../components/ui/button';

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
    <div className={`min-h-screen flex ${isDark ? 'bg-black' : 'bg-white'}`}>
      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden p-16 flex-col items-center justify-center">

        {/* Background Image */}
        <img
          src="/loginbg.jpg"
          alt="Background"
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Optional dark overlay for readability */}
        <div className="absolute inset-0 bg-black/75" />

        {/* Foreground content (unchanged) */}
        <div className="relative z-10 flex flex-col items-center text-center">

          <div className="flex items-center gap-2 mb-8">
            <img
              src="/Logo-Icon.png"
              alt="GRAVIUM"
              className="h-10 brightness-0 invert"
              style={{ height: '200px' }}
            />
          </div>
        </div>
      </div>

      {/* Right login form */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 lg:p-16">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-10 justify-center">
            <img
              src={isDark ? '/GRAVIUM.png' : '/GRAVIUM.png'}
              alt="GRAVIUM"
              style={{ height: '30px', filter: isDark ? 'invert(1)' : 'none' }}
            />
            <span className="font-medium text-2xl text-black">OS</span>
          </div>

          <h1 className="text-2xl font-bold mb-2 text-black">
            {portalType === 'admin' ? 'Admin Sign In' : 'Employee Sign In'}
          </h1>
          <p className="text-xs text-black mb-8">
            Sign in to your {portalType === 'admin' ? 'admin' : 'employee'} account
          </p>

          {error && (
            <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200">
              <p className="text-sm font-medium text-red-900">Login failed</p>
              <p className="text-sm text-red-800 mt-1">{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="flex flex-col gap-5">
            <div>
              <label className="block text-sm font-medium text-black mb-1.5">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="you@gravium.com"
                className="w-full px-4 py-3 rounded-lg border-2 border-black bg-white text-black font-medium placeholder:text-small text-black/72 focus:outline-none focus:border-black transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-black mb-1.5">
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
                  className="w-full px-4 py-3 rounded-lg border-2 border-black bg-white text-black placeholder:text-black/50 focus:outline-none focus:border-black transition-colors pr-16"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-black/50 hover:text-black transition-colors"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <Button 
              type="submit" 
              disabled={loading}
              className="mt-2 w-full"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          <div className="mt-8 pt-6 border-t border-black">
            {portalType === 'admin' ? (
              <div className="flex flex-col gap-3 text-center">
                <p className="text-sm text-black">
                  Employee?{' '}
                  <Link to="/login/employee" className="text-black underline font-medium hover:text-black">
                    Switch to Employee Portal
                  </Link>
                </p>
                <p className="text-sm text-black">
                  First time?{' '}
                  <Link to="/admin/create" className="text-black underline font-medium hover:text-black">
                    Create Admin Account
                  </Link>
                </p>
              </div>
            ) : (
              <p className="text-sm text-black text-center">
                Admin?{' '}
                <Link to="/login/admin" className="text-black underline font-medium hover:text-black">
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

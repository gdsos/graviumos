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
    <div className={`min-h-screen flex ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
      {/* Left branding panel - placeholder background that can be replaced with image */}
      <div className="hidden lg:flex lg:w-1/2 bg-slate-950 flex-col items-center justify-center p-16 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
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
            <span className="text-white font-bold text-3xl tracking-tight">OS</span>
          </div>
          <h2 className="text-2xl font-bold text-white mb-4">
            {portalType === 'admin' ? 'Admin Portal' : 'Employee Portal'}
          </h2>
          <p className="text-slate-300">
            {portalType === 'admin'
              ? 'Full control over your organization'
              : 'Your personal workspace'}
          </p>
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
            <span className="font-bold text-2xl text-slate-900">OS</span>
          </div>

          <h1 className="text-3xl font-bold mb-2">
            {portalType === 'admin' ? 'Admin Sign In' : 'Employee Sign In'}
          </h1>
          <p className="text-slate-600 mb-8">
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
              <label className="block text-sm font-medium text-slate-900 mb-1.5">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="you@gravium.com"
                className="w-full px-4 py-3 rounded-lg border-2 border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-1.5">
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
                  className="w-full px-4 py-3 rounded-lg border-2 border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 transition-colors pr-16"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
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

          <div className="mt-8 pt-6 border-t border-slate-200">
            {portalType === 'admin' ? (
              <div className="flex flex-col gap-3 text-center">
                <p className="text-sm text-slate-600">
                  Employee?{' '}
                  <Link to="/login/employee" className="text-slate-900 underline font-medium hover:text-slate-700">
                    Switch to Employee Portal
                  </Link>
                </p>
                <p className="text-sm text-slate-600">
                  First time?{' '}
                  <Link to="/admin/create" className="text-slate-900 underline font-medium hover:text-slate-700">
                    Create Admin Account
                  </Link>
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-600 text-center">
                Admin?{' '}
                <Link to="/login/admin" className="text-slate-900 underline font-medium hover:text-slate-700">
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

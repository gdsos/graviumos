import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { Lock } from 'lucide-react';

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

    // Verify admin key
    if (!adminKey.trim()) {
      setError('Admin Key is required.');
      return;
    }

    setLoading(true);

    // Fetch the admin key from org_settings
    const { data: settings, error: settingsErr } = await supabase
      .from('org_settings')
      .select('admin_key')
      .maybeSingle();

    if (settingsErr) {
      setError('Failed to verify admin key. Please try again.');
      setLoading(false);
      return;
    }

    if (!settings || settings.admin_key !== adminKey.trim()) {
      setError('Invalid Admin Key. Contact the Super Admin to get the correct key.');
      setLoading(false);
      return;
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role: 'super_admin' },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      // Update profile to super_admin
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
    <div className="min-h-screen flex items-center justify-center bg-white p-8">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 mb-10 justify-center">
          <img src="/GRAVIUM.png" alt="GRAVIUM" style={{ height: '36px' }} />
          <span className="font-bold text-2xl text-slate-900">OS</span>
        </div>

        <h1 className="text-3xl font-bold mb-2">
          Create Admin Account
        </h1>
        <p className="text-slate-600 mb-8">
          Set up your Super Admin account for GRAVIUM OS
        </p>

        {success && (
          <div className="mb-6 p-4 rounded-lg bg-green-50 border border-green-200">
            <p className="text-sm font-medium text-green-900">Admin account created!</p>
            <p className="text-sm text-green-800 mt-1">Redirecting to login...</p>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200">
            <p className="text-sm font-medium text-red-900">Error</p>
            <p className="text-sm text-red-800 mt-1">{error}</p>
          </div>
        )}

        <form onSubmit={handleCreate} className="flex flex-col gap-5">
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-1.5">
              Full Name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              required
              placeholder="John Doe"
              className="w-full px-4 py-3 rounded-lg border-2 border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-1.5">
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="admin@gravium.com"
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
                placeholder="Min. 8 characters"
                className="w-full px-4 py-3 rounded-lg border-2 border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 transition-colors pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-900 transition-colors text-sm"
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-1.5">
              Confirm Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
              placeholder="Repeat password"
              className="w-full px-4 py-3 rounded-lg border-2 border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-1.5">
              Admin Key
            </label>
            <div className="relative">
              <input
                type="password"
                value={adminKey}
                onChange={e => setAdminKey(e.target.value)}
                required
                placeholder="Enter the admin key"
                className="w-full px-4 py-3 rounded-lg border-2 border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 transition-colors pr-12"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Lock size={18} className="text-slate-600" />
              </div>
            </div>
            <p className="text-xs text-slate-600 mt-1">
              Contact the Super Admin to obtain the admin key.
            </p>
          </div>

          <Button 
            type="submit" 
            disabled={loading}
            className="mt-2 w-full"
          >
            {loading ? 'Creating...' : 'Create Admin Account'}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-xs text-slate-600">
            Already have an account?{' '}
            <Link to="/login/admin" className="text-slate-900 underline font-medium hover:text-slate-700">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

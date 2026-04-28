import { useState } from 'react';
import { PButton, PText, PHeading, PInlineNotification, PIcon } from '@porsche-design-system/components-react';
import { supabase } from '../../lib/supabase';
import { useNavigate, Link } from 'react-router-dom';

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
    <div className="min-h-screen flex items-center justify-center bg-canvas p-8">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 mb-10 justify-center">
          <img src="/GRAVIUM.png" alt="GRAVIUM" style={{ height: '36px' }} className="dark:invert" />
          <span className="font-bold text-2xl text-primary">OS</span>
        </div>

        <PHeading tag="h1" size="x-large" className="mb-2">
          Create Admin Account
        </PHeading>
        <PText color="contrast-medium" className="mb-8">
          Set up your Super Admin account for GRAVIUM OS
        </PText>

        {success && (
          <div className="mb-6">
            <PInlineNotification
              heading="Admin account created!"
              description="Redirecting to login..."
              state="success"
              dismissButton={false}
            />
          </div>
        )}

        {error && (
          <div className="mb-6">
            <PInlineNotification
              heading="Error"
              description={error}
              state="error"
              dismissButton={false}
            />
          </div>
        )}

        <form onSubmit={handleCreate} className="flex flex-col gap-5">
          <div>
            <label className="block text-sm font-medium text-primary mb-1.5" >
              Full Name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              required
              placeholder="John Doe"
              className="w-full px-4 py-3 rounded-lg border-2 border-contrast-low bg-canvas text-primary placeholder:text-contrast-medium focus:outline-none focus:border-primary transition-colors"
              
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-primary mb-1.5" >
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="admin@gravium.com"
              className="w-full px-4 py-3 rounded-lg border-2 border-contrast-low bg-canvas text-primary placeholder:text-contrast-medium focus:outline-none focus:border-primary transition-colors"
              
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-primary mb-1.5" >
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="Min. 8 characters"
                className="w-full px-4 py-3 rounded-lg border-2 border-contrast-low bg-canvas text-primary placeholder:text-contrast-medium focus:outline-none focus:border-primary transition-colors pr-12"
                
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-contrast-medium hover:text-primary transition-colors text-sm"
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-primary mb-1.5" >
              Confirm Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
              placeholder="Repeat password"
              className="w-full px-4 py-3 rounded-lg border-2 border-contrast-low bg-canvas text-primary placeholder:text-contrast-medium focus:outline-none focus:border-primary transition-colors"
              
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-primary mb-1.5" >
              Admin Key
            </label>
            <div className="relative">
              <input
                type="password"
                value={adminKey}
                onChange={e => setAdminKey(e.target.value)}
                required
                placeholder="Enter the admin key"
                className="w-full px-4 py-3 rounded-lg border-2 border-contrast-low bg-canvas text-primary placeholder:text-contrast-medium focus:outline-none focus:border-primary transition-colors pr-12"
                
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <PIcon name="key" size="small" color="contrast-medium" />
              </div>
            </div>
            <PText size="x-small" color="contrast-medium" className="mt-1">
              Contact the Super Admin to obtain the admin key.
            </PText>
          </div>

          <button type="submit" className="hidden" tabIndex={-1} aria-hidden="true">Submit</button>

          <PButton type="submit" loading={loading} className="mt-2">
            Create Admin Account
          </PButton>
        </form>

        <div className="mt-6 text-center">
          <PText color="contrast-medium" size="x-small">
            Already have an account?{' '}
            <Link to="/login/admin" className="text-primary underline font-medium">
              Sign in
            </Link>
          </PText>
        </div>
      </div>
    </div>
  );
}

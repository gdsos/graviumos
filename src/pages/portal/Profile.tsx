import { useState, useEffect, useCallback, useRef } from 'react';
import {
  PHeading,
  PText,
  PButton,
  PTag,
  PIcon,
  PInlineNotification,
  PModal,
} from '@porsche-design-system/components-react';
import {
  supabase,
  type ApprovalRequest,
} from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

// ─── Constants ────────────────────────────────────────────────────────────────

const FONT = "inherit";

interface ProfileFormState {
  profile_picture_url: string;
  phone: string;
  address: string;
  github: string;
  linkedin: string;
  twitter: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function FormField({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label
        className="block text-xs font-medium text-contrast-high"
        
      >
        {label}
      </label>
      {children}
      {hint && (
        <PText size="xx-small" color="contrast-medium" >
          {hint}
        </PText>
      )}
    </div>
  );
}

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <PText size="xx-small" color="contrast-medium" className="uppercase tracking-wider" >
        {label}
      </PText>
      <PText size="small" >
        {value || '—'}
      </PText>
    </div>
  );
}

// ─── KPI Progress Bar ─────────────────────────────────────────────────────────

function KpiBar({ score }: { score: number }) {
  const pct = Math.min(Math.max((score / 10) * 100, 0), 100);
  let color = '#2e7d32';
  if (score === 0) color = '#c62828';
  else if (score < 7.5) color = '#ed6c02';
  else if (score < 10) color = '#0288d1';

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <PText size="x-small" color="contrast-medium" >
          KPI Score
        </PText>
        <PText size="x-small" weight="semi-bold" style={{ fontFamily: FONT, color }}>
          {score.toFixed(1)} / 10
        </PText>
      </div>
      <div className="w-full bg-contrast-low/30 rounded-full h-2 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <PText size="xx-small" color="contrast-medium" >
        {score >= 8 ? 'Excellent' : score >= 6 ? 'Good' : score >= 4 ? 'Average' : 'Needs improvement'}
      </PText>
    </div>
  );
}

// ─── Avatar component ─────────────────────────────────────────────────────────

function Avatar({ url, name }: { url: string; name: string }) {
  const initials = name
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="relative w-24 h-24 flex-shrink-0">
      {url ? (
        <img
          src={url}
          alt={name}
          className="w-24 h-24 rounded-full object-cover border-4 border-contrast-low"
          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      ) : (
        <div
          className="w-24 h-24 rounded-full flex items-center justify-center border-4 border-contrast-low bg-surface"
          style={{ background: 'var(--p-color-contrast-low)' }}
        >
          <span
            className="text-2xl font-bold text-background-base"
            
          >
            {initials || '?'}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { profile, userDepartments, refreshProfile } = useAuth();

  // Edit form state
  const [form, setForm] = useState<ProfileFormState>({
    profile_picture_url: '',
    phone: '',
    address: '',
    github: '',
    linkedin: '',
    twitter: '',
  });
  const [formDirty, setFormDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Task count
  const [taskCount, setTaskCount] = useState<number | null>(null);

  // Name change request
  const [nameRequest, setNameRequest] = useState<ApprovalRequest | null>(null);
  const [showNameModal, setShowNameModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [nameRequestLoading, setNameRequestLoading] = useState(false);
  const [nameRequestError, setNameRequestError] = useState('');
  const [nameRequestSuccess, setNameRequestSuccess] = useState(false);

  // File upload ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500000) {
      setSaveError('Image must be under 500KB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      updateForm('profile_picture_url', result);
    };
    reader.readAsDataURL(file);
  };

  // ─── Init form from profile ─────────────────────────────────────────────

  useEffect(() => {
    if (!profile) return;
    setForm({
      profile_picture_url: profile.profile_picture_url || '',
      phone: profile.phone || '',
      address: profile.address || '',
      github: profile.social_links?.github || '',
      linkedin: profile.social_links?.linkedin || '',
      twitter: profile.social_links?.twitter || '',
    });
    setFormDirty(false);
  }, [profile]);

  // ─── Fetch task count ───────────────────────────────────────────────────

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const { count } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_to', profile.id);
      setTaskCount(count ?? 0);
    })();
  }, [profile]);

  // ─── Fetch pending name change request ──────────────────────────────────

  const fetchNameRequest = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('approval_requests')
      .select('*')
      .eq('user_id', profile.id)
      .eq('type', 'name_change')
      .eq('status', 'Pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setNameRequest(data as ApprovalRequest | null);
  }, [profile]);

  useEffect(() => {
    fetchNameRequest();
  }, [fetchNameRequest]);

  // ─── Handle profile save ────────────────────────────────────────────────

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    setSaveError('');
    setSaveSuccess(false);

    const { error } = await supabase
      .from('profiles')
      .update({
        profile_picture_url: form.profile_picture_url.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        social_links: {
          github: form.github.trim(),
          linkedin: form.linkedin.trim(),
          twitter: form.twitter.trim(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile.id);

    setSaving(false);
    if (error) {
      setSaveError(error.message);
    } else {
      setSaveSuccess(true);
      setFormDirty(false);
      refreshProfile();
      setTimeout(() => setSaveSuccess(false), 4000);
    }
  };

  // ─── Handle name change request ──────────────────────────────────────────

  const handleRequestNameChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !newName.trim()) return;
    if (newName.trim() === profile.full_name) {
      setNameRequestError('New name is the same as the current name.');
      return;
    }

    setNameRequestLoading(true);
    setNameRequestError('');

    const { error } = await supabase.from('approval_requests').insert({
      user_id: profile.id,
      type: 'name_change',
      payload: { new_name: newName.trim(), current_name: profile.full_name },
      status: 'Pending',
    });

    if (!error) {
      // Send notification to all super admins
      const { data: admins } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'super_admin')
        .eq('is_active', true);

      if (admins && admins.length > 0) {
        const notifs = admins.map(a => ({
          user_id: a.id,
          title: 'Name Change Request',
          message: `${profile.full_name} has requested a name change to "${newName.trim()}"`,
          type: 'approval' as const,
          is_read: false,
          link: '/admin/people',
        }));
        await supabase.from('notifications').insert(notifs);
      }
    }

    setNameRequestLoading(false);
    if (error) {
      setNameRequestError(error.message);
    } else {
      setNameRequestSuccess(true);
      setShowNameModal(false);
      setNewName('');
      fetchNameRequest();
    }
  };

  const updateForm = (field: keyof ProfileFormState, value: string) => {
    setForm(f => ({ ...f, [field]: value }));
    setFormDirty(true);
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (!profile) {
    return (
      <div className="flex items-center justify-center h-48">
        <PText color="contrast-medium" >
          Loading profile…
        </PText>
      </div>
    );
  }

  const joinDate = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : '—';

  const roleLabel: Record<string, string> = {
    super_admin: 'Super Admin',
    department_head: 'Department Head',
    employee: 'Employee',
  };

  return (
    <div className="max-w-4xl mx-auto" >
      {/* Header */}
      <div className="mb-8">
        <PHeading tag="h1" size="x-large" className="mb-1">
          My Profile
        </PHeading>
        <PText color="contrast-medium" >
          Manage your personal information and preferences
        </PText>
      </div>

      <div className="flex flex-col gap-5">
        {/* ── Identity Card ──────────────────────────────────────────────── */}
        <div className="bg-surface rounded-2xl border border-contrast-low p-6">
          <div className="flex flex-col sm:flex-row gap-5 items-start">
            {/* Avatar */}
            <Avatar url={form.profile_picture_url} name={profile.full_name} />

            {/* Identity info */}
            <div className="flex-1 flex flex-col gap-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <PHeading tag="h2" size="large" >
                    {profile.full_name}
                  </PHeading>
                  {profile.employee_code && (
                    <PText size="x-small" color="contrast-medium" >
                      {profile.employee_code}
                    </PText>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <PTag color="background-surface">
                    {roleLabel[profile.role] || profile.role}
                  </PTag>
                  {!profile.is_active && (
                    <PTag color="notification-error-soft">Inactive</PTag>
                  )}
                </div>
              </div>

              {/* Department badges */}
              <div className="flex flex-wrap gap-2">
                {userDepartments.length > 0 ? (
                  userDepartments.map(dept => (
                    <PTag key={dept.id} color="notification-info-soft">
                      {dept.code} · {dept.name}
                    </PTag>
                  ))
                ) : (
                  <PText size="x-small" color="contrast-low" >
                    No departments assigned
                  </PText>
                )}
              </div>

              {/* Key info row */}
              <div className="flex flex-wrap gap-6">
                <ReadonlyField label="Employee Code" value={profile.employee_code || '—'} />
                <ReadonlyField label="Joined" value={joinDate} />
                <ReadonlyField label="Email" value={profile.email} />
                {taskCount !== null && (
                  <ReadonlyField label="Assigned Tasks" value={String(taskCount)} />
                )}
              </div>
            </div>
          </div>

          {/* KPI bar */}
          <div className="mt-5 pt-4 border-t border-contrast-low">
            <KpiBar score={profile.kpi_score ?? 0} />
          </div>
        </div>

        {/* ── Name Change Section ──────────────────────────────────────────── */}
        <div className="bg-surface rounded-2xl border border-contrast-low p-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <PHeading tag="h3" size="small" >
                Full Name
              </PHeading>
              <PText size="small" color="contrast-medium" className="mt-1" >
                {profile.full_name}
              </PText>
            </div>

            {nameRequest ? (
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-warning-soft border border-contrast-low">
                <PIcon name="clock" size="x-small" color="notification-warning" />
                <div>
                  <PText size="x-small" weight="semi-bold" color="notification-warning" >
                    Name Change Pending
                  </PText>
                  <PText size="xx-small" color="contrast-medium" >
                    Requested: {String((nameRequest.payload as Record<string, string>)?.new_name || '—')}
                  </PText>
                </div>
              </div>
            ) : (
              <PButton
                type="button"
                variant="secondary"
                icon="edit"
                onClick={() => {
                  setNewName(profile.full_name);
                  setNameRequestError('');
                  setShowNameModal(true);
                }}
              >
                Request Name Change
              </PButton>
            )}
          </div>

          {nameRequestSuccess && (
            <div className="mt-3">
              <PInlineNotification
                heading="Name change requested"
                description="Your request is pending admin approval. You'll be notified when it's reviewed."
                state="success"
                dismissButton={false}
              />
            </div>
          )}

          <div className="mt-3">
            <PInlineNotification
              heading="Why approval is needed"
              description="Full name changes require admin review to ensure HR records remain accurate."
              state="info"
              dismissButton={false}
            />
          </div>
        </div>

        {/* ── Editable Profile Fields ──────────────────────────────────────── */}
        <form onSubmit={handleSave} className="bg-surface rounded-2xl border border-contrast-low p-6">
          <PHeading tag="h3" size="small" className="mb-4" >
            Personal Details
          </PHeading>

          {saveError && (
            <PInlineNotification
              heading="Save failed"
              description={saveError}
              state="error"
              dismissButton={false}
              className="mb-4"
            />
          )}
          {saveSuccess && (
            <PInlineNotification
              heading="Profile saved"
              description="Your changes have been saved successfully."
              state="success"
              dismissButton={false}
              className="mb-4"
            />
          )}

          <div className="flex flex-col gap-4">
            <FormField
              label="Profile Picture URL"
              hint="Enter a direct link to your photo (e.g. from Gravatar or a hosted image)"
            >
              <input
                type="url"
                value={form.profile_picture_url}
                onChange={e => updateForm('profile_picture_url', e.target.value)}
                className="form-input"
                placeholder="https://example.com/photo.jpg"
              />
              <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileSelect} />
              <div className="mt-2">
                <PButton type="button" variant="secondary" icon="image" onClick={() => fileInputRef.current?.click()}>Upload Photo</PButton>
              </div>
            </FormField>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Phone Number">
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => updateForm('phone', e.target.value)}
                  className="form-input"
                  placeholder="+91 98765 43210"
                />
              </FormField>
            </div>

            <FormField label="Address">
              <textarea
                value={form.address}
                onChange={e => updateForm('address', e.target.value)}
                rows={2}
                className="form-input resize-none"
                placeholder="Street, City, State, PIN"
              />
            </FormField>

            {/* Social links */}
            <div className="pt-2">
              <PText size="x-small" weight="semi-bold" className="mb-3" >
                Social Links
              </PText>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FormField label="GitHub">
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2">
                      <PIcon name="external" size="x-small" color="contrast-medium" />
                    </div>
                    <input
                      type="url"
                      value={form.github}
                      onChange={e => updateForm('github', e.target.value)}
                      className="form-input pl-9"
                      placeholder="https://github.com/username"
                    />
                  </div>
                </FormField>

                <FormField label="LinkedIn">
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2">
                      <PIcon name="logo-linkedin" size="x-small" color="contrast-medium" />
                    </div>
                    <input
                      type="url"
                      value={form.linkedin}
                      onChange={e => updateForm('linkedin', e.target.value)}
                      className="form-input pl-9"
                      placeholder="https://linkedin.com/in/username"
                    />
                  </div>
                </FormField>

                <FormField label="Twitter / X">
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2">
                      <PIcon name="logo-x" size="x-small" color="contrast-medium" />
                    </div>
                    <input
                      type="url"
                      value={form.twitter}
                      onChange={e => updateForm('twitter', e.target.value)}
                      className="form-input pl-9"
                      placeholder="https://x.com/username"
                    />
                  </div>
                </FormField>
              </div>
            </div>

            {/* Social links display (read-only chips if filled) */}
            {(form.github || form.linkedin || form.twitter) && (
              <div className="flex flex-wrap gap-2 pt-1">
                {form.github && (
                  <a
                    href={form.github}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-contrast-low bg-canvas text-contrast-medium hover:text-primary hover:border-primary transition-colors text-xs"
                    
                  >
                    <PIcon name="external" size="x-small" color="inherit" />
                    GitHub
                  </a>
                )}
                {form.linkedin && (
                  <a
                    href={form.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-contrast-low bg-canvas text-contrast-medium hover:text-primary hover:border-primary transition-colors text-xs"
                    
                  >
                    <PIcon name="logo-linkedin" size="x-small" color="inherit" />
                    LinkedIn
                  </a>
                )}
                {form.twitter && (
                  <a
                    href={form.twitter}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-contrast-low bg-canvas text-contrast-medium hover:text-primary hover:border-primary transition-colors text-xs"
                    
                  >
                    <PIcon name="logo-x" size="x-small" color="inherit" />
                    Twitter / X
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Save button */}
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-contrast-low">
            {formDirty && (
              <PButton
                type="button"
                variant="secondary"
                onClick={() => {
                  if (profile) {
                    setForm({
                      profile_picture_url: profile.profile_picture_url || '',
                      phone: profile.phone || '',
                      address: profile.address || '',
                      github: profile.social_links?.github || '',
                      linkedin: profile.social_links?.linkedin || '',
                      twitter: profile.social_links?.twitter || '',
                    });
                    setFormDirty(false);
                  }
                }}
              >
                Discard Changes
              </PButton>
            )}
            <PButton
              type="submit"
              loading={saving}
              disabled={!formDirty}
              icon="check"
            >
              Save Profile
            </PButton>
          </div>
        </form>

        {/* ── Account info (readonly) ──────────────────────────────────────── */}
        <div className="bg-surface rounded-2xl border border-contrast-low p-6">
          <PHeading tag="h3" size="small" className="mb-4" >
            Account Information
          </PHeading>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
            <ReadonlyField label="Email" value={profile.email} />
            <ReadonlyField label="Employee Code" value={profile.employee_code || '—'} />
            <ReadonlyField label="Role" value={roleLabel[profile.role] || profile.role} />
            <ReadonlyField label="Joined" value={joinDate} />
            <ReadonlyField
              label="Departments"
              value={userDepartments.map(d => d.code).join(', ') || '—'}
            />
            <ReadonlyField
              label="Account Status"
              value={profile.is_active ? 'Active' : 'Inactive'}
            />
          </div>
        </div>
      </div>

      {/* ── Name Change Modal ──────────────────────────────────────────────── */}
      <PModal
        open={showNameModal}
        onDismiss={() => !nameRequestLoading && setShowNameModal(false)}
        aria={{ 'aria-label': 'Request name change' }}
        style={{ '--p-modal-width': 'clamp(320px, 40vw, 520px)' } as React.CSSProperties}
      >
        <PHeading slot="header" size="large" tag="h2">
          Request Name Change
        </PHeading>

        <form onSubmit={handleRequestNameChange} className="flex flex-col gap-4">
          <PInlineNotification
            heading="This requires admin approval"
            description="Your request will be reviewed by an administrator before the change takes effect."
            state="info"
            dismissButton={false}
          />

          {nameRequestError && (
            <PInlineNotification
              heading="Error"
              description={nameRequestError}
              state="error"
              dismissButton={false}
            />
          )}

          <div className="flex flex-col gap-1">
            <label
              className="block text-xs font-medium text-contrast-high"
              
            >
              Current Name
            </label>
            <div className="px-3 py-2 rounded-lg border border-contrast-low bg-canvas/50">
              <PText size="small" color="contrast-medium" >
                {profile.full_name}
              </PText>
            </div>
          </div>

          <FormField label="New Full Name *">
            <input
              type="text"
              required
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="form-input"
              placeholder="Enter your desired full name"
              autoFocus
            />
          </FormField>

          <div slot="footer" className="flex gap-3 justify-end pt-2">
            <PButton
              type="button"
              variant="secondary"
              onClick={() => setShowNameModal(false)}
              disabled={nameRequestLoading}
            >
              Cancel
            </PButton>
            <PButton
              type="submit"
              loading={nameRequestLoading}
              icon="check"
              disabled={!newName.trim() || newName.trim() === profile.full_name}
            >
              Submit Request
            </PButton>
          </div>
        </form>
      </PModal>
    </div>
  );
}

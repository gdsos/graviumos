import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Camera,
  Check,
  CheckCircle,
  Clock,
  Edit3,
  ExternalLink,
  Link,
  X,
  AlertTriangle,
  Bell,
  BellOff,
} from 'lucide-react';
import {
  supabase,
  type ApprovalRequest,
} from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { PageHeader } from '../../components/common/PageHeader';
import { PhoneNumberInput } from '../../components/common/PhoneNumberInput';
import {
  disablePushNotifications,
  enablePushNotifications,
  getExistingPushSubscription,
  getPushSupportStatus,
  type PushSupportStatus,
} from '../../lib/pushNotifications';

interface ProfileFormState {
  profile_picture_url: string;
  phone: string;
  address: string;
  instagram: string;
  linkedin: string;
  twitter: string;
}

// ??? Helpers ??????????????????????????????????????????????????????????????????

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
    <div className="flex flex-col gap-1.5">
      <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </label>
      {children}
      {hint && (
        <p className="text-xs leading-5 text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </span>
      <span className="text-sm font-medium text-foreground">
        {value || '?'}
      </span>
    </div>
  );
}

function Badge({
  children,
  tone = 'default',
}: {
  children: React.ReactNode;
  tone?: 'default' | 'info' | 'danger' | 'warning';
}) {
  const toneClass =
    tone === 'info'
      ? 'border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300'
      : tone === 'danger'
        ? 'border-destructive/20 bg-destructive/10 text-destructive'
        : tone === 'warning'
          ? 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300'
          : 'border-border bg-background text-muted-foreground';

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${toneClass}`}>
      {children}
    </span>
  );
}

function InlineNotice({
  tone,
  title,
  description,
  className = '',
}: {
  tone: 'success' | 'error' | 'info' | 'warning';
  title: string;
  description: string;
  className?: string;
}) {
  const isSuccess = tone === 'success';
  const isError = tone === 'error';
  const isWarning = tone === 'warning';

  return (
    <div
      className={`flex gap-3 rounded-2xl border p-4 text-sm ${
        isSuccess
          ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
          : isError
            ? 'border-destructive/20 bg-destructive/10 text-destructive'
            : isWarning
              ? 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300'
              : 'border-border bg-card text-card-foreground'
      } ${className}`}
    >
      {isSuccess ? (
        <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
      ) : isError || isWarning ? (
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      ) : (
        <Link className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      )}

      <div className="min-w-0">
        <p className="font-semibold">{title}</p>
        <p className="mt-0.5 text-xs leading-5">{description}</p>
      </div>
    </div>
  );
}

// ??? KPI Progress Bar ?????????????????????????????????????????????????????????

function PerformanceOverview({
  taskCount,
  isActive,
}: {
  taskCount: number | null;
  isActive: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Performance Overview
          </p>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            A practical snapshot of measurable work activity. Deeper KPI scoring will be added after attendance, task completion, and deadline tracking are fully connected.
          </p>
        </div>

        <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
          isActive
            ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
            : 'border-destructive/20 bg-destructive/10 text-destructive'
        }`}>
          {isActive ? 'Active' : 'Inactive'}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Attendance
          </p>
          <p className="mt-1 text-sm font-semibold text-foreground">Not Tracked Yet</p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-0 rounded-full bg-primary" />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Task Completion
          </p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {taskCount ?? 0} Assigned
          </p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Completion rate pending task status logic.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            On-Time Rate
          </p>
          <p className="mt-1 text-sm font-semibold text-foreground">Not Tracked Yet</p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Deadline tracking will power this later.
          </p>
        </div>
      </div>
    </div>
  );
}

// ??? Avatar component ?????????????????????????????????????????????????????????

function Avatar({
  url,
  name,
  onUpload,
}: {
  url: string;
  name: string;
  onUpload?: () => void;
}) {
  const initials = name
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <button
      type="button"
      onClick={onUpload}
      className="group relative h-24 w-24 shrink-0 overflow-hidden rounded-full border-4 border-border bg-card"
      aria-label="Upload profile photo"
      title="Upload profile photo"
    >
      {url ? (
        <img
          src={url}
          alt={name}
          className="h-full w-full object-cover"
          onError={event => { (event.target as HTMLImageElement).style.display = 'none'; }}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <span className="text-2xl font-semibold text-foreground">
            {initials || '?'}
          </span>
        </div>
      )}

      <span className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition-opacity group-hover:opacity-100">
        <Camera className="h-5 w-5 text-white" />
      </span>
    </button>
  );
}

// ??? Main Component ???????????????????????????????????????????????????????????

export default function ProfilePage() {
  const { profile, userDepartments, refreshProfile } = useAuth();

  // Edit form state
  const [form, setForm] = useState<ProfileFormState>({
    profile_picture_url: '',
    phone: '',
    address: '',
    instagram: '',
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
  const [pushStatus, setPushStatus] = useState<PushSupportStatus>('unsupported');
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushSaving, setPushSaving] = useState(false);
  const [pushMessage, setPushMessage] = useState('');
  const [newName, setNewName] = useState('');
  const [nameRequestLoading, setNameRequestLoading] = useState(false);
  const [nameRequestError, setNameRequestError] = useState('');

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

  // ——— Init form from profile —————————————————————————————————————————————

  useEffect(() => {
    if (!profile) return;
    setForm({
      profile_picture_url: profile.profile_picture_url || '',
      phone: profile.phone || '',
      address: profile.address || '',
      instagram: profile.social_links?.instagram || '',
      linkedin: profile.social_links?.linkedin || '',
      twitter: profile.social_links?.twitter || '',
    });
    setFormDirty(false);
  }, [profile]);

  // ——— Fetch task count ———————————————————————————————————————————————————

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

  // ——— Fetch pending name change request ——————————————————————————————————

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

  // ——— Handle profile save ————————————————————————————————————————————————

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
          instagram: form.instagram.trim(),
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

  // ——— Handle name change request ——————————————————————————————————————————

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
      setShowNameModal(false);
      setNewName('');
      fetchNameRequest();
    }
  };

  const updateForm = (field: keyof ProfileFormState, value: string) => {
    setForm(f => ({ ...f, [field]: value }));
    setFormDirty(true);
  };

  // ——— Render ———————————————————————————————————————————————————————————————

  useEffect(() => {
    let mounted = true;

    const checkPushStatus = async () => {
      const status = getPushSupportStatus();
      const subscription = await getExistingPushSubscription();

      if (!mounted) return;

      setPushStatus(status);
      setPushEnabled(Boolean(subscription));
    };

    checkPushStatus();

    return () => {
      mounted = false;
    };
  }, []);

  const handleTogglePushNotifications = async () => {
    if (!profile) return;

    setPushSaving(true);
    setPushMessage('');

    try {
      if (pushEnabled) {
        await disablePushNotifications(profile.id);
        setPushEnabled(false);
        setPushMessage('Push notifications disabled for this device.');
      } else {
        const result = await enablePushNotifications(profile.id);

        if (!result.ok) {
          setPushStatus(result.status);
          setPushMessage(
            result.status === 'not-configured'
              ? 'Push notifications are not configured yet.'
              : result.status === 'blocked'
                ? 'Notifications are blocked in this browser.'
                : 'Push notifications are not supported on this device.'
          );
          return;
        }

        setPushStatus('supported');
        setPushEnabled(true);
        setPushMessage('Push notifications enabled for this device.');
      }
    } catch (error) {
      console.error(error);
      setPushMessage('Could not update push notifications.');
    } finally {
      setPushSaving(false);
    }
  };

  if (!profile) {
    return (
      <div className="flex h-48 items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading profile...</p>
      </div>
    );
  }

  const joinDate = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
    : '?';

  const roleLabel: Record<string, string> = {
    super_admin: 'Super Admin',
    department_head: 'Department Head',
    employee: 'Employee',
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 pb-32 sm:px-6 lg:px-8 lg:pb-6">
      <PageHeader
        eyebrow="Account Settings"
        title="Account"
        description="Manage your account settings and personal information."
      />

      <div className="flex flex-col gap-5">
        <section className="rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm sm:p-6">
          <div className="flex flex-col items-start gap-5 sm:flex-row">
            <Avatar
              url={form.profile_picture_url}
              name={profile.full_name}
              onUpload={() => fileInputRef.current?.click()}
            />
            <input
              type="file"
              accept="image/*"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileSelect}
            />

            <div className="flex flex-1 flex-col gap-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-semibold text-foreground">{profile.full_name}</h2>

                    {nameRequest ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
                        <Clock className="h-3.5 w-3.5" />
                        Name Change Pending
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setNewName(profile.full_name);
                          setNameRequestError('');
                          setShowNameModal(true);
                        }}
                        className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        Request Name Change
                      </button>
                    )}
                  </div>

                  {profile.employee_code && (
                    <p className="mt-1 text-xs text-muted-foreground">{profile.employee_code}</p>
                  )}

                  {nameRequest && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Requested: {String((nameRequest.payload as Record<string, string>)?.new_name || '?')}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge>{roleLabel[profile.role] || profile.role}</Badge>
                  {!profile.is_active && <Badge tone="danger">Inactive</Badge>}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {userDepartments.length > 0 ? (
                  userDepartments.map(dept => (
                    <Badge key={dept.id} tone="info">
                      {dept.code} - {dept.name}
                    </Badge>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">No departments assigned</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <ReadonlyField label="Employee Code" value={profile.employee_code || '?'} />
                <ReadonlyField label="Joined" value={joinDate} />
                <ReadonlyField label="Email" value={profile.email} />
                {taskCount !== null && (
                  <ReadonlyField label="Assigned Tasks" value={String(taskCount)} />
                )}
              </div>
            </div>
          </div>

          <div className="mt-5 border-t border-border pt-4">
            <PerformanceOverview
              taskCount={taskCount}
              isActive={profile.is_active}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Notification Preferences</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Enable push notifications for task updates and important Gravium OS alerts on this device.
              </p>

              {pushMessage && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {pushMessage}
                </p>
              )}

              {pushStatus === 'not-configured' && (
                <p className="mt-2 text-xs text-amber-600 dark:text-amber-300">
                  VAPID public key is not configured yet. We will enable this after server setup.
                </p>
              )}

              {pushStatus === 'blocked' && (
                <p className="mt-2 text-xs text-destructive">
                  Notifications are blocked in this browser. Enable them from browser site settings.
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={handleTogglePushNotifications}
              disabled={pushSaving || pushStatus === 'unsupported' || pushStatus === 'not-configured'}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pushEnabled ? (
                <>
                  <BellOff className="h-4 w-4" />
                  Disable Notifications
                </>
              ) : (
                <>
                  <Bell className="h-4 w-4" />
                  Enable Notifications
                </>
              )}
            </button>
          </div>
        </section>


        <form onSubmit={handleSave} className="rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm sm:p-6">
          <h3 className="mb-4 text-sm font-semibold text-foreground">Personal Details</h3>

          {saveError && (
            <InlineNotice
              tone="error"
              title="Save Failed"
              description={saveError}
              className="mb-4"
            />
          )}

          {saveSuccess && (
            <InlineNotice
              tone="success"
              title="Profile Saved"
              description="Your changes have been saved successfully."
              className="mb-4"
            />
          )}

          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Phone Number">
                <PhoneNumberInput
                  value={form.phone}
                  onChange={value => updateForm('phone', value)}
                />
              </FormField>
            </div>

            <FormField label="Address">
              <textarea
                value={form.address}
                onChange={event => updateForm('address', event.target.value)}
                rows={2}
                className="form-input resize-none"
                placeholder="Street, City, State, PIN"
              />
            </FormField>

            <div className="pt-2">
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Social Links</h4>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <FormField label="Instagram">
                  <div className="relative">
                    <ExternalLink className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="url"
                      value={form.instagram}
                      onChange={event => updateForm('instagram', event.target.value)}
                      className="form-input pl-9"
                      placeholder="https://instagram.com/username"
                    />
                  </div>
                </FormField>

                <FormField label="LinkedIn">
                  <div className="relative">
                    <ExternalLink className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="url"
                      value={form.linkedin}
                      onChange={event => updateForm('linkedin', event.target.value)}
                      className="form-input pl-9"
                      placeholder="https://linkedin.com/in/username"
                    />
                  </div>
                </FormField>

                <FormField label="Twitter / X">
                  <div className="relative">
                    <X className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="url"
                      value={form.twitter}
                      onChange={event => updateForm('twitter', event.target.value)}
                      className="form-input pl-9"
                      placeholder="https://x.com/username"
                    />
                  </div>
                </FormField>
              </div>
            </div>

            {(form.instagram || form.linkedin || form.twitter) && (
              <div className="flex flex-wrap gap-2 pt-1">
                {form.instagram && (
                  <a
                    href={form.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Instagram
                  </a>
                )}

                {form.linkedin && (
                  <a
                    href={form.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    LinkedIn
                  </a>
                )}

                {form.twitter && (
                  <a
                    href={form.twitter}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                  >
                    <X className="h-3.5 w-3.5" />
                    Twitter / X
                  </a>
                )}
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-col justify-end gap-2 border-t border-border pt-4 sm:flex-row">
            {formDirty && (
              <button
                type="button"
                onClick={() => {
                  if (profile) {
                    setForm({
                      profile_picture_url: profile.profile_picture_url || '',
                      phone: profile.phone || '',
                      address: profile.address || '',
                      instagram: profile.social_links?.instagram || '',
                      linkedin: profile.social_links?.linkedin || '',
                      twitter: profile.social_links?.twitter || '',
                    });
                    setFormDirty(false);
                  }
                }}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                Discard Changes
              </button>
            )}

            <button
              type="submit"
              disabled={!formDirty || saving}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/60 border-t-transparent" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Save Profile
            </button>
          </div>
        </form>

      </div>

      {showNameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="text-lg font-semibold text-foreground">Request Name Change</h2>
              <button
                type="button"
                onClick={() => !nameRequestLoading && setShowNameModal(false)}
                disabled={nameRequestLoading}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleRequestNameChange} className="flex flex-col gap-4 p-5">
              <InlineNotice
                tone="info"
                title="This Requires Admin Approval"
                description="Your request will be reviewed by an administrator before the change takes effect."
              />

              {nameRequestError && (
                <InlineNotice
                  tone="error"
                  title="Error"
                  description={nameRequestError}
                />
              )}

              <FormField label="Current Name">
                <div className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
                  {profile.full_name}
                </div>
              </FormField>

              <FormField label="New Full Name *">
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={event => setNewName(event.target.value)}
                  className="form-input"
                  placeholder="Enter your desired full name"
                  autoFocus
                />
              </FormField>

              <div className="flex flex-col justify-end gap-2 pt-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setShowNameModal(false)}
                  disabled={nameRequestLoading}
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={!newName.trim() || newName.trim() === profile.full_name || nameRequestLoading}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {nameRequestLoading ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/60 border-t-transparent" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );

}

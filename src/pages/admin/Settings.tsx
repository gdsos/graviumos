import { useState, useEffect, useCallback } from 'react';
import { supabase, type OrgSettings } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { PButton, PHeading, PInlineNotification, PText, PSwitch } from '@/components/ui/porsche';

// ——— Constants ————————————————————————————————————————————————————————————————

const FONT = "'Montserrat', 'Arial Narrow', Arial, sans-serif";

// ——— Helpers ——————————————————————————————————————————————————————————————————

function SectionHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-4">
      <PText size="small" weight="semi-bold" style={{ fontFamily: FONT }}>{title}</PText>
      {description && (
        <PText size="x-small" color="contrast-medium" style={{ fontFamily: FONT }} className="mt-0.5">
          {description}
        </PText>
      )}
    </div>
  );
}

function SettingRow({
  label,
  description,
  children,
  readOnly,
  value,
  suffix,
}: {
  label: string;
  description?: string;
  children?: React.ReactNode;
  readOnly?: boolean;
  value?: string | number;
  suffix?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-6 py-4 border-b border-contrast-low last:border-0">
      <div className="min-w-0 flex-1">
        <PText size="small" style={{ fontFamily: FONT }}>{label}</PText>
        {description && (
          <PText size="x-small" color="contrast-medium" style={{ fontFamily: FONT }} className="mt-0.5">
            {description}
          </PText>
        )}
      </div>
      <div className="w-48 flex-shrink-0">
        {readOnly ? (
          <div className="flex items-center gap-1">
            <PText size="small" weight="semi-bold" style={{ fontFamily: FONT }}>
              {value ?? '—'}
            </PText>
            {suffix && (
              <PText size="x-small" color="contrast-medium" style={{ fontFamily: FONT }}>{suffix}</PText>
            )}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

function NumberInput({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 0.1,
  suffix,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className="form-input"
        style={{ width: suffix ? '100px' : '100%' }}
      />
      {suffix && (
        <PText size="x-small" color="contrast-medium" style={{ fontFamily: FONT }}>{suffix}</PText>
      )}
    </div>
  );
}

// ——— Default form state ———————————————————————————————————————————————————————

interface SettingsForm {
  org_name: string;
  admin_key: string;
  design_fee_pct: string;
  incentive_pct: string;
  commission_pct: string;
  profit_first_profit_pct: string;
  profit_first_opex_pct: string;
  profit_first_tax_pct: string;
  profit_first_owner_pay_pct: string;
}

const defaultForm: SettingsForm = {
  org_name: '',
  admin_key: '',
  design_fee_pct: '15',
  incentive_pct: '20',
  commission_pct: '1.5',
  profit_first_profit_pct: '5',
  profit_first_opex_pct: '65',
  profit_first_tax_pct: '15',
  profit_first_owner_pay_pct: '15',
};

function settingsToForm(s: OrgSettings): SettingsForm {
  return {
    org_name: s.org_name ?? '',
    admin_key: s.admin_key ?? '',
    design_fee_pct: String(s.design_fee_pct ?? 15),
    incentive_pct: String(s.incentive_pct ?? 20),
    commission_pct: String(s.commission_pct ?? 1.5),
    profit_first_profit_pct: String(s.profit_first_profit_pct ?? 5),
    profit_first_opex_pct: String(s.profit_first_opex_pct ?? 65),
    profit_first_tax_pct: String(s.profit_first_tax_pct ?? 15),
    profit_first_owner_pay_pct: String(s.profit_first_owner_pay_pct ?? 15),
  };
}

// ——— Main Component ———————————————————————————————————————————————————————————

export default function Settings() {
  const { isAdmin } = useAuth();
  const isSuperAdmin = isAdmin();

  const [settings, setSettings] = useState<OrgSettings | null>(null);
  const [form, setForm] = useState<SettingsForm>(defaultForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  // Super admins can toggle into edit mode; others are always read-only
  const [editMode, setEditMode] = useState(false);
  const canEdit = isSuperAdmin && editMode;

  // —— Fetch —————————————————————————————————————————————————————————————————

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    const { data, error: fetchErr } = await supabase
      .from('org_settings')
      .select('*')
      .maybeSingle();

    if (fetchErr) {
      setError(fetchErr.message);
    } else if (data) {
      setSettings(data as OrgSettings);
      setForm(settingsToForm(data as OrgSettings));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // —— Derived values ————————————————————————————————————————————————————————

  const profitFirstTotal =
    parseFloat(form.profit_first_profit_pct || '0') +
    parseFloat(form.profit_first_opex_pct || '0') +
    parseFloat(form.profit_first_tax_pct || '0') +
    parseFloat(form.profit_first_owner_pay_pct || '0');

  const profitFirstWarning = Math.abs(profitFirstTotal - 100) > 0.01;

  // —— Save ——————————————————————————————————————————————————————————————————

  const handleSave = async () => {
    setSaving(true);
    setSuccess('');
    setError('');

    const payload = {
      org_name: form.org_name.trim(),
      admin_key: form.admin_key.trim(),
      design_fee_pct: parseFloat(form.design_fee_pct) || 0,
      incentive_pct: parseFloat(form.incentive_pct) || 0,
      commission_pct: parseFloat(form.commission_pct) || 0,
      profit_first_profit_pct: parseFloat(form.profit_first_profit_pct) || 0,
      profit_first_opex_pct: parseFloat(form.profit_first_opex_pct) || 0,
      profit_first_tax_pct: parseFloat(form.profit_first_tax_pct) || 0,
      profit_first_owner_pay_pct: parseFloat(form.profit_first_owner_pay_pct) || 0,
      updated_at: new Date().toISOString(),
    };

    let err: { message: string } | null = null;

    if (settings?.id) {
      const { error: updateErr } = await supabase
        .from('org_settings')
        .update(payload)
        .eq('id', settings.id);
      err = updateErr;
    } else {
      const { error: insertErr } = await supabase
        .from('org_settings')
        .insert(payload);
      err = insertErr;
    }

    setSaving(false);

    if (err) {
      setError(err.message);
      return;
    }

    setSuccess('Settings saved successfully.');
    fetchSettings();
  };

  // —— Reset —————————————————————————————————————————————————————————————————

  const handleReset = () => {
    if (settings) {
      setForm(settingsToForm(settings));
    } else {
      setForm(defaultForm);
    }
    setSuccess('');
    setError('');
  };

  const setField = (key: keyof SettingsForm) => (value: string) => {
    setForm(f => ({ ...f, [key]: value }));
    setSuccess('');
  };

  const generateRandomKey = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let key = '';
    for (let i = 0; i < 32; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setField('admin_key')(key);
  };

  const copyAdminKey = async () => {
    if (form.admin_key) {
      await navigator.clipboard.writeText(form.admin_key);
      setSuccess('Admin key copied to clipboard!');
      setTimeout(() => setSuccess(''), 2000);
    }
  };

  // ——— Render ———————————————————————————————————————————————————————————————

  return (
    <div className="max-w-3xl mx-auto" style={{ fontFamily: FONT }}>
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <PHeading tag="h1" size="x-large" className="mb-1">Settings</PHeading>
          <PText color="contrast-medium">
            {isSuperAdmin
              ? 'Configure organization-wide defaults and financial parameters.'
              : 'View organization settings. Contact a Super Admin to make changes.'}
          </PText>
        </div>
        {isSuperAdmin ? (
          <div className="flex items-center gap-2">
            <PText size="x-small" color="contrast-medium" style={{ fontFamily: FONT }}>Edit Mode</PText>
            <PSwitch
              checked={editMode}
              onUpdate={e => {
                setEditMode(e.detail.checked);
                if (!e.detail.checked) handleReset();
              }}
              aria-label="Toggle edit mode"
            />
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-notification-warning-soft border border-notification-warning">
            <PText size="x-small" color="notification-warning" style={{ fontFamily: FONT }}>
              View Only
            </PText>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <PText color="contrast-medium">Loading settings…</PText>
        </div>
      ) : (
        <div className="flex flex-col gap-6">

          {/* Notifications */}
          {success && (
            <PInlineNotification
              heading="Saved"
              description={success}
              state="success"
              dismissButton
              onDismiss={() => setSuccess('')}
            />
          )}
          {error && (
            <PInlineNotification
              heading="Error"
              description={error}
              state="error"
              dismissButton
              onDismiss={() => setError('')}
            />
          )}

          {/* —— Organization Details ——————————————————————————————————————— */}
          <div className="bg-surface rounded-xl border border-contrast-low p-5">
            <SectionHeading
              title="Organization Details"
              description="Basic information about your organization."
            />
            <SettingRow
              label="Organization Name"
              description="Displayed across the platform and in reports."
              readOnly={!canEdit}
              value={form.org_name || '—'}
            >
              <input
                type="text"
                value={form.org_name}
                onChange={e => setField('org_name')(e.target.value)}
                className="form-input"
                placeholder="e.g. GRAVIUM Interiors Pvt. Ltd."
              />
            </SettingRow>
            <SettingRow
              label="Admin Key"
              description="Required when creating new admin accounts. Keep this secure."
              readOnly={!canEdit}
              value={canEdit ? form.admin_key : '••••••••'}
            >
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={form.admin_key}
                    onChange={e => setField('admin_key')(e.target.value)}
                    className="form-input flex-1"
                    placeholder="Set admin key for new admin creation"
                  />
                  {canEdit && form.admin_key && (
                    <PButton
                      variant="secondary"
                      onClick={copyAdminKey}
                      aria-label="Copy admin key"
                      title="Copy admin key"
                    >
                      Copy
                    </PButton>
                  )}
                </div>
                {canEdit && (
                  <PButton
                    variant="secondary"
                    onClick={generateRandomKey}
                    aria-label="Generate random admin key"
                  >
                    Generate Random Key
                  </PButton>
                )}
              </div>
            </SettingRow>
          </div>

          {/* —— Financial Settings ————————————————————————————————————————— */}
          <div className="bg-surface rounded-xl border border-contrast-low p-5">
            <SectionHeading
              title="Financial Settings"
              description="Default percentages used for project financials and payroll calculations."
            />

            <SettingRow
              label="Design Fee %"
              description="Percentage of project revenue allocated as design fee."
              readOnly={!canEdit}
              value={form.design_fee_pct}
              suffix="%"
            >
              <NumberInput
                value={form.design_fee_pct}
                onChange={setField('design_fee_pct')}
                min={0}
                max={100}
                step={0.1}
                suffix="%"
              />
            </SettingRow>

            <SettingRow
              label="Incentive %"
              description="KPI-based incentive as a percentage of project profit."
              readOnly={!canEdit}
              value={form.incentive_pct}
              suffix="%"
            >
              <NumberInput
                value={form.incentive_pct}
                onChange={setField('incentive_pct')}
                min={0}
                max={100}
                step={0.1}
                suffix="%"
              />
            </SettingRow>

            <SettingRow
              label="Commission %"
              description="Sales commission as a percentage of project profit."
              readOnly={!canEdit}
              value={form.commission_pct}
              suffix="%"
            >
              <NumberInput
                value={form.commission_pct}
                onChange={setField('commission_pct')}
                min={0}
                max={100}
                step={0.01}
                suffix="%"
              />
            </SettingRow>
          </div>

          {/* —— Profit First Allocation ———————————————————————————————————— */}
          <div className="bg-surface rounded-xl border border-contrast-low p-5">
            <SectionHeading
              title="Profit First Allocation"
              description="Define how incoming revenue is allocated across accounts. All four percentages should add up to 100%."
            />

            {/* Visual allocation bar */}
            {!profitFirstWarning && (
              <div className="mb-4">
                <div className="flex rounded-full overflow-hidden h-3">
                  {[
                    { pct: parseFloat(form.profit_first_profit_pct || '0'), color: 'bg-success' },
                    { pct: parseFloat(form.profit_first_opex_pct || '0'), color: 'bg-info' },
                    { pct: parseFloat(form.profit_first_tax_pct || '0'), color: 'bg-warning' },
                    { pct: parseFloat(form.profit_first_owner_pay_pct || '0'), color: 'bg-error' },
                  ].map((seg, i) => (
                    <div
                      key={i}
                      className={`${seg.color} transition-all duration-300`}
                      style={{ width: `${seg.pct}%` }}
                    />
                  ))}
                </div>
                <div className="flex flex-wrap gap-3 mt-2">
                  {[
                    { label: 'Profit', color: 'bg-success', pct: form.profit_first_profit_pct },
                    { label: 'OpEx', color: 'bg-info', pct: form.profit_first_opex_pct },
                    { label: 'Tax', color: 'bg-warning', pct: form.profit_first_tax_pct },
                    { label: 'Owner Pay', color: 'bg-error', pct: form.profit_first_owner_pay_pct },
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-1.5">
                      <div className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                      <PText size="xx-small" color="contrast-medium" style={{ fontFamily: FONT }}>
                        {item.label}: {item.pct}%
                      </PText>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {profitFirstWarning && (
              <div className="mb-4">
                <PInlineNotification
                  heading="Allocation warning"
                  description={`The four percentages currently add up to ${profitFirstTotal.toFixed(2)}% instead of 100%. Please adjust them before saving.`}
                  state="warning"
                  dismissButton={false}
                />
              </div>
            )}

            <SettingRow
              label="Profit %"
              description="Retained profit account."
              readOnly={!canEdit}
              value={form.profit_first_profit_pct}
              suffix="%"
            >
              <NumberInput
                value={form.profit_first_profit_pct}
                onChange={setField('profit_first_profit_pct')}
                min={0}
                max={100}
                step={0.1}
                suffix="%"
              />
            </SettingRow>

            <SettingRow
              label="Opex %"
              description="Operating expenses account."
              readOnly={!canEdit}
              value={form.profit_first_opex_pct}
              suffix="%"
            >
              <NumberInput
                value={form.profit_first_opex_pct}
                onChange={setField('profit_first_opex_pct')}
                min={0}
                max={100}
                step={0.1}
                suffix="%"
              />
            </SettingRow>

            <SettingRow
              label="Tax %"
              description="Tax reserve account."
              readOnly={!canEdit}
              value={form.profit_first_tax_pct}
              suffix="%"
            >
              <NumberInput
                value={form.profit_first_tax_pct}
                onChange={setField('profit_first_tax_pct')}
                min={0}
                max={100}
                step={0.1}
                suffix="%"
              />
            </SettingRow>

            <SettingRow
              label="Owner Pay %"
              description="Owner compensation account."
              readOnly={!canEdit}
              value={form.profit_first_owner_pay_pct}
              suffix="%"
            >
              <NumberInput
                value={form.profit_first_owner_pay_pct}
                onChange={setField('profit_first_owner_pay_pct')}
                min={0}
                max={100}
                step={0.1}
                suffix="%"
              />
            </SettingRow>

            {/* Total indicator */}
            <div
              className={`mt-4 flex items-center justify-between px-4 py-3 rounded-lg border ${
                profitFirstWarning
                  ? 'border-notification-warning bg-notification-warning-soft'
                  : 'border-notification-success bg-notification-success-soft'
              }`}
            >
              <PText size="x-small" style={{ fontFamily: FONT }}>
                Total Allocation
              </PText>
              <PText
                size="small"
                weight="semi-bold"
                color={profitFirstWarning ? 'notification-warning' : 'notification-success'}
                style={{ fontFamily: FONT }}
              >
                {profitFirstTotal.toFixed(2)}%
              </PText>
            </div>
          </div>

          {/* —— Actions ———————————————————————————————————————————————————— */}
          {canEdit && (
            <div className="flex items-center justify-between bg-surface rounded-xl border border-contrast-low p-4">
              <PText size="x-small" color="contrast-medium" style={{ fontFamily: FONT }}>
                {settings ? `Last updated: ${new Date(settings.updated_at).toLocaleString('en-IN')}` : 'No settings saved yet.'}
              </PText>
              <div className="flex gap-3">
                <PButton
                  type="button"
                  variant="secondary"
                  onClick={handleReset}
                  disabled={saving}
                >
                  Discard Changes
                </PButton>
                <PButton
                  type="button"
                  icon="save"
                  loading={saving}
                  onClick={handleSave}
                  disabled={profitFirstWarning}
                >
                  Save Settings
                </PButton>
              </div>
            </div>
          )}

          {/* Read-only note for non-admins */}
          {!canEdit && (
            <div className="flex items-center gap-3 bg-surface rounded-xl border border-contrast-low p-4">
              <PText size="x-small" color="contrast-medium" style={{ fontFamily: FONT }}>
                You are viewing settings in read-only mode. Contact a Super Admin to make changes.
              </PText>
            </div>
          )}
        </div>
      )}
    </div>
  );
}




import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, CheckCircle, Copy, Eye, RefreshCw, Save } from 'lucide-react';
import { supabase, type OrgSettings } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { PageHeader } from '../../components/common/PageHeader';
import {
  DEFAULT_COST_ESTIMATE_TERMS,
  DEFAULT_DOCUMENT_ORGANIZATION_SETTINGS,
  fetchDocumentExportSettings,
  importLocalDocumentExportSettingsToSupabase,
  saveDocumentExportSettings,
  type DocumentExportSettings,
} from '../../lib/documentExportSettings';

// ??? Helpers ??????????????????????????????????????????????????????????????????

function SectionHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {description && (
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {description}
        </p>
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
    <div className="grid gap-3 border-b border-border py-4 last:border-0 sm:grid-cols-[minmax(0,1fr)_12rem] sm:items-start sm:gap-6">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && (
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {description}
          </p>
        )}
      </div>

      <div className="min-w-0">
        {readOnly ? (
          <div className="flex items-center gap-1">
            <span className="text-sm font-semibold text-foreground">
              {value ?? '?'}
            </span>
            {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
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
        onChange={event => onChange(event.target.value)}
        disabled={disabled}
        className="form-input"
        style={{ width: suffix ? '100px' : '100%' }}
      />
      {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
    </div>
  );
}

function SwitchControl({
  checked,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full border transition-colors ${
        checked ? 'border-primary bg-primary' : 'border-border bg-muted'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-background shadow-sm transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

function InlineNotice({
  tone,
  title,
  description,
  onDismiss,
}: {
  tone: 'success' | 'error' | 'warning';
  title: string;
  description: string;
  onDismiss?: () => void;
}) {
  const isSuccess = tone === 'success';
  const isError = tone === 'error';

  return (
    <div
      className={`flex gap-3 rounded-2xl border p-4 text-sm ${
        isSuccess
          ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
          : isError
            ? 'border-destructive/20 bg-destructive/10 text-destructive'
            : 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300'
      }`}
    >
      {isSuccess ? (
        <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
      ) : (
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      )}

      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        <p className="mt-0.5 text-xs leading-5">{description}</p>
      </div>

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="text-xs font-semibold underline-offset-4 hover:underline"
        >
          Dismiss
        </button>
      )}
    </div>
  );
}

// ??? Default form state ???????????????????????????????????????????????????????

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


interface DocumentSettingsForm {
  addressLine1: string;
  addressLine2: string;
  addressLine3: string;
  addressLine4: string;
  email: string;
  phone: string;
  logoPath: string;
  fallbackLogoPath: string;
  signaturePath: string;
  invertLogoOnDark: boolean;
}

const defaultDocumentSettings: DocumentSettingsForm = {
  addressLine1: '',
  addressLine2: '',
  addressLine3: '',
  addressLine4: '',
  email: '',
  phone: '',
  logoPath: DEFAULT_DOCUMENT_ORGANIZATION_SETTINGS.logoPath,
  fallbackLogoPath: DEFAULT_DOCUMENT_ORGANIZATION_SETTINGS.fallbackLogoPath,
  signaturePath: DEFAULT_DOCUMENT_ORGANIZATION_SETTINGS.signaturePath,
  invertLogoOnDark: DEFAULT_DOCUMENT_ORGANIZATION_SETTINGS.invertLogoOnDark,
};

const defaultCostEstimateTerms = DEFAULT_COST_ESTIMATE_TERMS;

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

function documentExportSettingsToForm(
  settings: DocumentExportSettings
): DocumentSettingsForm {
  const addressLines = settings.organizationSettings.addressLines;

  return {
    addressLine1: addressLines[0] ?? '',
    addressLine2: addressLines[1] ?? '',
    addressLine3: addressLines[2] ?? '',
    addressLine4: addressLines[3] ?? '',
    email: settings.organizationSettings.email,
    phone: settings.organizationSettings.phone,
    logoPath: settings.organizationSettings.logoPath,
    fallbackLogoPath: settings.organizationSettings.fallbackLogoPath,
    signaturePath: settings.organizationSettings.signaturePath,
    invertLogoOnDark: settings.organizationSettings.invertLogoOnDark,
  };
}

function buildDocumentExportSettingsPayload(
  organizationName: string,
  documentSettings: DocumentSettingsForm,
  costEstimateTerms: string
): DocumentExportSettings {
  return {
    organizationSettings: {
      organizationName: organizationName.trim() || 'GRAVIUM DESIGN STUDIO LLP',
      addressLines: [
        documentSettings.addressLine1.trim(),
        documentSettings.addressLine2.trim(),
        documentSettings.addressLine3.trim(),
        documentSettings.addressLine4.trim(),
      ].filter(Boolean),
      email: documentSettings.email.trim(),
      phone: documentSettings.phone.trim(),
      logoPath:
        documentSettings.logoPath.trim() || defaultDocumentSettings.logoPath,
      fallbackLogoPath:
        documentSettings.fallbackLogoPath.trim() ||
        defaultDocumentSettings.fallbackLogoPath,
      signaturePath:
        documentSettings.signaturePath.trim() ||
        defaultDocumentSettings.signaturePath,
      invertLogoOnDark: documentSettings.invertLogoOnDark,
    },
    costEstimateTerms: costEstimateTerms
      .split('\n')
      .map(term => term.trim())
      .filter(Boolean),
  };
}

// ——— Main Component ———————————————————————————————————————————————————————————

export default function Settings() {
  const { isAdmin } = useAuth();
  const isSuperAdmin = isAdmin();

  const [settings, setSettings] = useState<OrgSettings | null>(null);
  const [form, setForm] = useState<SettingsForm>(defaultForm);
  const [documentSettings, setDocumentSettings] =
    useState<DocumentSettingsForm>(defaultDocumentSettings);
  const [costEstimateTerms, setCostEstimateTerms] = useState(
    defaultCostEstimateTerms.join('\n')
  );
  const [hasLoadedDocumentSettings, setHasLoadedDocumentSettings] =
    useState(false);
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

  useEffect(() => {
    let isMounted = true;

    async function loadDocumentExportSettings() {
      try {
        const importedSettings =
          await importLocalDocumentExportSettingsToSupabase();
        const nextSettings =
          importedSettings ?? (await fetchDocumentExportSettings());

        if (!isMounted) return;

        setDocumentSettings(documentExportSettingsToForm(nextSettings));
        setCostEstimateTerms(nextSettings.costEstimateTerms.join('\n'));
      } catch (loadError) {
        console.error('Could not load document export settings.', loadError);

        if (!isMounted) return;

        setDocumentSettings(defaultDocumentSettings);
        setCostEstimateTerms(defaultCostEstimateTerms.join('\n'));
      } finally {
        if (isMounted) {
          setHasLoadedDocumentSettings(true);
        }
      }
    }

    void loadDocumentExportSettings();

    return () => {
      isMounted = false;
    };
  }, []);



  // —— Derived values ————————————————————————————————————————————————————————

  // Auto-save document export settings to Supabase after local edits settle.
  useEffect(() => {
    if (!hasLoadedDocumentSettings || !canEdit) return;

    const saveTimeout = window.setTimeout(() => {
      void saveDocumentExportSettings(
        buildDocumentExportSettingsPayload(
          form.org_name,
          documentSettings,
          costEstimateTerms
        )
      ).catch(saveError => {
        console.error('Could not auto-save document export settings.', saveError);
      });
    }, 700);

    return () => {
      window.clearTimeout(saveTimeout);
    };
  }, [
    canEdit,
    costEstimateTerms,
    documentSettings,
    form.org_name,
    hasLoadedDocumentSettings,
  ]);

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

    try {
      await saveDocumentExportSettings(
        buildDocumentExportSettingsPayload(
          form.org_name,
          documentSettings,
          costEstimateTerms
        )
      );
    } catch (documentSettingsError) {
      const message =
        documentSettingsError instanceof Error
          ? documentSettingsError.message
          : 'Could not save document export settings.';

      setError(message);
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

  const setDocumentField =
    (key: keyof DocumentSettingsForm) => (value: string | boolean) => {
      setDocumentSettings(current => ({ ...current, [key]: value }));
      setSuccess('');
    };

  const handleCostEstimateTermsChange = (value: string) => {
    setCostEstimateTerms(value);
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
    <div className="mx-auto w-full max-w-3xl px-4 py-6 pb-32 sm:px-6 lg:px-8 lg:pb-6">
      <PageHeader
        eyebrow="Admin Settings"
        title="Settings"
        description={
          isSuperAdmin
            ? 'Configure organization-wide defaults and financial parameters.'
            : 'View organization settings. Contact a Super Admin to make changes.'
        }
        actions={
          isSuperAdmin ? (
            <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-card-foreground">
              <span className="text-xs font-medium text-muted-foreground">Edit Mode</span>
              <SwitchControl
                checked={editMode}
                onChange={checked => {
                  setEditMode(checked);
                  if (!checked) handleReset();
                }}
                ariaLabel="Toggle edit mode"
              />
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-700 dark:text-amber-300">
              <Eye className="h-3.5 w-3.5" />
              View Only
            </div>
          )
        }
      />

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading settings...</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {success && (
            <InlineNotice
              tone="success"
              title="Saved"
              description={success}
              onDismiss={() => setSuccess('')}
            />
          )}

          {error && (
            <InlineNotice
              tone="error"
              title="Error"
              description={error}
              onDismiss={() => setError('')}
            />
          )}

          <section className="rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm">
            <SectionHeading
              title="Organization Details"
              description="Basic information about your organization."
            />

            <SettingRow
              label="Organization Name"
              description="Displayed across the platform and in reports."
              readOnly={!canEdit}
              value={form.org_name || '?'}
            >
              <input
                type="text"
                value={form.org_name}
                onChange={event => setField('org_name')(event.target.value)}
                className="form-input"
                placeholder="e.g. GRAVIUM Interiors Pvt. Ltd."
              />
            </SettingRow>

            <SettingRow
              label="Admin Key"
              description="Required when creating new admin accounts. Keep this secure."
              readOnly={!canEdit}
              value={canEdit ? form.admin_key : '\u2022'.repeat(8)}
            >
              <div className="flex flex-col gap-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    type="text"
                    value={form.admin_key}
                    onChange={event => setField('admin_key')(event.target.value)}
                    className="form-input min-w-0 flex-1"
                    placeholder="Set admin key for new admin creation"
                  />

                  {canEdit && form.admin_key && (
                    <button
                      type="button"
                      onClick={copyAdminKey}
                      aria-label="Copy admin key"
                      title="Copy admin key"
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                    >
                      <Copy className="h-4 w-4" />
                      Copy
                    </button>
                  )}
                </div>

                {canEdit && (
                  <button
                    type="button"
                    onClick={generateRandomKey}
                    aria-label="Generate random admin key"
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Generate Random Key
                  </button>
                )}
              </div>
            </SettingRow>
          </section>

          <section className="rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm">
            <SectionHeading
              title="Document Export Settings"
              description="Used for branded PDFs such as cost estimates. Stored locally until the document settings schema is migrated."
            />

            <div className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs leading-5 text-emerald-700 dark:text-emerald-300">
              Document export settings auto-save locally. Changes apply to PDF exports immediately.
            </div>

            <SettingRow
              label="Document Logo Path"
              description="Current logo asset used by PDFs. Upload UI will come later."
              readOnly={!canEdit}
              value={documentSettings.logoPath || defaultDocumentSettings.logoPath}
            >
              <input
                type="text"
                value={documentSettings.logoPath}
                onChange={event =>
                  setDocumentField('logoPath')(event.target.value)
                }
                className="form-input"
                placeholder="/brand/Organization-Logo.png"
              />
            </SettingRow>

            <SettingRow
              label="Authorized Signature Path"
              description="Signature image used in PDFs. Recommended image size is 497 x 250 px."
              readOnly={!canEdit}
              value={documentSettings.signaturePath || defaultDocumentSettings.signaturePath}
            >
              <input
                type="text"
                value={documentSettings.signaturePath}
                onChange={event =>
                  setDocumentField('signaturePath')(event.target.value)
                }
                className="form-input"
                placeholder="/brand/Authorized-Signature.png"
              />
            </SettingRow>

            <SettingRow
              label="Address Line 1"
              description="Building name displayed in PDF headers."
              readOnly={!canEdit}
              value={documentSettings.addressLine1 || '?'}
            >
              <input
                type="text"
                value={documentSettings.addressLine1}
                onChange={event =>
                  setDocumentField('addressLine1')(event.target.value)
                }
                className="form-input"
                placeholder="Building name"
              />
            </SettingRow>

            <SettingRow
              label="Address Line 2"
              description="Street or area displayed in PDF headers."
              readOnly={!canEdit}
              value={documentSettings.addressLine2 || '?'}
            >
              <input
                type="text"
                value={documentSettings.addressLine2}
                onChange={event =>
                  setDocumentField('addressLine2')(event.target.value)
                }
                className="form-input"
                placeholder="Street / Area"
              />
            </SettingRow>

            <SettingRow
              label="Address Line 3"
              description="City, district, or PIN displayed in PDF headers."
              readOnly={!canEdit}
              value={documentSettings.addressLine3 || '?'}
            >
              <input
                type="text"
                value={documentSettings.addressLine3}
                onChange={event =>
                  setDocumentField('addressLine3')(event.target.value)
                }
                className="form-input"
                placeholder="City / District / PIN"
              />
            </SettingRow>

            <SettingRow
              label="Address Line 4"
              description="State and country displayed in PDF headers."
              readOnly={!canEdit}
              value={documentSettings.addressLine4 || '?'}
            >
              <input
                type="text"
                value={documentSettings.addressLine4}
                onChange={event =>
                  setDocumentField('addressLine4')(event.target.value)
                }
                className="form-input"
                placeholder="Kerala, India"
              />
            </SettingRow>

            <SettingRow
              label="Document Email"
              description="Email shown on exported PDFs."
              readOnly={!canEdit}
              value={documentSettings.email || '?'}
            >
              <input
                type="email"
                value={documentSettings.email}
                onChange={event =>
                  setDocumentField('email')(event.target.value)
                }
                className="form-input"
                placeholder="hello@gravium.in"
              />
            </SettingRow>

            <SettingRow
              label="Document Phone"
              description="Phone number shown on exported PDFs."
              readOnly={!canEdit}
              value={documentSettings.phone || '?'}
            >
              <input
                type="tel"
                value={documentSettings.phone}
                onChange={event =>
                  setDocumentField('phone')(event.target.value)
                }
                className="form-input"
                placeholder="+91 8848895475"
              />
            </SettingRow>

            <SettingRow
              label="Invert Logo On Dark Header"
              description="Keep enabled when the logo image is dark and the PDF header is dark."
              readOnly={!canEdit}
              value={documentSettings.invertLogoOnDark ? 'Enabled' : 'Disabled'}
            >
              <SwitchControl
                checked={documentSettings.invertLogoOnDark}
                onChange={checked =>
                  setDocumentField('invertLogoOnDark')(checked)
                }
                ariaLabel="Toggle PDF logo inversion"
              />
            </SettingRow>
          </section>

          <section className="rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm">
            <SectionHeading
              title="Document Terms Presets"
              description="Reusable terms for exported PDFs. Cost Estimate terms are active now; more document types can be added later."
            />

            <div className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs leading-5 text-emerald-700 dark:text-emerald-300">
              Document terms auto-save locally. Enter one term per line.
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Cost Estimate Terms & Conditions
              </label>
              <textarea
                value={costEstimateTerms}
                onChange={event =>
                  handleCostEstimateTermsChange(event.target.value)
                }
                disabled={!canEdit}
                rows={7}
                className="min-h-40 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm leading-6 text-foreground outline-none transition placeholder:text-muted-foreground focus:border-foreground disabled:cursor-not-allowed disabled:opacity-70"
                placeholder="Enter one term per line"
              />
              <p className="text-xs leading-5 text-muted-foreground">
                Enter one term per line. The PDF exporter converts each line into a numbered term.
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm">
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
          </section>

          <section className="rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm">
            <SectionHeading
              title="Profit First Allocation"
              description="Define how incoming revenue is allocated across accounts. All four percentages should add up to 100%."
            />

            {!profitFirstWarning && (
              <div className="mb-4">
                <div className="flex h-3 overflow-hidden rounded-full bg-muted">
                  {[
                    { pct: parseFloat(form.profit_first_profit_pct || '0'), color: 'bg-success' },
                    { pct: parseFloat(form.profit_first_opex_pct || '0'), color: 'bg-info' },
                    { pct: parseFloat(form.profit_first_tax_pct || '0'), color: 'bg-warning' },
                    { pct: parseFloat(form.profit_first_owner_pay_pct || '0'), color: 'bg-error' },
                  ].map((segment, index) => (
                    <div
                      key={index}
                      className={`${segment.color} transition-all duration-300`}
                      style={{ width: `${segment.pct}%` }}
                    />
                  ))}
                </div>

                <div className="mt-2 flex flex-wrap gap-3">
                  {[
                    { label: 'Profit', color: 'bg-success', pct: form.profit_first_profit_pct },
                    { label: 'OpEx', color: 'bg-info', pct: form.profit_first_opex_pct },
                    { label: 'Tax', color: 'bg-warning', pct: form.profit_first_tax_pct },
                    { label: 'Owner Pay', color: 'bg-error', pct: form.profit_first_owner_pay_pct },
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-1.5">
                      <div className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
                      <span className="text-xs text-muted-foreground">
                        {item.label}: {item.pct}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {profitFirstWarning && (
              <div className="mb-4">
                <InlineNotice
                  tone="warning"
                  title="Allocation Warning"
                  description={`The four percentages currently add up to ${profitFirstTotal.toFixed(2)}% instead of 100%. Please adjust them before saving.`}
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

            <div
              className={`mt-4 flex items-center justify-between rounded-xl border px-4 py-3 ${
                profitFirstWarning
                  ? 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                  : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
              }`}
            >
              <span className="text-xs font-medium">Total Allocation</span>
              <span className="text-sm font-semibold">{profitFirstTotal.toFixed(2)}%</span>
            </div>
          </section>

          {canEdit && (
            <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                {settings ? `Last updated: ${new Date(settings.updated_at).toLocaleString('en-IN')}` : 'No settings saved yet.'}
              </p>

              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={saving}
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Discard Changes
                </button>

                <button
                  type="button"
                  onClick={handleSave}
                  disabled={profitFirstWarning || saving}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/60 border-t-transparent" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save Settings
                </button>
              </div>
            </section>
          )}

        </div>
      )}
    </div>
  );

}

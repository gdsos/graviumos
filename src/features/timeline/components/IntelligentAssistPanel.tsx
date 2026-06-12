import {
  AlertTriangle,
  CheckCircle2,
  CircleDollarSign,
  Info,
  Link2,
  PauseCircle,
  WandSparkles,
} from 'lucide-react';

import { StatusBadge } from '@/components/common/StatusBadge';
import type { TimelineAlert } from '../types';

interface IntelligentAssistPanelProps {
  alerts: TimelineAlert[];
  onApplySuggestion?: (alert: TimelineAlert) => void;
  onIgnoreAlert?: (alert: TimelineAlert) => void;
}

function getAlertIcon(alert: TimelineAlert) {
  if (alert.type === 'payment_blocker') return CircleDollarSign;
  if (alert.type === 'dependency_conflict') return Link2;
  if (alert.type === 'pause') return PauseCircle;
  if (alert.type === 'delay' || alert.type === 'critical_path') {
    return AlertTriangle;
  }

  return Info;
}

function getAlertVariant(severity: TimelineAlert['severity']) {
  if (severity === 'danger') return 'danger';
  if (severity === 'warning') return 'warning';
  return 'info';
}

function formatAlertSeverity(severity: TimelineAlert['severity']) {
  if (severity === 'danger') return 'Danger';
  if (severity === 'warning') return 'Warning';
  return 'Info';
}

export function IntelligentAssistPanel({
  alerts,
  onApplySuggestion,
  onIgnoreAlert,
}: IntelligentAssistPanelProps) {
  return (
    <aside className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
      <div className="border-b border-border px-4 py-4 sm:px-5">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <WandSparkles className="h-4 w-4" />
          </div>

          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-foreground">
              Intelligent Assist
            </h2>
            <p className="text-sm text-muted-foreground">
              Alerts and suggestions.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 p-3 sm:p-4">
        {alerts.length > 0 ? (
          alerts.map(alert => {
            const Icon = getAlertIcon(alert);
            const canApply = Boolean(alert.canApplySuggestion && onApplySuggestion);

            return (
              <div
                key={alert.id}
                className="min-w-0 rounded-2xl border border-border bg-background p-4"
              >
                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <Icon className="h-4 w-4" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">
                          {alert.title}
                        </p>
                        <StatusBadge variant={getAlertVariant(alert.severity)}>
                          {formatAlertSeverity(alert.severity)}
                        </StatusBadge>
                      </div>

                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        {alert.description}
                      </p>

                      {alert.suggestedShiftDays && (
                        <p className="mt-3 inline-flex w-40 max-w-full items-center rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                          Suggested shift: {alert.suggestedShiftDays} day(s)
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-row gap-2 sm:justify-end">
                    {canApply ? (
                      <button
                        type="button"
                        onClick={() => onApplySuggestion?.(alert)}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition hover:opacity-90 sm:flex-none"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Apply
                      </button>
                    ) : null}

                    {onIgnoreAlert && (
                      <button
                        type="button"
                        onClick={() => onIgnoreAlert(alert)}
                        className="inline-flex flex-1 items-center justify-center rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground transition hover:bg-muted sm:flex-none"
                      >
                        Ignore
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium text-foreground">
              No active alerts
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Payment gates, dependencies, and delays look clear.
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}

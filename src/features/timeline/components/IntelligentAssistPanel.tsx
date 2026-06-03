import { AlertTriangle, CheckCircle2, Info, WandSparkles } from 'lucide-react';

import { StatusBadge } from '@/components/common/StatusBadge';
import type { TimelineAlert } from '../types';

interface IntelligentAssistPanelProps {
  alerts: TimelineAlert[];
  onApplySuggestion?: (alert: TimelineAlert) => void;
  onIgnoreAlert?: (alert: TimelineAlert) => void;
}

function getAlertIcon(severity: TimelineAlert['severity']) {
  if (severity === 'danger') return AlertTriangle;
  if (severity === 'warning') return AlertTriangle;
  return Info;
}

function getAlertVariant(severity: TimelineAlert['severity']) {
  if (severity === 'danger') return 'danger';
  if (severity === 'warning') return 'warning';
  return 'info';
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
            const Icon = getAlertIcon(alert.severity);

            return (
              <div
                key={alert.id}
                className="min-w-0 rounded-2xl border border-border bg-background p-4"
              >
                <div className="mb-3 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <Icon className="h-4 w-4" />
                    </div>

                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        {alert.title}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        {alert.description}
                      </p>
                    </div>
                  </div>

                  <StatusBadge variant={getAlertVariant(alert.severity)}>
                    {alert.severity}
                  </StatusBadge>
                </div>

                {alert.suggestedShiftDays && (
                  <p className="mb-3 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    Suggested shift: {alert.suggestedShiftDays} day(s)
                  </p>
                )}

                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  {alert.canApplySuggestion && onApplySuggestion && (
                    <button
                      type="button"
                      onClick={() => onApplySuggestion(alert)}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition hover:opacity-90"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Apply
                    </button>
                  )}

                  {onIgnoreAlert && (
                    <button
                      type="button"
                      onClick={() => onIgnoreAlert(alert)}
                      className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground transition hover:bg-muted"
                    >
                      Ignore
                    </button>
                  )}
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

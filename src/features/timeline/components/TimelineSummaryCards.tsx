import { AlertTriangle, CheckCircle2, Clock, PauseCircle, ShieldAlert, WalletCards } from 'lucide-react';

import { SectionCard } from '@/components/common/SectionCard';
import type { TimelineSummary } from '../types';

interface TimelineSummaryCardsProps {
  summary: TimelineSummary;
}

export function TimelineSummaryCards({ summary }: TimelineSummaryCardsProps) {
  const cards = [
    {
      label: 'Work Packages',
      value: summary.totalWorkPackages,
      helper: `${summary.completedWorkPackages} completed`,
      icon: CheckCircle2,
    },
    {
      label: 'Blocked',
      value: summary.blockedWorkPackages,
      helper: 'Payment or dependency',
      icon: ShieldAlert,
    },
    {
      label: 'Delayed',
      value: summary.delayedWorkPackages,
      helper: `${summary.projectedDelayDays} projected day(s)`,
      icon: AlertTriangle,
    },
    {
      label: 'Paused',
      value: summary.pausedWorkPackages,
      helper: 'Waiting to resume',
      icon: PauseCircle,
    },
    {
      label: 'Payments Pending',
      value: summary.pendingPaymentGates,
      helper: `${summary.receivedPaymentGates} received`,
      icon: WalletCards,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {cards.map(card => {
        const Icon = card.icon;

        return (
          <SectionCard key={card.label} className="shadow-none">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">{card.label}</p>
                <p className="mt-1 text-3xl font-semibold text-foreground">
                  {card.value}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {card.helper}
                </p>
              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Icon className="h-5 w-5" />
              </div>
            </div>
          </SectionCard>
        );
      })}

      <SectionCard className="shadow-none sm:col-span-2 xl:col-span-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Timeline Health</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Completion, blockers, payment gates, and projected delay are calculated from timeline engine helpers.
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-xs font-medium text-muted-foreground">
            <Clock className="h-4 w-4" />
            Engine calculated
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

import { AlertTriangle, CheckCircle2, Clock, PauseCircle, ShieldAlert, WalletCards } from 'lucide-react';

import { SectionCard } from '@/components/common/SectionCard';
import type { TimelineSummary } from '../types';

interface TimelineSummaryCardsProps {
  summary: TimelineSummary;
}

export function TimelineSummaryCards({ summary }: TimelineSummaryCardsProps) {
  const cards = [
    {
      label: 'Work',
      value: summary.totalWorkPackages,
      helper: `${summary.completedWorkPackages} completed`,
      icon: CheckCircle2,
    },
    {
      label: 'Blocked',
      value: summary.blockedWorkPackages,
      helper: 'Payment/dependency',
      icon: ShieldAlert,
    },
    {
      label: 'Delayed',
      value: summary.delayedWorkPackages,
      helper: `${summary.projectedDelayDays} day(s)`,
      icon: AlertTriangle,
    },
    {
      label: 'Paused',
      value: summary.pausedWorkPackages,
      helper: 'Waiting',
      icon: PauseCircle,
    },
    {
      label: 'Payments',
      value: summary.pendingPaymentGates,
      helper: `${summary.receivedPaymentGates} received`,
      icon: WalletCards,
    },
  ];

  return (
    <div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
      {cards.map(card => {
        const Icon = card.icon;

        return (
          <SectionCard key={card.label} className="min-w-0 shadow-none">
            <div className="min-w-0">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Icon className="h-4 w-4" />
              </div>

              <p className="truncate text-xs text-muted-foreground sm:text-sm">
                {card.label}
              </p>

              <p className="mt-1 text-2xl font-semibold text-foreground sm:text-3xl">
                {card.value}
              </p>

              <p className="mt-1 truncate text-xs text-muted-foreground">
                {card.helper}
              </p>
            </div>
          </SectionCard>
        );
      })}

      <SectionCard className="col-span-2 min-w-0 shadow-none sm:col-span-3 xl:col-span-5">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Timeline Health</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Completion, blockers, payment gates, and projected delay are calculated from timeline engine helpers.
            </p>
          </div>

          <div className="flex w-fit items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-xs font-medium text-muted-foreground">
            <Clock className="h-4 w-4" />
            Engine
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

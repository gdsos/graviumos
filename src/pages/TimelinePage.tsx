import { useMemo, useState } from 'react';
import { CalendarClock, RotateCcw } from 'lucide-react';

import { PageHeader } from '@/components/common/PageHeader';
import { SectionCard } from '@/components/common/SectionCard';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';

import {
  demoPaymentGates,
  demoTimelineAlerts,
  demoTimelineProject,
  demoWorkPackages,
} from '@/features/timeline/data';

import {
  calculateTimelineSummary,
  generateTimelineAlerts,
  getPaymentGateById,
  getWorkPackageById,
  markPaymentGateReceived,
} from '@/features/timeline/engine';

import { IntelligentAssistPanel } from '@/features/timeline/components/IntelligentAssistPanel';
import { PaymentGateBar } from '@/features/timeline/components/PaymentGateBar';
import { TimelineSummaryCards } from '@/features/timeline/components/TimelineSummaryCards';
import { TimelineWorkPackages } from '@/features/timeline/components/TimelineWorkPackages';

import type {
  PaymentGate,
  TimelineAlert,
  WorkPackage,
  WorkPackageStatus,
} from '@/features/timeline/types';

type TimelineTab = 'overview' | 'timeline' | 'work_packages' | 'payments' | 'alerts';

const tabs: Array<{ id: TimelineTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'work_packages', label: 'Work Packages' },
  { id: 'payments', label: 'Payments' },
  { id: 'alerts', label: 'Intelligent Assist' },
];

function formatINR(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateString: string) {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${dateString}T00:00:00`));
}

function getProjectStatusVariant(status: string) {
  if (status === 'active') return 'success';
  if (status === 'on_hold') return 'warning';
  if (status === 'completed') return 'info';
  return 'muted';
}

function getNextStatusAfterPaymentUnlock(
  workPackage: WorkPackage,
  allWorkPackages: WorkPackage[]
): WorkPackageStatus {
  const hasOpenDependency = workPackage.dependsOnWorkPackageIds.some(dependencyId => {
    const dependency = getWorkPackageById(allWorkPackages, dependencyId);
    return dependency?.status !== 'completed';
  });

  if (hasOpenDependency) return 'blocked_by_dependency';

  return workPackage.actualStartDate ? 'in_progress' : 'ready';
}

export default function TimelinePage() {
  const [activeTab, setActiveTab] = useState<TimelineTab>('overview');
  const [paymentGates, setPaymentGates] = useState<PaymentGate[]>(demoPaymentGates);
  const [workPackages, setWorkPackages] = useState<WorkPackage[]>(demoWorkPackages);
  const [ignoredAlertIds, setIgnoredAlertIds] = useState<string[]>([]);

  const summary = useMemo(
    () => calculateTimelineSummary(workPackages, paymentGates),
    [paymentGates, workPackages]
  );

  const generatedAlerts = useMemo(
    () => generateTimelineAlerts(workPackages, paymentGates),
    [paymentGates, workPackages]
  );

  const alerts = useMemo(() => {
    const combinedAlerts = [...demoTimelineAlerts, ...generatedAlerts];

    const uniqueAlerts = combinedAlerts.filter(
      (alert, index, array) =>
        array.findIndex(currentAlert => currentAlert.id === alert.id) === index
    );

    return uniqueAlerts.filter(alert => !ignoredAlertIds.includes(alert.id));
  }, [generatedAlerts, ignoredAlertIds]);

  const blockedWorkPackages = useMemo(
    () =>
      workPackages.filter(workPackage =>
        workPackage.status === 'blocked_by_payment' ||
        workPackage.status === 'blocked_by_dependency'
      ),
    [workPackages]
  );

  const criticalWorkPackages = useMemo(
    () =>
      workPackages.filter(
        workPackage =>
          workPackage.priority === 'critical' &&
          workPackage.status !== 'completed'
      ),
    [workPackages]
  );

  const handleMarkPaymentReceived = (paymentGate: PaymentGate) => {
    const today = new Date().toISOString().slice(0, 10);

    setPaymentGates(currentPaymentGates =>
      markPaymentGateReceived(currentPaymentGates, paymentGate.id, today)
    );

    setWorkPackages(currentWorkPackages =>
      currentWorkPackages.map(workPackage => {
        if (workPackage.paymentGateId !== paymentGate.id) return workPackage;
        if (workPackage.status !== 'blocked_by_payment') return workPackage;

        return {
          ...workPackage,
          status: getNextStatusAfterPaymentUnlock(workPackage, currentWorkPackages),
          notes: workPackage.notes
            ? `${workPackage.notes} Payment gate received on ${today}.`
            : `Payment gate received on ${today}.`,
        };
      })
    );
  };

  const handleApplySuggestion = (alert: TimelineAlert) => {
    window.alert(
      `Timeline shift assistant will be added next. Suggested shift: ${
        alert.suggestedShiftDays ?? 0
      } day(s).`
    );
  };

  const handleIgnoreAlert = (alert: TimelineAlert) => {
    setIgnoredAlertIds(current => [...current, alert.id]);
  };

  const handleResetTimeline = () => {
    const confirmed = window.confirm(
      'Reset timeline demo data? This will restore original payment gates, work packages, and alerts.'
    );

    if (!confirmed) return;

    setPaymentGates(demoPaymentGates);
    setWorkPackages(demoWorkPackages);
    setIgnoredAlertIds([]);
    setActiveTab('overview');
  };

  const renderTabContent = () => {
    if (activeTab === 'overview') {
      return (
        <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
          <div className="space-y-6">
            <TimelineSummaryCards summary={summary} />

            <SectionCard
              title="Project Snapshot"
              description="Timeline control view for the selected demo project."
            >
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-border bg-background p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Client
                  </p>
                  <p className="mt-2 text-sm font-semibold text-foreground">
                    {demoTimelineProject.clientName}
                  </p>
                </div>

                <div className="rounded-2xl border border-border bg-background p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Revenue
                  </p>
                  <p className="mt-2 text-sm font-semibold text-foreground">
                    {formatINR(demoTimelineProject.revenue)}
                  </p>
                </div>

                <div className="rounded-2xl border border-border bg-background p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Expected Handover
                  </p>
                  <p className="mt-2 text-sm font-semibold text-foreground">
                    {formatDate(demoTimelineProject.expectedHandoverDate)}
                  </p>
                </div>

                <div className="rounded-2xl border border-border bg-background p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Projected Handover
                  </p>
                  <p className="mt-2 text-sm font-semibold text-foreground">
                    {formatDate(demoTimelineProject.currentProjectedHandoverDate)}
                  </p>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Critical Open Work"
              description="Critical items that still need attention before handover."
            >
              <div className="grid gap-3">
                {criticalWorkPackages.map(workPackage => {
                  const paymentGate = getPaymentGateById(
                    paymentGates,
                    workPackage.paymentGateId
                  );

                  return (
                    <div
                      key={workPackage.id}
                      className="flex flex-col gap-3 rounded-2xl border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-medium text-foreground">
                          {workPackage.title}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {workPackage.estimatedStartDate} →{' '}
                          {workPackage.estimatedEndDate}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <StatusBadge variant="danger">
                          {workPackage.status.replaceAll('_', ' ')}
                        </StatusBadge>

                        {paymentGate && (
                          <StatusBadge variant="outline">
                            {paymentGate.title}
                          </StatusBadge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          </div>

          <IntelligentAssistPanel
            alerts={alerts}
            onApplySuggestion={handleApplySuggestion}
            onIgnoreAlert={handleIgnoreAlert}
          />
        </div>
      );
    }

    if (activeTab === 'timeline') {
      return (
        <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
          <div className="space-y-6">
            <PaymentGateBar
              paymentGates={paymentGates}
              onMarkReceived={handleMarkPaymentReceived}
            />

            <TimelineWorkPackages workPackages={workPackages} />
          </div>

          <IntelligentAssistPanel
            alerts={alerts}
            onApplySuggestion={handleApplySuggestion}
            onIgnoreAlert={handleIgnoreAlert}
          />
        </div>
      );
    }

    if (activeTab === 'work_packages') {
      return <TimelineWorkPackages workPackages={workPackages} />;
    }

    if (activeTab === 'payments') {
      return (
        <PaymentGateBar
          paymentGates={paymentGates}
          onMarkReceived={handleMarkPaymentReceived}
        />
      );
    }

    return (
      <IntelligentAssistPanel
        alerts={alerts}
        onApplySuggestion={handleApplySuggestion}
        onIgnoreAlert={handleIgnoreAlert}
      />
    );
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Project Timeline Management"
        title={demoTimelineProject.name}
        description="Interior project execution timeline with payment gates, work packages, dependencies, pauses, and intelligent assist."
        actions={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={handleResetTimeline}
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Reset Demo
            </Button>

            <Button type="button" className="gap-2">
              <CalendarClock className="h-4 w-4" />
              Manual Override
            </Button>
          </div>
        }
      />

      <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge variant={getProjectStatusVariant(demoTimelineProject.status)}>
            {demoTimelineProject.status}
          </StatusBadge>

          <StatusBadge variant="outline">
            {demoTimelineProject.projectType}
          </StatusBadge>

          <StatusBadge variant="outline">
            {demoTimelineProject.location}
          </StatusBadge>
        </div>

        <div className="text-sm text-muted-foreground">
          {formatDate(demoTimelineProject.startDate)} →{' '}
          {formatDate(demoTimelineProject.currentProjectedHandoverDate)}
        </div>
      </div>

      <div className="mb-6 overflow-x-auto border-b border-border">
        <div className="flex min-w-max gap-2">
          {tabs.map(tab => {
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`border-b-2 px-4 py-3 text-sm font-medium transition ${
                  isActive
                    ? 'border-foreground text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {blockedWorkPackages.length > 0 && (
        <div className="mb-6 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium text-amber-800 dark:text-amber-300">
                {blockedWorkPackages.length} work package(s) need attention
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Payment and dependency gates are currently affecting the timeline.
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => setActiveTab('alerts')}
            >
              View Alerts
            </Button>
          </div>
        </div>
      )}

      {renderTabContent()}
    </div>
  );
}

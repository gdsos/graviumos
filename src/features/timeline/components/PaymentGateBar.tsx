import { CheckCircle2, CircleDashed, LockKeyhole, WalletCards } from 'lucide-react';

import { StatusBadge } from '@/components/common/StatusBadge';
import type { PaymentGate } from '../types';

interface PaymentGateBarProps {
  paymentGates: PaymentGate[];
  onMarkReceived?: (paymentGate: PaymentGate) => void;
}

function formatINR(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function getPaymentVariant(status: PaymentGate['status']) {
  if (status === 'received') return 'success';
  if (status === 'overdue') return 'danger';
  return 'warning';
}

export function PaymentGateBar({
  paymentGates,
  onMarkReceived,
}: PaymentGateBarProps) {
  return (
    <div className="rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
      <div className="flex flex-col gap-2 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            Payment Gates
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Timeline work is blocked until linked payment gates are received.
          </p>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <WalletCards className="h-4 w-4" />
          {paymentGates.length} milestones
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto px-5 py-4">
        {paymentGates.map((paymentGate, index) => {
          const isReceived = paymentGate.status === 'received';
          const Icon = isReceived ? CheckCircle2 : LockKeyhole;

          return (
            <div
              key={paymentGate.id}
              className="min-w-[260px] rounded-2xl border border-border bg-background p-4"
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    {isReceived ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <CircleDashed className="h-4 w-4" />
                    )}
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground">
                      Gate {index + 1}
                    </p>
                    <p className="text-sm font-semibold text-foreground">
                      {paymentGate.title}
                    </p>
                  </div>
                </div>

                <StatusBadge variant={getPaymentVariant(paymentGate.status)}>
                  {paymentGate.status}
                </StatusBadge>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-medium text-foreground">
                    {formatINR(paymentGate.amount)}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Percentage</span>
                  <span className="font-medium text-foreground">
                    {paymentGate.percentage}%
                  </span>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Due</span>
                  <span className="font-medium text-foreground">
                    {paymentGate.dueDate}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Blocks</span>
                  <span className="font-medium text-foreground">
                    {paymentGate.blocksWorkPackageIds.length}
                  </span>
                </div>
              </div>

              {!isReceived && onMarkReceived && (
                <button
                  type="button"
                  onClick={() => onMarkReceived(paymentGate)}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
                >
                  <Icon className="h-4 w-4" />
                  Mark Received
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

import { Mail, MapPin, Phone, Star, UserRound, BriefcaseBusiness } from 'lucide-react';
import { StatusBadge } from '@/components/common/StatusBadge';
import type { Vendor } from '../types';
import {
  vendorAvailabilityLabels,
  vendorCategoryLabels,
  vendorStatusLabels,
} from '../data';

interface VendorCardProps {
  vendor: Vendor;
  onEdit?: (vendor: Vendor) => void;
  onDelete?: (vendor: Vendor) => void;
}

function getAvailabilityVariant(availability: Vendor['availability']) {
  if (availability === 'available') return 'success';
  if (availability === 'busy') return 'warning';
  return 'muted';
}

function getStatusVariant(status: Vendor['status']) {
  if (status === 'active') return 'success';
  if (status === 'blacklisted') return 'danger';
  return 'muted';
}

export function VendorCard({ vendor, onEdit, onDelete }: VendorCardProps) {
  return (
    <article className="group rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <StatusBadge variant={getStatusVariant(vendor.status)}>
              {vendorStatusLabels[vendor.status]}
            </StatusBadge>

            <StatusBadge variant={getAvailabilityVariant(vendor.availability)}>
              {vendorAvailabilityLabels[vendor.availability]}
            </StatusBadge>
          </div>

          <h3 className="truncate text-base font-semibold text-foreground">
            {vendor.name}
          </h3>

          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <BriefcaseBusiness className="h-3.5 w-3.5" />
            {vendorCategoryLabels[vendor.category]}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1 rounded-full border border-border bg-background px-2 py-1 text-xs font-medium text-foreground">
          <Star className="h-3.5 w-3.5 fill-current" />
          {vendor.rating.toFixed(1)}
        </div>
      </div>

      <p className="mt-4 line-clamp-2 text-sm leading-6 text-muted-foreground">
        {vendor.scopeOfWork}
      </p>

      <div className="mt-5 grid gap-2 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <UserRound className="h-4 w-4" />
          <span className="truncate">{vendor.contactPerson}</span>
        </div>

        <div className="flex items-center gap-2 text-muted-foreground">
          <Phone className="h-4 w-4" />
          <span className="truncate">{vendor.phone}</span>
        </div>

        {vendor.email && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail className="h-4 w-4" />
            <span className="truncate">{vendor.email}</span>
          </div>
        )}

        <div className="flex items-center gap-2 text-muted-foreground">
          <MapPin className="h-4 w-4" />
          <span className="truncate">{vendor.location}</span>
        </div>
      </div>

      {vendor.notes && (
        <div className="mt-5 rounded-xl border border-border bg-muted/30 p-3">
          <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
            {vendor.notes}
          </p>
        </div>
      )}

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4">
        <p className="text-xs text-muted-foreground">
          {vendor.assignedProjectCount} assigned project
          {vendor.assignedProjectCount === 1 ? '' : 's'}
        </p>

        <div className="flex items-center gap-2">
          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(vendor)}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted"
            >
              Edit
            </button>
          )}

          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(vendor)}
              className="rounded-lg border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive transition hover:bg-destructive/10"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

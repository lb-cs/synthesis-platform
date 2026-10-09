import { CircleAlert, CircleCheck, Clock, Loader, type LucideIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';

import { STATUS_LABELS, type SourceStatus } from './source-types';

type BadgeVariant = NonNullable<React.ComponentProps<typeof Badge>['variant']>;

const STATUS_VARIANTS: Record<SourceStatus, BadgeVariant> = {
  pending: 'secondary',
  processing: 'outline',
  ready: 'default',
  failed: 'destructive',
};

// Each status pairs an icon with its label so meaning never rides on colour alone.
const STATUS_ICONS: Record<SourceStatus, LucideIcon> = {
  pending: Clock,
  processing: Loader,
  ready: CircleCheck,
  failed: CircleAlert,
};

export function SourceStatusBadge({ status }: { status: SourceStatus }) {
  const Icon = STATUS_ICONS[status];

  return (
    <Badge variant={STATUS_VARIANTS[status]}>
      <Icon />
      {STATUS_LABELS[status]}
    </Badge>
  );
}

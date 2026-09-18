import type { LucideIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';

const JIRA_BROWSE_URL = 'https://quintessentialalgorithms.atlassian.net/browse';

// Placeholder for a screen whose feature is still on the backlog. Links to the Jira ticket.
export function ComingSoon({
  icon: Icon,
  title,
  description,
  ticket,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  ticket: string;
}) {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Badge variant="outline" render={<a href={`${JIRA_BROWSE_URL}/${ticket}`} />}>
          {ticket}
        </Badge>
      </EmptyContent>
    </Empty>
  );
}

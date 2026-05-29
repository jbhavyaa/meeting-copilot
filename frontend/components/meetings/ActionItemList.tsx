import { ExternalLink, User, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ActionItem, ActionItemPriority } from '@/types';

const PRIORITY_STYLES: Record<ActionItemPriority, string> = {
  high:   'bg-red-100 text-red-800 border-red-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  low:    'bg-gray-100 text-gray-700 border-gray-200',
};

interface ActionItemListProps {
  items: ActionItem[];
}

export function ActionItemList({ items }: ActionItemListProps) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        No action items were extracted from this meeting.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li
          key={item.id}
          className="rounded-lg border bg-card p-4 space-y-2"
        >
          <div className="flex items-start justify-between gap-3">
            <span className="font-medium text-sm leading-snug">{item.title}</span>
            {item.priority && (
              <Badge
                variant="outline"
                className={cn('shrink-0 capitalize', PRIORITY_STYLES[item.priority])}
              >
                {item.priority}
              </Badge>
            )}
          </div>

          {item.description && (
            <p className="text-sm text-muted-foreground">{item.description}</p>
          )}

          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {item.assignee && (
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {item.assignee}
              </span>
            )}
            {item.due_date && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {new Date(item.due_date).toLocaleDateString()}
              </span>
            )}
            {item.jira_ticket_url && (
              <a
                href={item.jira_ticket_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-blue-600 hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                {item.jira_ticket_id}
              </a>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

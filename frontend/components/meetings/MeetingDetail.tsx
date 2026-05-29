'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { StatusBadge } from './StatusBadge';
import { ActionItemList } from './ActionItemList';
import { TranscriptViewer } from './TranscriptViewer';
import { useRealtimeStatus } from '@/lib/hooks/useRealtimeStatus';
import { formatDuration } from '@/lib/utils';
import { MeetingDetail as MeetingDetailType } from '@/types';

interface MeetingDetailProps {
  meeting: MeetingDetailType;
}

export function MeetingDetail({ meeting }: MeetingDetailProps) {
  const liveStatus = useRealtimeStatus(meeting.id, meeting.status);
  const [copied, setCopied] = useState(false);

  function copyEmail() {
    if (!meeting.summary?.follow_up_email) return;
    void navigator.clipboard.writeText(meeting.summary.follow_up_email).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">
            {meeting.title ?? 'Untitled meeting'}
          </h1>
          <StatusBadge status={liveStatus} />
        </div>
        <p className="text-sm text-muted-foreground">
          {meeting.started_at
            ? new Date(meeting.started_at).toLocaleString()
            : 'Date unknown'}
          {meeting.duration_seconds
            ? ` · ${formatDuration(meeting.duration_seconds)}`
            : ''}
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="summary">
        <TabsList>
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="actions">
            Action Items
            {meeting.action_items.length > 0 && (
              <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs">
                {meeting.action_items.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="transcript">Transcript</TabsTrigger>
          <TabsTrigger value="email">Email Draft</TabsTrigger>
        </TabsList>

        {/* Summary */}
        <TabsContent value="summary" className="mt-4 space-y-4">
          {meeting.summary ? (
            <>
              <p className="text-sm leading-relaxed whitespace-pre-line">
                {meeting.summary.summary}
              </p>
              {meeting.summary.key_decisions && meeting.summary.key_decisions.length > 0 && (
                <div>
                  <h3 className="font-medium mb-2">Key Decisions</h3>
                  <ul className="space-y-1">
                    {meeting.summary.key_decisions.map((d, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground" />
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              {liveStatus === 'complete' ? 'No summary available.' : 'Summary will appear here once processing is complete.'}
            </p>
          )}
        </TabsContent>

        {/* Action Items */}
        <TabsContent value="actions" className="mt-4">
          <ActionItemList items={meeting.action_items} />
        </TabsContent>

        {/* Transcript */}
        <TabsContent value="transcript" className="mt-4">
          {meeting.transcript ? (
            <TranscriptViewer transcript={meeting.transcript} />
          ) : (
            <p className="text-sm text-muted-foreground">
              {liveStatus === 'complete' ? 'No transcript available.' : 'Transcript will appear here once processing is complete.'}
            </p>
          )}
        </TabsContent>

        {/* Email Draft */}
        <TabsContent value="email" className="mt-4 space-y-3">
          {meeting.summary?.follow_up_email ? (
            <>
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={copyEmail}>
                  {copied ? (
                    <><Check className="mr-1.5 h-4 w-4" /> Copied</>
                  ) : (
                    <><Copy className="mr-1.5 h-4 w-4" /> Copy email</>
                  )}
                </Button>
              </div>
              <pre className="whitespace-pre-wrap rounded-lg border bg-muted/50 p-4 text-sm font-sans leading-relaxed">
                {meeting.summary.follow_up_email}
              </pre>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              {liveStatus === 'complete' ? 'No email draft available.' : 'Email draft will appear here once processing is complete.'}
            </p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PageShell } from '@/components/layout/PageShell';
import { MeetingDetail } from '@/components/meetings/MeetingDetail';
import { MeetingDetail as MeetingDetailType } from '@/types';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function MeetingDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('meetings')
    .select(`
      *,
      transcript:transcripts(*),
      summary:meeting_summaries(*),
      action_items(*)
    `)
    .eq('id', id)
    .single();

  if (error || !data) notFound();

  const meeting: MeetingDetailType = {
    ...data,
    transcript: Array.isArray(data.transcript) ? data.transcript[0] ?? null : data.transcript,
    summary: Array.isArray(data.summary) ? data.summary[0] ?? null : data.summary,
    action_items: data.action_items ?? [],
  };

  return (
    <PageShell>
      <Link
        href="/"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        All meetings
      </Link>
      <MeetingDetail meeting={meeting} />
    </PageShell>
  );
}

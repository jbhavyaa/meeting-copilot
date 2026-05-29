import { Header } from '@/components/layout/Header';
import { PageShell } from '@/components/layout/PageShell';
import { MeetingList } from '@/components/meetings/MeetingList';

export default function MeetingsPage() {
  return (
    <PageShell>
      <Header
        title="Meetings"
        description="All your recorded meetings, summaries, and action items."
      />
      <MeetingList />
    </PageShell>
  );
}

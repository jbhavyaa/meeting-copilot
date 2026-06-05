import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { PageShell } from '@/components/layout/PageShell';
import { Header } from '@/components/layout/Header';
import { SettingsForm } from './SettingsForm';

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return (
    <PageShell>
      <Header
        title="Settings"
        description="Configure your Jira and email integrations."
      />
      <SettingsForm profile={profile} />
    </PageShell>
  );
}

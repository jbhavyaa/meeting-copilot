'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, Loader2 } from 'lucide-react';
import { Profile } from '@/types';

interface SettingsFormProps {
  profile: Profile | null;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function SettingsForm({ profile }: SettingsFormProps) {
  const [jiraDomain, setJiraDomain] = useState(profile?.jira_domain ?? '');
  const [jiraEmail, setJiraEmail] = useState(profile?.jira_email ?? '');
  const [jiraToken, setJiraToken] = useState(profile?.jira_api_token ?? '');
  const [recipients, setRecipients] = useState(
    profile?.follow_up_recipients?.join(', ') ?? ''
  );
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [testingJira, setTestingJira] = useState(false);
  const [jiraTestResult, setJiraTestResult] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setStatus('saving');
    setError(null);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const recipientList = recipients
        .split(',')
        .map((r) => r.trim())
        .filter(Boolean);

      const { error: dbError } = await supabase
        .from('profiles')
        .update({
          jira_domain: jiraDomain || null,
          jira_email: jiraEmail || null,
          jira_api_token: jiraToken || null,
          follow_up_recipients: recipientList.length > 0 ? recipientList : null,
        })
        .eq('id', user.id);

      if (dbError) throw new Error(dbError.message);
      setStatus('saved');
      setTimeout(() => setStatus('idle'), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
      setStatus('error');
    }
  }

  async function handleTestJira() {
    setTestingJira(true);
    setJiraTestResult(null);

    try {
      const credentials = btoa(`${jiraEmail}:${jiraToken}`);
      const response = await fetch(`https://${jiraDomain}/rest/api/3/myself`, {
        headers: { Authorization: `Basic ${credentials}`, Accept: 'application/json' },
      });

      if (response.ok) {
        const data = (await response.json()) as { displayName: string };
        setJiraTestResult(`Connected as ${data.displayName}`);
      } else {
        setJiraTestResult(`Connection failed: ${response.status} ${response.statusText}`);
      }
    } catch {
      setJiraTestResult('Connection failed — check domain and credentials');
    } finally {
      setTestingJira(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSave(e)} className="space-y-6 max-w-2xl">
      {/* Jira */}
      <Card>
        <CardHeader>
          <CardTitle>Jira Integration</CardTitle>
          <CardDescription>
            Action items from meetings will be automatically created as Jira tasks.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="jira-domain">Jira domain</Label>
            <Input
              id="jira-domain"
              placeholder="yourname.atlassian.net"
              value={jiraDomain}
              onChange={(e) => setJiraDomain(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="jira-email">Jira email</Label>
            <Input
              id="jira-email"
              type="email"
              placeholder="you@example.com"
              value={jiraEmail}
              onChange={(e) => setJiraEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="jira-token">Jira API token</Label>
            <Input
              id="jira-token"
              type="password"
              placeholder="••••••••••••"
              value={jiraToken}
              onChange={(e) => setJiraToken(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Generate one at{' '}
              <a
                href="https://id.atlassian.com/manage-profile/security/api-tokens"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                id.atlassian.com
              </a>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleTestJira()}
              disabled={testingJira || !jiraDomain || !jiraEmail || !jiraToken}
            >
              {testingJira && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
              Test connection
            </Button>
            {jiraTestResult && (
              <span className="text-sm text-muted-foreground">{jiraTestResult}</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Email recipients */}
      <Card>
        <CardHeader>
          <CardTitle>Follow-up Email Recipients</CardTitle>
          <CardDescription>
            The AI-generated follow-up email will be sent to these addresses after each meeting.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            <Label htmlFor="recipients">Recipients</Label>
            <Input
              id="recipients"
              placeholder="alice@example.com, bob@example.com"
              value={recipients}
              onChange={(e) => setRecipients(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Comma-separated list of email addresses</p>
          </div>
        </CardContent>
      </Card>

      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      <Button type="submit" disabled={status === 'saving'}>
        {status === 'saving' && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
        {status === 'saved' && <Check className="mr-1.5 h-4 w-4" />}
        {status === 'saved' ? 'Saved' : 'Save settings'}
      </Button>
    </form>
  );
}

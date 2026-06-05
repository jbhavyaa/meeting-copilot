'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, Loader2, Bot, Mail, Ticket, CheckCircle2, XCircle, Calendar } from 'lucide-react';
import { FEATURES } from '@/lib/config';
import { Profile } from '@/types';

interface ToggleProps {
  readonly checked: boolean;
  readonly onChange: (v: boolean) => void;
  readonly id: string;
}

function Toggle({ checked, onChange, id }: ToggleProps) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 ${
        checked ? 'bg-violet-600' : 'bg-slate-200'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-md ring-0 transition-transform duration-200 ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

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
  const [autoJoin, setAutoJoin] = useState(profile?.auto_join_meetings ?? false);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [testingJira, setTestingJira] = useState(false);
  const [jiraTestResult, setJiraTestResult] = useState<{ ok: boolean; message: string } | null>(null);

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
          auto_join_meetings: autoJoin,
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
        setJiraTestResult({ ok: true, message: `Connected as ${data.displayName}` });
      } else {
        setJiraTestResult({ ok: false, message: `Connection failed: ${response.status} ${response.statusText}` });
      }
    } catch {
      setJiraTestResult({ ok: false, message: 'Connection failed — check domain and credentials' });
    } finally {
      setTestingJira(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSave(e)} className="space-y-5 max-w-2xl">

      {/* Google Calendar Auto-Scheduling */}
      {FEATURES.CALENDAR_AUTO_SCHEDULE ? null : (
        <div className="rounded-lg border border-dashed border-gray-200 p-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-500">
              Google Calendar Auto-Scheduling
            </span>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
              Coming Soon
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-400">
            Automatically invite the bot to meetings from your calendar.
            Currently use the dashboard to add a bot by meeting URL.
          </p>
        </div>
      )}

      {/* Meeting Bot */}
      <Card className="border-slate-200">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50">
              <Bot className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <CardTitle className="text-base">Meeting Bot</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Auto-join Google Meet and Zoom calls from your calendar
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-slate-800">Auto-join calendar meetings</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {autoJoin ? 'Bot joins every meeting automatically' : 'You control which meetings get recorded'}
              </p>
            </div>
            <Toggle id="auto-join" checked={autoJoin} onChange={setAutoJoin} />
          </div>
        </CardContent>
      </Card>

      {/* Jira */}
      <Card className="border-slate-200">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
              <Ticket className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-base">Jira Integration</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Action items are automatically created as Jira tickets
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="jira-domain" className="text-xs font-medium text-slate-600">Jira domain</Label>
              <Input
                id="jira-domain"
                placeholder="yourname.atlassian.net"
                value={jiraDomain}
                onChange={(e) => setJiraDomain(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="jira-email" className="text-xs font-medium text-slate-600">Email</Label>
              <Input
                id="jira-email"
                type="email"
                placeholder="you@example.com"
                value={jiraEmail}
                onChange={(e) => setJiraEmail(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="jira-token" className="text-xs font-medium text-slate-600">API token</Label>
            <Input
              id="jira-token"
              type="password"
              placeholder="••••••••••••••••"
              value={jiraToken}
              onChange={(e) => setJiraToken(e.target.value)}
              className="h-9 text-sm"
            />
            <p className="text-xs text-slate-400">
              Generate at{' '}
              <a
                href="https://id.atlassian.com/manage-profile/security/api-tokens"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                id.atlassian.com
              </a>
            </p>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleTestJira()}
              disabled={testingJira || !jiraDomain || !jiraEmail || !jiraToken}
              className="h-8 text-xs"
            >
              {testingJira ? (
                <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
              ) : null}
              Test connection
            </Button>
            {jiraTestResult && (
              <span className={`flex items-center gap-1.5 text-xs ${jiraTestResult.ok ? 'text-green-600' : 'text-red-500'}`}>
                {jiraTestResult.ok
                  ? <CheckCircle2 className="h-3.5 w-3.5" />
                  : <XCircle className="h-3.5 w-3.5" />
                }
                {jiraTestResult.message}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Email */}
      <Card className="border-slate-200">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50">
              <Mail className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <CardTitle className="text-base">Follow-up Emails</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                AI-generated summary email sent after each meeting
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            <Label htmlFor="recipients" className="text-xs font-medium text-slate-600">Recipients</Label>
            <Input
              id="recipients"
              placeholder="alice@example.com, bob@example.com"
              value={recipients}
              onChange={(e) => setRecipients(e.target.value)}
              className="h-9 text-sm"
            />
            <p className="text-xs text-slate-400">Comma-separated email addresses</p>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-100 bg-red-50 px-4 py-3">
          <XCircle className="h-4 w-4 shrink-0 text-red-500" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="flex items-center gap-3 pt-1">
        <Button
          type="submit"
          disabled={status === 'saving'}
          className="bg-violet-600 hover:bg-violet-700 text-white"
        >
          {status === 'saving' && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
          {status === 'saved' && <Check className="mr-1.5 h-4 w-4" />}
          {status === 'saved' ? 'Saved' : 'Save settings'}
        </Button>
        {status === 'saved' && (
          <span className="text-sm text-emerald-600 flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4" />
            Changes saved
          </span>
        )}
      </div>
    </form>
  );
}

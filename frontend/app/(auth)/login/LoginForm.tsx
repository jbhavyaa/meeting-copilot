'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Sparkles, Zap, FileText, Ticket } from 'lucide-react';

const FEATURES = [
  { icon: Zap,      text: 'Auto-joins your Zoom & Meet calls' },
  { icon: FileText, text: 'AI transcription & smart summaries' },
  { icon: Ticket,   text: 'Jira tickets + follow-up email' },
];

export function LoginForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGoogleSignIn() {
    try {
      setLoading(true);
      setError(null);
      const supabase = createClient();
      // Calendar scopes removed — app is in public mode with basic login only
      // To re-enable: set FEATURES.CALENDAR_AUTO_SCHEDULE to true and add scopes back
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${location.origin}/api/auth/callback`,
        },
      });
      if (authError) throw authError;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md space-y-6">
      {/* Card */}
      <div className="overflow-hidden rounded-3xl border border-white/60 bg-white/80 shadow-2xl shadow-violet-200/40 backdrop-blur-xl">

        {/* Header gradient band */}
        <div className="bg-gradient-to-br from-violet-600 via-indigo-600 to-purple-700 px-8 py-8 text-white">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 ring-1 ring-white/30">
            <Sparkles className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Meeting Copilot</h1>
          <p className="mt-1 text-sm text-violet-200">
            Your AI assistant for every call
          </p>
        </div>

        {/* Features */}
        <div className="space-y-3 px-8 py-6">
          {FEATURES.map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-100">
                <Icon className="h-3.5 w-3.5 text-violet-600" />
              </span>
              {text}
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="space-y-3 px-8 pb-8">
          {error && (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
          )}

          <button
            onClick={() => void handleGoogleSignIn()}
            disabled={loading}
            className="flex w-full items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/30 transition-all hover:from-violet-500 hover:to-indigo-500 hover:shadow-violet-500/40 disabled:opacity-60"
          >
            {loading ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              /* Google "G" SVG mark */
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            {loading ? 'Redirecting…' : 'Continue with Google'}
          </button>

          <p className="text-center text-xs text-muted-foreground">
            Sign in with your Google account to get started.
          </p>
        </div>
      </div>
    </div>
  );
}

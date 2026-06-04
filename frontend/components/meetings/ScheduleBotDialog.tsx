'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, X, Bot, Loader2 } from 'lucide-react';

export function ScheduleBotDialog() {
  const [open, setOpen] = useState(false);
  const [meetingUrl, setMeetingUrl] = useState('');
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/meetings/schedule-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingUrl: meetingUrl.trim(), title: title.trim() }),
      });

      const data = (await res.json()) as { meetingId?: string; error?: string };

      if (!res.ok) {
        setError(data.error ?? 'Something went wrong');
        return;
      }

      setOpen(false);
      setMeetingUrl('');
      setTitle('');
      router.refresh();
    } catch {
      setError('Failed to schedule bot — check your connection');
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <Button
        onClick={() => setOpen(true)}
        className="bg-violet-600 hover:bg-violet-700 text-white gap-1.5"
        size="sm"
      >
        <Plus className="h-4 w-4" />
        Send bot to meeting
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50">
              <Bot className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Send bot to meeting</h2>
              <p className="text-xs text-slate-500 mt-0.5">Paste a Google Meet or Zoom link</p>
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="meeting-url" className="text-xs font-medium text-slate-600">
              Meeting URL <span className="text-red-400">*</span>
            </Label>
            <Input
              id="meeting-url"
              placeholder="https://meet.google.com/abc-defg-hij"
              value={meetingUrl}
              onChange={(e) => setMeetingUrl(e.target.value)}
              className="h-9 text-sm"
              autoFocus
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="meeting-title" className="text-xs font-medium text-slate-600">
              Title <span className="text-slate-400 font-normal">(optional)</span>
            </Label>
            <Input
              id="meeting-title"
              placeholder="Weekly sync, product review..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-9 text-sm"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-xs text-red-600">
              {error}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={loading || !meetingUrl.trim()}
              className="flex-1 bg-violet-600 hover:bg-violet-700 text-white"
            >
              {loading && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {loading ? 'Scheduling...' : 'Send bot'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

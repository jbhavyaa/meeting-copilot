import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function detectPlatform(url: string): 'google_meet' | 'zoom' | null {
  if (url.includes('meet.google.com')) return 'google_meet';
  if (url.includes('zoom.us')) return 'zoom';
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { meetingUrl, title } = (await req.json()) as { meetingUrl: string; title?: string };
    if (!meetingUrl) return NextResponse.json({ error: 'meetingUrl is required' }, { status: 400 });

    const platform = detectPlatform(meetingUrl);
    if (!platform) {
      return NextResponse.json({ error: 'Only Google Meet and Zoom URLs are supported' }, { status: 400 });
    }

    const recallApiKey = process.env.RECALL_API_KEY;
    if (!recallApiKey) return NextResponse.json({ error: 'Recall API key not configured' }, { status: 500 });

    // Schedule bot via Recall API
    const recallRes = await fetch('https://us-west-2.recall.ai/api/v1/bot/', {
      method: 'POST',
      headers: {
        Authorization: `Token ${recallApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        meeting_url: meetingUrl,
        bot_name: 'Meeting Copilot',
      }),
    });

    if (!recallRes.ok) {
      const err = await recallRes.text();
      return NextResponse.json({ error: `Recall API error: ${err}` }, { status: 502 });
    }

    const bot = (await recallRes.json()) as { id: string };

    // Create meeting row in Supabase
    const { data: meeting, error: dbError } = await supabase
      .from('meetings')
      .insert({
        user_id: user.id,
        recall_bot_id: bot.id,
        platform,
        title: title?.trim() || 'Untitled meeting',
        status: 'scheduled',
      })
      .select('id')
      .single();

    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

    return NextResponse.json({ meetingId: meeting.id, botId: bot.id });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}

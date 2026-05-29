'use client';

import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { stringToColour } from '@/lib/utils';
import { Transcript } from '@/types';

interface TranscriptViewerProps {
  transcript: Transcript;
}

function highlightText(text: string, query: string): React.ReactNode {
  if (!query) return text;

  const parts = text.split(new RegExp(`(${query})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={i} className="bg-yellow-200 rounded-sm px-0.5">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

export function TranscriptViewer({ transcript }: TranscriptViewerProps) {
  const [query, setQuery] = useState('');

  const speakers = useMemo(() => transcript.speakers ?? [], [transcript.speakers]);

  const filteredSpeakers = useMemo(() => {
    if (!query) return speakers;
    return speakers
      .map((sp) => ({
        ...sp,
        segments: sp.segments.filter((seg) =>
          seg.text.toLowerCase().includes(query.toLowerCase())
        ),
      }))
      .filter((sp) => sp.segments.length > 0);
  }, [speakers, query]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search transcript…"
          className="pl-9"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {filteredSpeakers.length === 0 && query ? (
        <p className="text-sm text-muted-foreground py-4">No results for "{query}"</p>
      ) : filteredSpeakers.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">No transcript data available.</p>
      ) : (
        <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
          {filteredSpeakers.map((speaker) => (
            <div key={speaker.speaker} className="space-y-1">
              <span
                className="text-xs font-semibold"
                style={{ color: stringToColour(speaker.speaker) }}
              >
                {speaker.speaker}
              </span>
              {speaker.segments.map((seg, i) => (
                <p key={i} className="text-sm leading-relaxed">
                  <span className="mr-2 text-xs text-muted-foreground tabular-nums">
                    {new Date(seg.start * 1000).toISOString().substr(11, 8)}
                  </span>
                  {highlightText(seg.text, query)}
                </p>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

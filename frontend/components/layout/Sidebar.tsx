'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Video, Settings, LogOut, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/',         label: 'Meetings', icon: Video    },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <aside className="sidebar-gradient flex h-screen w-60 flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/20">
          <Sparkles className="h-4 w-4 text-violet-200" />
        </div>
        <div>
          <span className="block text-sm font-semibold text-white leading-tight">Meeting</span>
          <span className="block text-xs text-violet-300 leading-tight">Copilot</span>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-4 h-px bg-white/10" />

      {/* Nav */}
      <nav className="flex-1 space-y-1 p-3 pt-4">
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-violet-400">
          Navigation
        </p>
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                active
                  ? 'bg-white/15 text-white nav-active-glow'
                  : 'text-violet-300 hover:bg-white/8 hover:text-white'
              )}
            >
              <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-violet-200' : 'text-violet-400')} />
              {label}
              {active && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-violet-300" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="p-3">
        <div className="mx-0 mb-3 h-px bg-white/10" />
        <button
          onClick={() => void handleSignOut()}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-violet-300 transition-all hover:bg-white/8 hover:text-white"
        >
          <LogOut className="h-4 w-4 shrink-0 text-violet-400" />
          Sign out
        </button>
      </div>
    </aside>
  );
}

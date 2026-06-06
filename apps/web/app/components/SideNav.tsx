'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Search, Plus, Mail, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useUnreadCount } from '../hooks/useUnreadCount';

const TABS = [
  { to: '/app/browse',   Icon: Home,   label: 'Browse'   },
  { to: '/app/search',   Icon: Search, label: 'Search'   },
  { to: '/app/create',   Icon: Plus,   label: 'Sell'     },
  { to: '/app/messages', Icon: Mail,   label: 'Messages' },
  { to: '/app/profile',  Icon: User,   label: 'Profile'  },
];

export default function SideNav() {
  const pathname = usePathname();
  const [userId, setUserId] = useState<string | null>(null);
  const unread = useUnreadCount(userId);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setUserId(session.user.id);
    });
  }, []);

  function isActive(to: string) {
    if (to === '/app/browse') return pathname === '/app/browse' || pathname === '/app';
    return pathname.startsWith(to);
  }

  return (
    <aside className="hidden md:flex fixed left-0 top-0 h-full w-60 flex-col border-r border-border bg-card z-40 px-3 py-6">
      {/* Brand */}
      <div className="px-3 mb-8">
        <p className="text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground/50 mb-1">
          myotherpair
        </p>
        <p className="text-[20px] font-bold text-foreground leading-tight">
          Every shoe<br />deserves a match.
        </p>
      </div>

      {/* Nav links */}
      <nav className="flex-1 flex flex-col gap-0.5">
        {TABS.map(({ to, Icon, label }) => {
          const active = isActive(to);
          return (
            <Link
              key={to}
              href={to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-medium transition-all ${
                active
                  ? 'bg-accent/10 text-accent'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <Icon size={19} strokeWidth={active ? 2.2 : 1.7} className="flex-shrink-0" />
              <span className="flex-1">{label}</span>
              {to === '/app/messages' && unread > 0 && (
                <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-accent text-accent-foreground text-[11px] font-bold flex items-center justify-center">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 pt-4 border-t border-border">
        <p className="text-[11px] text-muted-foreground/40">© 2025 myotherpair</p>
      </div>
    </aside>
  );
}

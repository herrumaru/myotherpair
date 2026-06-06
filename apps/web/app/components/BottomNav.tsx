'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Search, Plus, Mail, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const TABS = [
  { to: '/app/browse',   Icon: Home,   label: 'Browse'  },
  { to: '/app/search',   Icon: Search, label: 'Search'  },
  { to: '/app/create',   Icon: Plus,   label: 'Sell'    },
  { to: '/app/messages', Icon: Mail,   label: 'Inbox'   },
  { to: '/app/profile',  Icon: User,   label: 'Profile' },
];

export default function BottomNav() {
  const pathname = usePathname();
  const [userId,  setUserId]  = useState<string | null>(null);
  const [unread,  setUnread]  = useState(0);

  // Compute hidden state — but hooks must all be called before any early return
  const hidden = /^\/app\/messages\/.+/.test(pathname);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setUserId(session.user.id);
    });
  }, []);

  useEffect(() => {
    if (!userId || hidden) return;

    async function fetchUnread() {
      const { data: matches } = await supabase
        .from('matches')
        .select('id, user_id_1, user_id_2, user1_last_read_at, user2_last_read_at')
        .or(`user_id_1.eq.${userId},user_id_2.eq.${userId}`);

      if (!matches?.length) { setUnread(0); return; }

      const matchIds = matches.map(m => m.id);
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const { data: msgs } = await supabase
        .from('messages')
        .select('match_id, created_at')
        .in('match_id', matchIds)
        .neq('sender_id', userId)
        .gte('created_at', since);

      if (!msgs) { setUnread(0); return; }

      const matchMap = new Map(matches.map(m => [m.id, m]));
      const unreadSet = new Set<string>();

      for (const msg of msgs) {
        const match = matchMap.get(msg.match_id);
        if (!match) continue;
        const lastRead = match.user_id_1 === userId ? match.user1_last_read_at : match.user2_last_read_at;
        if (!lastRead || new Date(msg.created_at) > new Date(lastRead)) {
          unreadSet.add(msg.match_id);
        }
      }

      setUnread(unreadSet.size);
    }

    fetchUnread();
  }, [userId, pathname, hidden]);

  // Hide on individual message threads after all hooks have run
  if (hidden) return null;

  function isActive(to: string) {
    if (to === '/app/browse') return pathname === '/app/browse' || pathname === '/app';
    return pathname.startsWith(to);
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-center max-w-lg mx-auto" style={{ height: 64 }}>
        {TABS.map(({ to, Icon, label }) => {
          const active = isActive(to);
          return (
            <Link
              key={to}
              href={to}
              className="flex-1 flex flex-col items-center justify-center gap-1"
            >
              <div className="relative">
                <Icon
                  size={22}
                  strokeWidth={active ? 2.2 : 1.6}
                  className={active ? 'text-accent' : 'text-muted-foreground'}
                />
                {to === '/app/messages' && unread > 0 && (
                  <span className="absolute -top-1 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-accent text-accent-foreground text-[10px] font-bold flex items-center justify-center leading-none">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </div>
              <span
                className={`text-[10px] font-medium leading-none ${active ? 'text-accent' : 'text-muted-foreground'}`}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

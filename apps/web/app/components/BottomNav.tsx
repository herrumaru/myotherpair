'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Search, Plus, Mail, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useUnreadCount } from '../hooks/useUnreadCount';

const TABS = [
  { to: '/app/browse',   Icon: Home,   label: 'Browse'  },
  { to: '/app/search',   Icon: Search, label: 'Search'  },
  { to: '/app/create',   Icon: Plus,   label: 'Sell'    },
  { to: '/app/messages', Icon: Mail,   label: 'Inbox'   },
  { to: '/app/profile',  Icon: User,   label: 'Profile' },
];

export default function BottomNav() {
  const pathname = usePathname();
  const [userId, setUserId] = useState<string | null>(null);

  // Hidden on individual message threads and on desktop (sidebar takes over)
  const hidden = /^\/app\/messages\/.+/.test(pathname);
  const unread = useUnreadCount(userId, hidden);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setUserId(session.user.id);
    });
  }, []);

  if (hidden) return null;

  function isActive(to: string) {
    if (to === '/app/browse') return pathname === '/app/browse' || pathname === '/app';
    return pathname.startsWith(to);
  }

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border"
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
              <span className={`text-[10px] font-medium leading-none ${active ? 'text-accent' : 'text-muted-foreground'}`}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

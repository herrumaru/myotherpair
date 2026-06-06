'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Search, Plus, Mail, User } from 'lucide-react';

const TABS = [
  { to: '/app/browse',   Icon: Home,       label: 'Browse'   },
  { to: '/app/search',   Icon: Search,     label: 'Search'   },
  { to: '/app/create',   Icon: Plus,       label: 'Sell'     },
  { to: '/app/messages', Icon: Mail,       label: 'Inbox'    },
  { to: '/app/profile',  Icon: User,       label: 'Profile'  },
];

export default function BottomNav() {
  const pathname = usePathname();

  function isActive(to: string) {
    if (to === '/app/browse') return pathname === '/app/browse' || pathname === '/app';
    return pathname.startsWith(to);
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#1a1a1a]" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex items-center max-w-lg mx-auto" style={{ height: 64 }}>
        {TABS.map(({ to, Icon, label }) => {
          const active = isActive(to);
          return (
            <Link
              key={to}
              href={to}
              className="flex-1 flex flex-col items-center justify-center gap-1"
            >
              <Icon
                size={22}
                strokeWidth={active ? 2.2 : 1.6}
                className={active ? 'text-[#f05d23]' : 'text-white/50'}
              />
              <span
                className="font-medium"
                style={{
                  fontSize: 10,
                  lineHeight: 1,
                  color: active ? '#f05d23' : 'rgba(255,255,255,0.5)',
                }}
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

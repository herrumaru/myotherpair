'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Flame, Compass, PlusSquare, MessageCircle, User } from 'lucide-react';

const NAV_ITEMS = [
  { to: '/app',          Icon: Flame,         label: 'Discover' },
  { to: '/app/browse',   Icon: Compass,       label: 'Browse'   },
  { to: '/app/create',   Icon: PlusSquare,    label: 'List'     },
  { to: '/app/messages', Icon: MessageCircle, label: 'Chat'     },
  { to: '/app/profile',  Icon: User,          label: 'Profile'  },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#1a1a1a] pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center h-[60px] max-w-lg mx-auto">
        {NAV_ITEMS.map(({ to, Icon, label }) => {
          const active = pathname === to || (to !== '/app' && pathname.startsWith(to));
          return (
            <Link
              key={to}
              href={to}
              aria-label={label}
              className="flex items-center justify-center flex-1 h-full"
            >
              <Icon
                size={24}
                strokeWidth={active ? 2.2 : 1.6}
                className={`transition-all duration-150 ${active ? 'text-white' : 'text-white/35'}`}
              />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

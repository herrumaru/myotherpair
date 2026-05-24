'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Flame, Compass, PlusSquare, MessageCircle, User } from 'lucide-react';

const NAV_ITEMS = [
  { to: '/app',          Icon: Flame,         label: 'Discover' },
  { to: '/app/browse',   Icon: Compass,       label: 'Explore'  },
  { to: '/app/create',   Icon: PlusSquare,    label: 'List'     },
  { to: '/app/messages', Icon: MessageCircle, label: 'Chat'     },
  { to: '/app/profile',  Icon: User,          label: 'Profile'  },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-black/[0.07] pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-stretch h-[56px] max-w-lg mx-auto">
        {NAV_ITEMS.map(({ to, Icon, label }) => {
          const active = pathname === to || (to !== '/app' && pathname.startsWith(to));
          return (
            <Link
              key={to}
              href={to}
              className="flex flex-col items-center justify-center gap-[3px] flex-1"
            >
              <Icon
                className={`transition-all duration-150 ${
                  active ? 'text-accent' : 'text-black/25'
                }`}
                size={22}
                strokeWidth={active ? 2.25 : 1.7}
              />
              <span className={`text-[9.5px] tracking-wide transition-colors duration-150 ${
                active ? 'text-accent font-semibold' : 'text-black/25 font-medium'
              }`}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Search, PlusCircle, MessageCircle, User } from 'lucide-react';
import { useTranslations } from '../../lib/locale';

export default function BottomNav() {
  const pathname = usePathname();
  const t = useTranslations();

  const items = [
    { to: '/app',          icon: Home,          label: t.nav_home     },
    { to: '/app/browse',   icon: Search,        label: t.nav_browse   },
    { to: '/app/create',   icon: PlusCircle,    label: t.nav_list     },
    { to: '/app/messages', icon: MessageCircle, label: t.nav_chat     },
    { to: '/app/profile',  icon: User,          label: t.nav_profile  },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-xl border-t border-black/8 pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around h-[58px] max-w-lg mx-auto px-2">
        {items.map(({ to, icon: Icon, label }) => {
          const active = pathname === to || (to !== '/app' && pathname.startsWith(to));
          return (
            <Link
              key={to}
              href={to}
              className="relative flex flex-col items-center justify-center gap-[3px] flex-1 py-2"
            >
              <Icon
                className={`w-[22px] h-[22px] transition-all duration-200 ${
                  active ? 'text-foreground scale-105' : 'text-black/30'
                }`}
                strokeWidth={active ? 2.5 : 1.75}
                fill={active ? 'currentColor' : 'none'}
                style={{ fillOpacity: active ? 0.12 : 0 }}
              />
              <span className={`text-[9px] font-medium tracking-wide transition-colors duration-200 ${
                active ? 'text-foreground font-semibold' : 'text-black/30'
              }`}>
                {label}
              </span>
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-4 h-[2px] bg-foreground rounded-full" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

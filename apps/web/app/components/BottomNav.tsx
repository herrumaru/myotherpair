'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Grid2x2, Plus, Mail, User } from 'lucide-react';

interface NavItemProps {
  to: string;
  Icon: React.ElementType;
  label: string;
  active: boolean;
}

function NavItem({ to, Icon, label, active }: NavItemProps) {
  return (
    <Link href={to} className="flex flex-col items-center justify-center gap-[3px] flex-1 h-full">
      <Icon
        size={22}
        strokeWidth={active ? 2.2 : 1.5}
        className={`transition-colors duration-150 ${active ? 'text-[#f05d23]' : 'text-white/45'}`}
      />
      <span className={`text-[10px] font-medium transition-colors duration-150 ${active ? 'text-[#f05d23]' : 'text-white/45'}`}>
        {label}
      </span>
    </Link>
  );
}

export default function BottomNav() {
  const pathname = usePathname();

  const isActive = (to: string) =>
    to === '/app/browse'
      ? pathname === '/app/browse' || pathname === '/app'
      : pathname.startsWith(to);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#1a1a1a] pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center h-[60px] max-w-lg mx-auto px-1">

        {/* Home */}
        <NavItem to="/app/browse" Icon={Home} label="Home" active={isActive('/app/browse')} />

        {/* My Listings */}
        <NavItem to="/app/listings" Icon={Grid2x2} label="Listings" active={isActive('/app/listings')} />

        {/* Centre — List a shoe (outlined circle) */}
        <Link
          href="/app/create"
          aria-label="List a shoe"
          className="flex flex-col items-center justify-center gap-[3px] flex-1 h-full"
        >
          <div className={`w-11 h-11 rounded-full border-2 flex items-center justify-center transition-all active:scale-95 ${
            isActive('/app/create')
              ? 'border-[#f05d23] bg-[#f05d23]/10'
              : 'border-white/40'
          }`}>
            <Plus
              size={20}
              strokeWidth={2}
              className={isActive('/app/create') ? 'text-[#f05d23]' : 'text-white/70'}
            />
          </div>
          <span className={`text-[10px] font-medium ${isActive('/app/create') ? 'text-[#f05d23]' : 'text-white/45'}`}>
            Sell
          </span>
        </Link>

        {/* Messages */}
        <NavItem to="/app/messages" Icon={Mail} label="Inbox" active={isActive('/app/messages')} />

        {/* Profile */}
        <NavItem to="/app/profile" Icon={User} label="Profile" active={isActive('/app/profile')} />

      </div>
    </nav>
  );
}

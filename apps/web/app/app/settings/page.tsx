'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';
import { X, ChevronRight, Check } from 'lucide-react';
import { useTheme } from '../../../lib/theme';
import { useLocale, LOCALES } from '../../../lib/locale';

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[13px] text-muted-foreground font-normal px-5 pt-7 pb-2 bg-background">{children}</p>
  );
}

function Row({
  label,
  sublabel,
  value,
  href,
  onClick,
  danger,
  right,
}: {
  label: string;
  sublabel?: string;
  value?: string;
  href?: string;
  onClick?: () => void;
  danger?: boolean;
  right?: React.ReactNode;
}) {
  const content = (
    <div
      className={`flex items-center px-5 py-[15px] border-b border-border bg-background active:bg-muted/30 transition-colors ${onClick || href ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <div className="flex-1 min-w-0">
        <p className={`text-[15px] leading-snug ${danger ? 'text-red-500' : 'text-foreground'}`}>{label}</p>
        {sublabel && <p className="text-[13px] text-muted-foreground mt-0.5 leading-snug">{sublabel}</p>}
      </div>
      {right ?? (
        <>
          {value && <span className="text-[13px] text-muted-foreground mr-2 flex-shrink-0">{value}</span>}
          {(href || onClick) && !danger && <ChevronRight className="w-[17px] h-[17px] text-muted-foreground/60 flex-shrink-0" />}
        </>
      )}
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`w-[51px] h-[31px] rounded-full flex items-center px-[2px] flex-shrink-0 transition-colors duration-200 ${on ? 'bg-foreground' : 'bg-muted-foreground/30'}`}
    >
      <div className={`w-[27px] h-[27px] rounded-full bg-background shadow-md transition-transform duration-200 ${on ? 'translate-x-[20px]' : 'translate-x-0'}`} />
    </button>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const { theme, toggle: toggleTheme } = useTheme();
  const { locale, setLocale } = useLocale();

  const [email,          setEmail]          = useState('');
  const [pauseProfile,   setPauseProfile]   = useState(false);
  const [showActive,     setShowActive]     = useState(true);
  const [pushNotifs,     setPushNotifs]     = useState(false);
  const [emailNotifs,    setEmailNotifs]    = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) { router.replace('/login'); return; }
      setEmail(session.user.email ?? '');
    });
  }, [router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace('/');
  };

  return (
    <div className="min-h-screen bg-background pb-16">

      {/* Header */}
      <div className="sticky top-0 z-40 bg-background border-b border-border flex items-center justify-center h-14 relative">
        <h1 className="text-[16px] font-semibold text-foreground">Account Settings</h1>
        <button
          onClick={() => router.back()}
          className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center"
          aria-label="Close"
        >
          <X className="w-5 h-5 text-foreground" />
        </button>
      </div>

      {/* Notifications */}
      <SectionLabel>Notifications</SectionLabel>
      <Row
        label="Push Notifications"
        right={<Toggle on={pushNotifs} onToggle={() => setPushNotifs(v => !v)} />}
      />
      <Row
        label="Email"
        right={<Toggle on={emailNotifs} onToggle={() => setEmailNotifs(v => !v)} />}
      />

      {/* Profile */}
      <SectionLabel>Profile</SectionLabel>
      <Row
        label="Edit Profile"
        sublabel="Update your name, location and shoe sizes"
        href="/app/profile/edit"
      />
      <Row
        label="Pause Account"
        sublabel="Pausing hides you from discovery. You can still chat with matches."
        right={<Toggle on={pauseProfile} onToggle={() => setPauseProfile(v => !v)} />}
      />
      <Row
        label="Show Last Active Status"
        sublabel="People viewing your profile can see your last active status."
        right={<Toggle on={showActive} onToggle={() => setShowActive(v => !v)} />}
      />

      {/* Language & Region */}
      <SectionLabel>Language &amp; Region</SectionLabel>
      <Row
        label="App Language"
        value={LOCALES.find(l => l.code === locale)?.label ?? 'English'}
        right={
          <div className="flex items-center gap-2">
            <select
              value={locale}
              onChange={e => setLocale(e.target.value)}
              className="text-[13px] text-muted-foreground bg-transparent outline-none appearance-none cursor-pointer pr-5 text-right"
              style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23888\' stroke-width=\'2\'%3E%3Cpath d=\'M6 9l6 6 6-6\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0px center' }}
            >
              {LOCALES.map(l => (
                <option key={l.code} value={l.code}>{l.flag} {l.label}</option>
              ))}
            </select>
          </div>
        }
      />
      <Row
        label="Appearance"
        value={theme === 'dark' ? 'Dark' : 'Light'}
        right={<Toggle on={theme === 'dark'} onToggle={toggleTheme} />}
      />

      {/* Phone & email */}
      <SectionLabel>Phone &amp; email</SectionLabel>
      <Row
        label={email}
        right={
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-foreground" />
            <Link href="/app/profile/edit" className="text-[15px] font-medium text-accent">Edit</Link>
          </div>
        }
      />

      {/* Safety */}
      <SectionLabel>Safety</SectionLabel>
      <Row label="Block List" sublabel="Block people you know." href="/app/profile/edit" />

      {/* Legal */}
      <SectionLabel>Legal</SectionLabel>
      <Row label="Privacy Policy"   href="/privacy"  />
      <Row label="Terms of Service" href="/terms"    />
      <Row label="Download My Data" onClick={() => {}} />

      {/* Community */}
      <SectionLabel>Community</SectionLabel>
      <Row label="Safe Buying Tips"    onClick={() => {}} />
      <Row label="Member Guidelines"   onClick={() => {}} />

      {/* Log out / Delete */}
      <div className="mt-8 border-t border-border">
        <button
          onClick={handleSignOut}
          className="w-full py-4 text-[15px] text-foreground text-center border-b border-border bg-background active:bg-muted/30 transition-colors"
        >
          Log Out
        </button>
        <button
          onClick={() => {}}
          className="w-full py-4 text-[15px] text-muted-foreground text-center bg-background active:bg-muted/30 transition-colors"
        >
          Delete or Pause Account
        </button>
      </div>
    </div>
  );
}

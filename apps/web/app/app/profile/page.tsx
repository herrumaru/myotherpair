'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import {
  Settings, MapPin, ShoppingBag, MessageCircle, LogOut,
  Heart, ChevronRight, Sun, Moon, Globe, PlusCircle,
} from 'lucide-react';
import { formatSizeLabel } from '../../../lib/sizeConversion';
import { useTheme } from '../../../lib/theme';
import { useLocale, LOCALES } from '../../../lib/locale';

interface ProfileData {
  name?: string;
  email?: string;
  avatar_url?: string;
  location?: string;
  foot_size_left?: number | null;
  foot_size_right?: number | null;
  is_amputee?: boolean;
  bio?: string | null;
  created_at?: string;
}

interface Stats { listings: number; matches: number; saved: number }

interface SavedListing {
  id: string; shoe_brand: string; shoe_model: string;
  size: number; foot_side: string; price: number | null; photos: string[];
}

type Tab = 'profile' | 'activity' | 'settings';

export default function ProfilePage() {
  const router = useRouter();
  const { theme, toggle: toggleTheme } = useTheme();
  const { locale, setLocale } = useLocale();
  const [activeTab, setActiveTab] = useState<Tab>('profile');

  const [userId,        setUserId]        = useState<string | null>(null);
  const [profile,       setProfile]       = useState<ProfileData>({});
  const [stats,         setStats]         = useState<Stats>({ listings: 0, matches: 0, saved: 0 });
  const [loading,       setLoading]       = useState(true);
  const [savedListings, setSavedListings] = useState<SavedListing[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setUserId(session.user.id);
    });
  }, []);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const [profileRes, listingsRes, matchesRes, savedCountRes, authUser] = await Promise.all([
        supabase.from('users').select('*').eq('id', userId).single(),
        supabase.from('listings').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'active'),
        supabase.from('matches').select('id', { count: 'exact', head: true }).or(`user_id_1.eq.${userId},user_id_2.eq.${userId}`),
        supabase.from('saved_listings').select('id', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.auth.getUser(),
      ]);

      const dbProfile = (profileRes.data ?? {}) as ProfileData;
      // Fall back to auth metadata if the users row has no name yet
      const metaName = (authUser.data?.user?.user_metadata?.full_name as string | undefined)
        ?? (authUser.data?.user?.user_metadata?.name as string | undefined);
      if (!dbProfile.name && metaName) dbProfile.name = metaName;
      if (!dbProfile.email) dbProfile.email = authUser.data?.user?.email ?? '';
      setProfile(dbProfile);

      setStats({
        listings: listingsRes.count ?? 0,
        matches:  matchesRes.count  ?? 0,
        saved:    savedCountRes.count ?? 0,
      });

      const { data: savedData } = await supabase
        .from('saved_listings')
        .select('listing_id, listings(id, shoe_brand, shoe_model, size, foot_side, price, photos)')
        .eq('user_id', userId)
        .limit(8);

      if (savedData) {
        const listings = (savedData as { listing_id: string; listings: SavedListing | null }[])
          .map(r => r.listings).filter((l): l is SavedListing => l !== null);
        setSavedListings(listings);
      }

      setLoading(false);
    })();
  }, [userId]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace('/');
  };

  const name     = profile.name ?? '';
  const initials = name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '?';
  const leftSize  = profile.foot_size_left  != null ? formatSizeLabel(String(profile.foot_size_left),  'UK') : null;
  const rightSize = profile.foot_size_right != null ? formatSizeLabel(String(profile.foot_size_right), 'UK') : null;
  const memberSince = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
    : null;

  // Profile completeness (rough heuristic)
  const completionFields = [profile.name, profile.avatar_url, profile.location, profile.foot_size_left ?? profile.foot_size_right, profile.bio];
  const completionPct = Math.round((completionFields.filter(Boolean).length / completionFields.length) * 100);
  const circumference = 2 * Math.PI * 28; // r=28
  const dashOffset = circumference - (completionPct / 100) * circumference;

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="max-w-lg mx-auto px-5 pt-5 space-y-3">
          <div className="bg-black/5 rounded-2xl h-52 animate-pulse" />
          <div className="bg-black/5 rounded-2xl h-24 animate-pulse" />
        </div>
      </div>
    );
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: 'profile',  label: 'Profile'  },
    { id: 'activity', label: 'Activity' },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <div className="min-h-screen bg-background pb-24">

      {/* ── Header ── */}
      <header className="sticky top-0 z-40 bg-background">
        <div className="flex items-end justify-between px-5 pt-5 pb-3 max-w-lg mx-auto">
          <h1 className="text-[28px] font-bold text-foreground leading-none tracking-[-0.02em]">
            Profile
          </h1>
          <div className="flex items-center gap-2">
            <Link href="/app/settings" className="w-9 h-9 flex items-center justify-center rounded-full bg-black/[0.06]">
              <Settings className="w-[17px] h-[17px] text-black/50" />
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto">

        {/* ── Avatar + name hero ── */}
        <div className="flex flex-col items-center pt-6 pb-5 px-5">
          {/* Circular avatar with progress ring */}
          <div className="relative mb-4">
            <svg width="76" height="76" viewBox="0 0 76 76" className="absolute inset-0 -rotate-90">
              <circle cx="38" cy="38" r="35" fill="none" stroke="hsl(var(--border))" strokeWidth="3" />
              <circle
                cx="38" cy="38" r="35"
                fill="none"
                stroke="hsl(var(--accent))"
                strokeWidth="3"
                strokeDasharray={`${2 * Math.PI * 35}`}
                strokeDashoffset={`${2 * Math.PI * 35 - (completionPct / 100) * 2 * Math.PI * 35}`}
                strokeLinecap="round"
              />
            </svg>
            <div className="w-[76px] h-[76px] rounded-full overflow-hidden border-[3px] border-background">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt={name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-accent/20 to-accent/5 flex items-center justify-center">
                  <span className="text-xl font-bold text-accent/60">{initials}</span>
                </div>
              )}
            </div>
            {/* Add photo button */}
            <Link
              href="/app/profile/edit"
              className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-foreground border-2 border-background flex items-center justify-center"
            >
              <PlusCircle className="w-3.5 h-3.5 text-white" />
            </Link>
          </div>

          <h2 className="text-[22px] font-bold text-foreground tracking-[-0.02em] leading-tight">
            {name || 'Set your name'}
          </h2>
          {profile.location && (
            <div className="flex items-center gap-1 text-black/40 mt-1">
              <MapPin className="w-3 h-3" />
              <span className="text-[12px]">{profile.location}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 mt-2">
            <div className="h-1.5 w-1.5 rounded-full bg-accent" />
            <span className="text-[12px] text-black/40 font-medium">{completionPct}% complete</span>
          </div>
        </div>

        {/* ── Stats row ── */}
        <div className="flex border-t border-b border-black/[0.07] divide-x divide-black/[0.07]">
          {[
            { label: 'Listings',  value: stats.listings },
            { label: 'Matches',   value: stats.matches  },
            { label: 'Saved',     value: stats.saved    },
          ].map(s => (
            <div key={s.label} className="flex-1 py-4 text-center">
              <p className="text-[20px] font-bold text-foreground leading-none">{s.value}</p>
              <p className="text-[10px] text-black/30 font-medium uppercase tracking-wider mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* ── Tab bar ── */}
        <div className="flex border-b border-black/[0.07]">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-3.5 text-[13px] font-semibold transition-colors relative ${
                activeTab === tab.id ? 'text-foreground' : 'text-black/35'
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-[2px] bg-foreground rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* ── Tab content ── */}
        <div className="px-5 pt-4 pb-6">

          {/* PROFILE TAB */}
          {activeTab === 'profile' && (
            <div className="space-y-3">

              {/* Shoe profile */}
              {(leftSize || rightSize || profile.is_amputee) && (
                <div className="bg-white rounded-2xl border border-black/[0.07] px-5 py-4">
                  <p className="text-[10px] font-bold text-accent tracking-[0.2em] uppercase mb-3">My Shoe Profile</p>
                  {profile.is_amputee ? (
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] text-black/40 font-medium">Single shoe needed</span>
                      <span className="text-[13px] font-semibold text-foreground">{leftSize || rightSize}</span>
                    </div>
                  ) : (
                    <div className="flex gap-3">
                      {leftSize && (
                        <div className="flex-1 bg-black/[0.04] rounded-xl px-4 py-3 text-center">
                          <p className="text-[10px] text-black/30 font-medium uppercase tracking-wider mb-1">Left</p>
                          <p className="text-[16px] font-bold text-foreground">{leftSize}</p>
                        </div>
                      )}
                      {rightSize && (
                        <div className="flex-1 bg-black/[0.04] rounded-xl px-4 py-3 text-center">
                          <p className="text-[10px] text-black/30 font-medium uppercase tracking-wider mb-1">Right</p>
                          <p className="text-[16px] font-bold text-foreground">{rightSize}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Bio */}
              <div className="bg-white rounded-2xl border border-black/[0.07] px-5 py-4">
                <p className="text-[10px] font-bold text-accent tracking-[0.2em] uppercase mb-2">What I'm looking for</p>
                <p className="text-[15px] text-foreground leading-relaxed">
                  {profile.bio || (profile.location ? `Looking for shoes in ${profile.location}` : 'Looking for the perfect match')}
                </p>
                <Link
                  href="/app/profile/edit"
                  className="mt-3 text-[12px] font-semibold text-accent inline-block"
                >
                  Edit
                </Link>
              </div>

              {/* Saved listings */}
              {savedListings.length > 0 && (
                <div className="bg-white rounded-2xl border border-black/[0.07] overflow-hidden">
                  <div className="px-5 pt-4 pb-1 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Heart className="w-3.5 h-3.5 text-accent" />
                      <span className="text-[13px] font-bold text-foreground">Saved shoes</span>
                    </div>
                    <Link href="/app/browse" className="text-[12px] text-accent font-semibold">See all</Link>
                  </div>
                  <div className="flex gap-2.5 overflow-x-auto scrollbar-hide px-5 pb-4 pt-3">
                    {savedListings.map(l => (
                      <Link key={l.id} href={`/app/listing/${l.id}`} className="flex-shrink-0 w-[85px]">
                        <div className="aspect-square rounded-xl overflow-hidden bg-black/5 mb-1.5">
                          {l.photos[0] ? (
                            <img src={l.photos[0]} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-2xl opacity-20">👟</div>
                          )}
                        </div>
                        <p className="text-[11px] font-semibold text-foreground truncate">{l.shoe_brand}</p>
                        <p className="text-[10px] text-black/35 truncate">{l.shoe_model}</p>
                        <p className="text-[11px] font-bold text-foreground">{l.price != null ? `$${l.price}` : '—'}</p>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {memberSince && (
                <p className="text-center text-[11px] text-black/25">Member since {memberSince}</p>
              )}
            </div>
          )}

          {/* ACTIVITY TAB */}
          {activeTab === 'activity' && (
            <div className="space-y-0.5">
              <Link href="/app/listings" className="flex items-center gap-4 py-4 border-b border-black/[0.06]">
                <div className="w-9 h-9 rounded-xl bg-black/[0.05] flex items-center justify-center flex-shrink-0">
                  <ShoppingBag className="w-4 h-4 text-black/40" />
                </div>
                <div className="flex-1">
                  <p className="text-[14px] font-semibold text-foreground">My Listings</p>
                  <p className="text-[12px] text-black/35">{stats.listings} active</p>
                </div>
                <ChevronRight className="w-4 h-4 text-black/20" />
              </Link>
              <Link href="/app/messages" className="flex items-center gap-4 py-4 border-b border-black/[0.06]">
                <div className="w-9 h-9 rounded-xl bg-black/[0.05] flex items-center justify-center flex-shrink-0">
                  <MessageCircle className="w-4 h-4 text-black/40" />
                </div>
                <div className="flex-1">
                  <p className="text-[14px] font-semibold text-foreground">Messages</p>
                  <p className="text-[12px] text-black/35">{stats.matches} conversation{stats.matches !== 1 ? 's' : ''}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-black/20" />
              </Link>
              <Link href="/app/browse" className="flex items-center gap-4 py-4">
                <div className="w-9 h-9 rounded-xl bg-black/[0.05] flex items-center justify-center flex-shrink-0">
                  <Heart className="w-4 h-4 text-black/40" />
                </div>
                <div className="flex-1">
                  <p className="text-[14px] font-semibold text-foreground">Saved Shoes</p>
                  <p className="text-[12px] text-black/35">{stats.saved} saved</p>
                </div>
                <ChevronRight className="w-4 h-4 text-black/20" />
              </Link>
            </div>
          )}

          {/* SETTINGS TAB */}
          {activeTab === 'settings' && (
            <div className="space-y-5">

              {/* Account section */}
              <div>
                <p className="text-[11px] font-bold text-black/30 tracking-[0.15em] uppercase mb-2 px-1">Account</p>
                <div className="bg-white rounded-2xl border border-black/[0.07] overflow-hidden">
                  <Link href="/app/settings" className="flex items-center gap-4 px-5 py-4 border-b border-black/[0.05]">
                    <span className="flex-1 text-[14px] font-medium text-foreground">Account Settings</span>
                    <ChevronRight className="w-4 h-4 text-black/20" />
                  </Link>
                  <div className="flex items-center gap-4 px-5 py-4">
                    <span className="flex-1 text-[14px] font-medium text-foreground">Email</span>
                    <span className="text-[13px] text-black/30 truncate max-w-[160px]">{profile.email ?? ''}</span>
                  </div>
                </div>
              </div>

              {/* Preferences section */}
              <div>
                <p className="text-[11px] font-bold text-black/30 tracking-[0.15em] uppercase mb-2 px-1">Preferences</p>
                <div className="bg-white rounded-2xl border border-black/[0.07] overflow-hidden">
                  {/* Dark mode */}
                  <div className="flex items-center gap-4 px-5 py-4 border-b border-black/[0.05]">
                    {theme === 'dark'
                      ? <Moon className="w-4 h-4 text-black/30 flex-shrink-0" />
                      : <Sun  className="w-4 h-4 text-black/30 flex-shrink-0" />
                    }
                    <span className="flex-1 text-[14px] font-medium text-foreground">
                      {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
                    </span>
                    <button
                      onClick={toggleTheme}
                      className={`w-11 h-[26px] rounded-full flex items-center transition-colors duration-200 ${
                        theme === 'dark' ? 'bg-foreground' : 'bg-black/15'
                      }`}
                    >
                      <div className={`w-[22px] h-[22px] rounded-full bg-white shadow-sm mx-[2px] transition-transform duration-200 ${
                        theme === 'dark' ? 'translate-x-[18px]' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>
                  {/* Language */}
                  <div className="flex items-center gap-4 px-5 py-4">
                    <Globe className="w-4 h-4 text-black/30 flex-shrink-0" />
                    <span className="flex-1 text-[14px] font-medium text-foreground">Language</span>
                    <select
                      value={locale}
                      onChange={e => setLocale(e.target.value)}
                      className="text-[13px] text-foreground bg-black/5 border border-black/8 rounded-xl px-2.5 py-1.5 outline-none appearance-none cursor-pointer pr-7"
                      style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23888\' stroke-width=\'2\'%3E%3Cpath d=\'M6 9l6 6 6-6\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}
                    >
                      {LOCALES.map(l => (
                        <option key={l.code} value={l.code}>{l.flag} {l.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Danger zone */}
              <div>
                <p className="text-[11px] font-bold text-black/30 tracking-[0.15em] uppercase mb-2 px-1">Account</p>
                <div className="bg-white rounded-2xl border border-black/[0.07] overflow-hidden">
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-4 px-5 py-4"
                  >
                    <LogOut className="w-4 h-4 text-red-400 flex-shrink-0" />
                    <span className="text-[14px] font-medium text-red-500">Sign out</span>
                  </button>
                </div>
              </div>

              <p className="text-center text-[10px] text-black/20 tracking-wider uppercase pt-1">Privacy · Terms</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

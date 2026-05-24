'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import {
  Settings, MapPin, Edit2, ChevronRight, ShoppingBag,
  MessageCircle, LogOut, Heart, Pencil, Check, X,
  Sun, Moon, Globe,
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

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl border border-black/[0.07] overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

function Row({
  icon, label, value, href, onClick, danger, chevron = true,
}: {
  icon: React.ReactNode; label: string; value?: string;
  href?: string; onClick?: () => void; danger?: boolean; chevron?: boolean;
}) {
  const content = (
    <div
      className={`flex items-center gap-3.5 px-5 py-4 active:bg-black/[0.03] transition-colors cursor-pointer`}
      onClick={onClick}
    >
      <span className={`flex-shrink-0 ${danger ? 'text-red-400' : 'text-black/30'}`}>{icon}</span>
      <span className={`flex-1 text-[14px] font-medium ${danger ? 'text-red-500' : 'text-foreground'}`}>{label}</span>
      {value && <span className="text-[13px] text-black/30">{value}</span>}
      {chevron && <ChevronRight className="h-[15px] w-[15px] text-black/15 flex-shrink-0" />}
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const router = useRouter();
  const { theme, toggle: toggleTheme } = useTheme();
  const { locale, setLocale } = useLocale();

  const [userId,        setUserId]        = useState<string | null>(null);
  const [profile,       setProfile]       = useState<ProfileData>({});
  const [stats,         setStats]         = useState<Stats>({ listings: 0, matches: 0, saved: 0 });
  const [loading,       setLoading]       = useState(true);
  const [bio,           setBio]           = useState('');
  const [editingBio,    setEditingBio]    = useState(false);
  const [bioDraft,      setBioDraft]      = useState('');
  const [savedListings, setSavedListings] = useState<SavedListing[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setUserId(session.user.id);
    });
  }, []);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const [profileRes, listingsRes, matchesRes, savedCountRes] = await Promise.all([
        supabase.from('users').select('*').eq('id', userId).single(),
        supabase.from('listings').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'active'),
        supabase.from('matches').select('id', { count: 'exact', head: true }).or(`user_id_1.eq.${userId},user_id_2.eq.${userId}`),
        supabase.from('saved_listings').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      ]);

      if (profileRes.data) {
        const d = profileRes.data as ProfileData;
        setProfile(d);
        const defaultBio = d.bio || (d.location ? `Looking for shoes in ${d.location}` : 'Looking for the perfect match');
        setBio(defaultBio);
        setBioDraft(defaultBio);
      }

      setStats({
        listings: listingsRes.count ?? 0,
        matches:  matchesRes.count  ?? 0,
        saved:    savedCountRes.count ?? 0,
      });

      // Load saved listings preview
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

  const saveBio = async () => {
    setBio(bioDraft);
    setEditingBio(false);
    if (userId) await supabase.from('users').update({ bio: bioDraft }).eq('id', userId);
  };

  const name     = profile.name ?? '';
  const initials = name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '?';
  const leftSize  = profile.foot_size_left  != null ? formatSizeLabel(String(profile.foot_size_left),  'UK') : null;
  const rightSize = profile.foot_size_right != null ? formatSizeLabel(String(profile.foot_size_right), 'UK') : null;

  const memberSince = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
    : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <header className="sticky top-0 z-40 bg-background border-b border-black/[0.07] flex items-center justify-center h-14">
          <h1 className="text-[13px] font-bold tracking-[0.15em] uppercase text-foreground">My Profile</h1>
        </header>
        <div className="max-w-lg mx-auto px-5 pt-5 space-y-3">
          <div className="bg-black/5 rounded-2xl h-52 animate-pulse" />
          <div className="bg-black/5 rounded-2xl h-24 animate-pulse" />
          <div className="bg-black/5 rounded-2xl h-32 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">

      {/* ── Header ── */}
      <header className="sticky top-0 z-40 bg-background border-b border-black/[0.07] flex items-center justify-between px-5 h-14">
        <div className="w-8" />
        <h1 className="text-[13px] font-bold tracking-[0.15em] uppercase text-foreground">My Profile</h1>
        <Link href="/app/profile/edit" className="w-8 h-8 flex items-center justify-center">
          <Settings className="w-[18px] h-[18px] text-black/40" />
        </Link>
      </header>

      <div className="max-w-lg mx-auto px-5 pt-5 space-y-3 pb-6">

        {/* ── Profile hero card ── */}
        <SectionCard>
          {/* Photo / avatar */}
          <div className="relative h-52 bg-black/5">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-accent/20 to-accent/5 flex items-center justify-center">
                <span className="text-5xl font-bold text-accent/40">{initials}</span>
              </div>
            )}
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
            {/* Name overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-4 flex items-end justify-between">
              <div>
                <h2 className="font-display text-[1.5rem] font-bold text-white leading-tight tracking-[-0.02em]">
                  {name || 'No name set'}
                </h2>
                {profile.location && (
                  <div className="flex items-center gap-1 text-white/70 mt-0.5">
                    <MapPin className="w-3 h-3" />
                    <span className="text-[12px]">{profile.location}</span>
                  </div>
                )}
              </div>
              <Link
                href="/app/profile/edit"
                className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30"
              >
                <Edit2 className="w-[15px] h-[15px] text-white" />
              </Link>
            </div>
          </div>

          {/* Stats row */}
          <div className="flex divide-x divide-black/[0.06]">
            {[
              { label: 'Listings',  value: stats.listings },
              { label: 'Matches',   value: stats.matches  },
              { label: 'Saved',     value: stats.saved    },
            ].map(s => (
              <div key={s.label} className="flex-1 py-4 text-center">
                <p className="text-[18px] font-bold text-foreground leading-none">{s.value}</p>
                <p className="text-[10px] text-black/30 font-medium uppercase tracking-wider mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* ── Prompt card: What I'm looking for ── */}
        <SectionCard>
          <div className="px-5 py-4">
            <p className="text-[10px] font-bold text-accent tracking-[0.2em] uppercase mb-2">
              What I&rsquo;m looking for
            </p>
            {editingBio ? (
              <div className="flex items-start gap-2">
                <textarea
                  value={bioDraft}
                  onChange={e => setBioDraft(e.target.value)}
                  rows={3}
                  autoFocus
                  className="flex-1 text-[15px] text-foreground bg-transparent outline-none resize-none leading-relaxed border-b border-accent/30 pb-1 placeholder:text-black/20"
                  placeholder="e.g. Right Nike Air Max, UK 9"
                />
                <div className="flex flex-col gap-1 mt-0.5">
                  <button onClick={saveBio} className="w-7 h-7 rounded-full bg-accent flex items-center justify-center">
                    <Check className="w-3.5 h-3.5 text-white" />
                  </button>
                  <button onClick={() => { setBioDraft(bio); setEditingBio(false); }} className="w-7 h-7 rounded-full bg-black/8 flex items-center justify-center">
                    <X className="w-3.5 h-3.5 text-black/50" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-3">
                <p className="text-[15px] text-foreground leading-relaxed flex-1">{bio}</p>
                <button
                  onClick={() => setEditingBio(true)}
                  className="w-7 h-7 rounded-full bg-black/5 flex items-center justify-center flex-shrink-0 mt-0.5"
                >
                  <Pencil className="w-3 h-3 text-black/40" />
                </button>
              </div>
            )}
          </div>
        </SectionCard>

        {/* ── Shoe profile card ── */}
        {(leftSize || rightSize || profile.is_amputee) && (
          <SectionCard>
            <div className="px-5 py-4">
              <p className="text-[10px] font-bold text-accent tracking-[0.2em] uppercase mb-3">
                My Shoe Profile
              </p>
              {profile.is_amputee ? (
                <div className="flex items-center gap-2">
                  <span className="text-[13px] text-black/40 font-medium">Single shoe needed</span>
                  <span className="text-[13px] font-semibold text-foreground">
                    {leftSize || rightSize}
                  </span>
                </div>
              ) : (
                <div className="flex gap-4">
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
          </SectionCard>
        )}

        {/* ── Saved listings ── */}
        {savedListings.length > 0 && (
          <SectionCard>
            <div className="px-5 pt-4 pb-1 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Heart className="w-3.5 h-3.5 text-accent" />
                <span className="text-[13px] font-bold text-foreground">Saved</span>
                <span className="text-[12px] text-black/30">({savedListings.length})</span>
              </div>
              <Link href="/app/browse" className="text-[12px] text-accent font-semibold">See all</Link>
            </div>
            <div className="flex gap-2.5 overflow-x-auto scrollbar-hide px-5 pb-4 pt-3">
              {savedListings.map(l => (
                <Link key={l.id} href={`/app/listing/${l.id}`} className="flex-shrink-0 w-[90px]">
                  <div className="aspect-square rounded-xl overflow-hidden bg-black/5 mb-1.5 relative">
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
          </SectionCard>
        )}

        {/* ── Activity links ── */}
        <SectionCard>
          <Row icon={<ShoppingBag size={17} />} label="My Listings"  href="/app/listings"  value={`${stats.listings}`} />
          <div className="h-px bg-black/[0.05] mx-5" />
          <Row icon={<MessageCircle size={17} />} label="My Matches" href="/app/messages" value={`${stats.matches}`}  />
        </SectionCard>

        {/* ── Settings ── */}
        <SectionCard>
          {/* Dark mode */}
          <div className="flex items-center gap-3.5 px-5 py-4">
            {theme === 'dark'
              ? <Moon size={17} className="text-black/30 flex-shrink-0" />
              : <Sun  size={17} className="text-black/30 flex-shrink-0" />
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

          <div className="h-px bg-black/[0.05] mx-5" />

          {/* Language */}
          <div className="flex items-center gap-3.5 px-5 py-4">
            <Globe size={17} className="text-black/30 flex-shrink-0" />
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
        </SectionCard>

        {/* ── Danger zone ── */}
        <SectionCard>
          <Row
            icon={<LogOut size={17} />}
            label="Sign out"
            onClick={handleSignOut}
            danger
            chevron={false}
          />
        </SectionCard>

        {/* Footer info */}
        <div className="text-center pt-1 pb-2">
          {memberSince && (
            <p className="text-[11px] text-black/20 mb-1">Member since {memberSince}</p>
          )}
          <p className="text-[10px] text-black/15 tracking-wider uppercase">Privacy · Terms</p>
        </div>
      </div>
    </div>
  );
}

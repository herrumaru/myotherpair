'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { motion } from 'framer-motion';
import {
  MapPin, Edit, Search, Check, X,
  ChevronRight, ShoppingBag, Settings,
  HelpCircle, LogOut, PlusCircle, MessageCircle, Heart,
} from 'lucide-react';
import { formatSizeLabel } from '../../../lib/sizeConversion';
import { useTheme } from '../../../lib/theme';
import { useLocale, useTranslations, LOCALES } from '../../../lib/locale';

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

interface Stats {
  listings: number;
  matches:  number;
  trades:   number;
}

interface SavedListing {
  id: string;
  shoe_brand: string;
  shoe_model: string;
  size: number;
  foot_side: string;
  price: number | null;
  photos: string[];
}


const fadeUp = (delay = 0) => ({
  initial:    { opacity: 0, y: 10 },
  animate:    { opacity: 1, y: 0 },
  transition: { duration: 0.4, delay, ease: 'easeOut' as const },
});

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  href?: string;
  value?: string;
  onClick?: () => void;
  destructive?: boolean;
}

function MenuItem({ icon, label, href, value, onClick, destructive }: MenuItemProps) {
  const content = (
    <div
      className={`flex items-center gap-4 px-5 py-4 hover:bg-black/[0.02] active:bg-black/[0.04] transition-colors cursor-pointer`}
      onClick={onClick}
    >
      <span className={`flex-shrink-0 ${destructive ? 'text-red-400' : 'text-black/30'}`}>{icon}</span>
      <span className={`flex-1 text-[14px] font-medium ${destructive ? 'text-red-500' : 'text-foreground'}`}>{label}</span>
      {value && <span className="text-[13px] text-black/30 font-medium">{value}</span>}
      <ChevronRight className="h-4 w-4 text-black/15" />
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}

export default function ProfilePage() {
  const router = useRouter();
  const { theme, toggle: toggleTheme } = useTheme();
  const { locale, setLocale } = useLocale();
  const t = useTranslations();
  const [userId,        setUserId]        = useState<string | null>(null);
  const [profile,       setProfile]       = useState<ProfileData>({});
  const [stats,         setStats]         = useState<Stats>({ listings: 0, matches: 0, trades: 0 });
  const [loading,       setLoading]       = useState(true);
  const [searchStatus,  setSearchStatus]  = useState('');
  const [editingStatus, setEditingStatus] = useState(false);
  const [statusDraft,   setStatusDraft]   = useState('');
  const [savedListings, setSavedListings] = useState<SavedListing[]>([]);
  const [savedIds,      setSavedIds]      = useState<string[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setUserId(session.user.id);
    });
  }, []);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const [profileRes, listingsRes, matchesRes, tradesRes] = await Promise.all([
        supabase.from('users').select('*').eq('id', userId).single(),
        supabase.from('listings').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'active'),
        supabase.from('matches').select('id', { count: 'exact', head: true }).or(`user_id_1.eq.${userId},user_id_2.eq.${userId}`),
        supabase.from('matches').select('id', { count: 'exact', head: true }).or(`user_id_1.eq.${userId},user_id_2.eq.${userId}`).eq('status', 'completed'),
      ]);
      if (profileRes.data) {
        const d = profileRes.data as ProfileData;
        setProfile(d);
        const defaultStatus = d.bio || (d.location ? `Looking for shoes in ${d.location}` : 'Looking for the perfect match');
        setSearchStatus(defaultStatus);
        setStatusDraft(defaultStatus);
      }
      setStats({
        listings: listingsRes.count ?? 0,
        matches:  matchesRes.count  ?? 0,
        trades:   tradesRes.count   ?? 0,
      });
      setLoading(false);
    })();
  }, [userId]);

  // Load saved listings from Supabase (joined with listing details)
  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data } = await supabase
        .from('saved_listings')
        .select('listing_id, listings(id, shoe_brand, shoe_model, size, foot_side, price, photos)')
        .eq('user_id', userId);

      if (data) {
        const listings = (data as { listing_id: string; listings: SavedListing | null }[])
          .map(r => r.listings)
          .filter((l): l is SavedListing => l !== null && (l as SavedListing & { status?: string }).status !== 'deleted');
        setSavedListings(listings);
        setSavedIds(listings.map(l => l.id));
      }
    })();
  }, [userId]);

  const unsaveListing = async (id: string) => {
    if (!userId) return;
    setSavedIds(prev => prev.filter(s => s !== id));
    setSavedListings(prev => prev.filter(l => l.id !== id));
    await supabase.from('saved_listings').delete().eq('user_id', userId).eq('listing_id', id);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace('/');
  };

  const name       = profile.name ?? '';
  const initials   = name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '?';
  const leftSize   = profile.foot_size_left  != null ? formatSizeLabel(String(profile.foot_size_left),  'UK') : null;
  const rightSize  = profile.foot_size_right != null ? formatSizeLabel(String(profile.foot_size_right), 'UK') : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-black/8">
          <div className="flex items-center justify-center px-6 h-14 max-w-lg mx-auto">
            <h1 className="text-[14px] font-semibold text-foreground tracking-[0.08em] uppercase">{t.profile_title}</h1>
          </div>
        </header>
        <div className="flex flex-col items-center px-5 pt-8 pb-4">
          <div className="w-16 h-16 rounded-full bg-black/8 animate-pulse mb-4" />
          <div className="h-5 w-32 rounded-lg bg-black/8 animate-pulse mb-2" />
          <div className="h-3 w-24 rounded-lg bg-black/8 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-black/8">
        <div className="flex items-center justify-center px-6 h-14 max-w-lg mx-auto">
          <h1 className="text-[14px] font-semibold text-foreground tracking-[0.08em] uppercase">{t.profile_title}</h1>
        </div>
      </header>

      <div className="max-w-lg mx-auto">
        {/* User card */}
        <motion.div {...fadeUp(0)} className="px-5 pt-6 pb-2">
          <div className="bg-white rounded-2xl border border-black/8 p-5 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="relative">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={name}
                    className="w-[60px] h-[60px] rounded-full object-cover border-2 border-black/8"
                  />
                ) : (
                  <div className="w-[60px] h-[60px] rounded-full bg-black/8 flex items-center justify-center text-[20px] font-bold text-foreground border-2 border-black/8">
                    {initials}
                  </div>
                )}
                <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-green-500 border-[2.5px] border-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-display text-[1.2rem] font-bold text-foreground tracking-[-0.01em]">
                  {name || 'No name set'}
                </h2>
                {profile.location && (
                  <div className="flex items-center gap-1 text-black/35 mt-0.5">
                    <MapPin className="h-3 w-3" />
                    <span className="text-[12px]">{profile.location}</span>
                  </div>
                )}
              </div>
              <Link href="/app/profile/edit" className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center hover:bg-black/10 transition-colors">
                <Edit className="h-3.5 w-3.5 text-black/50" />
              </Link>
            </div>

            {/* Quick stats */}
            <div className="flex items-center mt-5 pt-4 border-t border-black/6">
              {[
                { label: t.profile_stat_listings, value: stats.listings },
                { label: t.profile_stat_matches,  value: stats.matches  },
                { label: t.profile_stat_sizes,    value: leftSize && rightSize ? `L · R` : leftSize ? `L` : rightSize ? `R` : '—' },
              ].map((stat, i) => (
                <div key={i} className={`text-center flex-1 ${i > 0 ? 'border-l border-black/6' : ''}`}>
                  <p className="text-[16px] font-bold text-foreground leading-none">{stat.value}</p>
                  <p className="text-[10px] text-black/30 font-medium tracking-[0.1em] uppercase mt-1.5">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Search status */}
        <motion.div {...fadeUp(0.05)} className="px-5 pb-2 pt-2">
          <div className="bg-white rounded-2xl border border-black/8 px-5 py-4">
            <div className="flex items-start gap-3">
              <Search className="h-3.5 w-3.5 text-black/30 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-black/30 tracking-[0.2em] uppercase font-semibold mb-1">{t.profile_searching_for}</p>
                {editingStatus ? (
                  <div className="flex items-center gap-2">
                    <input
                      value={statusDraft}
                      onChange={(e) => setStatusDraft(e.target.value)}
                      className="flex-1 bg-transparent text-[13px] text-foreground outline-none border-b border-accent/30 pb-1 placeholder:text-muted-foreground/30"
                      placeholder="e.g. Right Nike Dunk, UK 8"
                      autoFocus
                    />
                    <button onClick={async () => {
                      setSearchStatus(statusDraft);
                      setEditingStatus(false);
                      if (userId) {
                        await supabase.from('users').update({ bio: statusDraft }).eq('id', userId);
                      }
                    }} className="text-accent">
                      <Check className="h-4 w-4" />
                    </button>
                    <button onClick={() => { setStatusDraft(searchStatus); setEditingStatus(false); }} className="text-muted-foreground/40">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <p
                    className="text-[13px] text-foreground/70 leading-relaxed cursor-pointer"
                    onClick={() => setEditingStatus(true)}
                  >
                    {searchStatus}
                  </p>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* CTA Banner */}
        <motion.div {...fadeUp(0.08)} className="px-5 pt-1 pb-2">
          <Link href="/app/create">
            <div className="relative overflow-hidden bg-foreground rounded-2xl p-5 flex items-center gap-4">
              <div className="flex-1">
                <h3 className="font-display text-[1.1rem] font-bold text-background mb-1">{t.profile_list_shoe}</h3>
                <p className="text-[12px] text-background/60 leading-relaxed mb-3">{t.profile_list_subtitle}</p>
                <div className="inline-flex items-center gap-1.5 bg-background/10 px-3 py-1.5 rounded-full text-[11px] tracking-[0.08em] uppercase font-semibold text-background">
                  <PlusCircle className="h-3 w-3" />
                  {t.profile_list_now}
                </div>
              </div>
              <div className="w-16 h-16 rounded-2xl bg-background/10 flex items-center justify-center">
                <ShoppingBag className="h-7 w-7 text-background/40" />
              </div>
            </div>
          </Link>
        </motion.div>

        {/* Saved Listings */}
        <motion.div {...fadeUp(0.09)} className="px-5 pt-1 pb-2">
          <div className="bg-white rounded-2xl border border-black/8 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Heart className="h-3.5 w-3.5 text-accent" />
                <span className="text-[11px] font-bold text-foreground tracking-[0.08em] uppercase">
                  Saved Listings
                </span>
                {savedIds.length > 0 && (
                  <span className="text-[10px] text-muted-foreground/50">({savedIds.length})</span>
                )}
              </div>
              {savedListings.length > 0 && (
                <Link href="/app/browse" className="text-[11px] text-accent font-semibold hover:underline">
                  Browse more
                </Link>
              )}
            </div>

            {savedListings.length === 0 ? (
              <div className="text-center py-5">
                <Heart className="h-6 w-6 text-muted-foreground/20 mx-auto mb-2" />
                <p className="text-[12px] text-muted-foreground/40">No saved listings yet</p>
                <Link href="/app/browse" className="text-[11px] text-accent font-semibold mt-1 inline-block hover:underline">
                  Browse listings
                </Link>
              </div>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory">
                {savedListings.map(listing => {
                  const sideLabel = listing.foot_side === 'L' ? 'L' : listing.foot_side === 'R' ? 'R' : '—';
                  return (
                    <div key={listing.id} className="flex-shrink-0 w-32 snap-start relative group">
                      <Link href={`/app/listing/${listing.id}`} className="block">
                        <div className="aspect-square rounded-xl overflow-hidden bg-muted relative mb-1.5">
                          {listing.photos[0] ? (
                            <img
                              src={listing.photos[0]}
                              alt={`${listing.shoe_brand} ${listing.shoe_model}`}
                              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-3xl opacity-20">👟</div>
                          )}
                          <div className="absolute bottom-1 left-1">
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                              listing.foot_side === 'L'
                                ? 'bg-left-shoe text-white'
                                : listing.foot_side === 'R'
                                ? 'bg-right-shoe text-white'
                                : 'bg-muted-foreground/60 text-white'
                            }`}>
                              {sideLabel}
                            </span>
                          </div>
                        </div>
                        <p className="text-[11px] font-semibold text-foreground truncate leading-tight">
                          {listing.shoe_brand}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">{listing.shoe_model}</p>
                        <p className="text-[11px] font-bold text-foreground mt-0.5">
                          {listing.price != null ? `$${listing.price}` : '$—'}
                        </p>
                      </Link>
                      {/* Unsave button */}
                      <button
                        onClick={() => unsaveListing(listing.id)}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-card/80 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Remove from saved"
                      >
                        <X className="h-2.5 w-2.5 text-muted-foreground" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>

        {/* Menu sections */}
        <motion.div {...fadeUp(0.1)} className="mt-4 px-5 space-y-3 pb-4">
          {/* Section 1 */}
          <div className="bg-white rounded-2xl border border-black/8 overflow-hidden">
            <MenuItem icon={<ShoppingBag className="h-[18px] w-[18px]" />} label={t.profile_my_listings} href="/app/listings" value={`${stats.listings}`} />
            <div className="border-t border-black/5 mx-5" />
            <MenuItem icon={<MessageCircle className="h-[18px] w-[18px]" />} label={t.profile_my_matches} href="/app/messages" value={`${stats.matches}`} />
          </div>

          {/* Section 2 */}
          <div className="bg-white rounded-2xl border border-black/8 overflow-hidden">
            <MenuItem icon={<Edit className="h-[18px] w-[18px]" />}       label={t.profile_edit_profile}  href="/app/profile/edit" />
            <div className="border-t border-black/5 mx-5" />
            <MenuItem icon={<Settings className="h-[18px] w-[18px]" />}   label={t.profile_settings}      href="/app/profile/edit" />
          </div>

          {/* Preferences */}
          <div className="bg-white rounded-2xl border border-black/8 overflow-hidden">
            <div className="flex items-center gap-4 px-5 py-4">
              <span className="text-black/30">
                {theme === 'dark' ? (
                  <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
                  </svg>
                ) : (
                  <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                  </svg>
                )}
              </span>
              <span className="flex-1 text-[14px] font-medium text-foreground">
                {theme === 'dark' ? t.profile_dark_mode : t.profile_light_mode}
              </span>
              <button
                type="button"
                onClick={toggleTheme}
                className={`w-11 h-6 rounded-full flex items-center px-0.5 transition-colors ${theme === 'dark' ? 'bg-foreground' : 'bg-black/15'}`}
              >
                <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${theme === 'dark' ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
            <div className="border-t border-black/5 mx-5" />
            <div className="flex items-center gap-4 px-5 py-4">
              <span className="text-black/30 text-base leading-none">🌐</span>
              <span className="flex-1 text-[14px] font-medium text-foreground">{t.profile_language}</span>
              <select
                value={locale}
                onChange={e => setLocale(e.target.value)}
                className="text-[13px] text-foreground bg-black/5 border border-black/8 rounded-xl px-2 py-1.5 outline-none transition-colors appearance-none cursor-pointer pr-6"
                style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23888\' stroke-width=\'2\'%3E%3Cpath d=\'M6 9l6 6 6-6\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 6px center' }}
              >
                <optgroup label="Americas">
                  {LOCALES.filter(l => l.group === 'US').map(l => (
                    <option key={l.code} value={l.code}>{l.flag} {l.label}</option>
                  ))}
                </optgroup>
                <optgroup label="UK & Oceania">
                  {LOCALES.filter(l => l.group === 'UK').map(l => (
                    <option key={l.code} value={l.code}>{l.flag} {l.label}</option>
                  ))}
                </optgroup>
                <optgroup label="Europe">
                  {LOCALES.filter(l => l.group === 'EU').map(l => (
                    <option key={l.code} value={l.code}>{l.flag} {l.label}</option>
                  ))}
                </optgroup>
              </select>
            </div>
          </div>

          {/* Section 3 */}
          <div className="bg-white rounded-2xl border border-black/8 overflow-hidden">
            <MenuItem icon={<HelpCircle className="h-[18px] w-[18px]" />} label={t.profile_help} />
            <div className="border-t border-black/5 mx-5" />
            <MenuItem
              icon={<LogOut className="h-[18px] w-[18px]" />}
              label={t.profile_logout}
              onClick={handleSignOut}
              destructive
            />
          </div>

          {/* Footer */}
          <div className="py-4 text-center">
            <p className="text-[10px] text-black/20 tracking-[0.15em] uppercase">
              Privacy Policy · Terms & Conditions
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

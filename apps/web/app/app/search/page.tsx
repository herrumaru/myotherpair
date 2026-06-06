'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { Search, X, Camera, ChevronRight } from 'lucide-react';
import { getCurrencySymbol } from '../../../lib/currency';

// ── Category tiles ────────────────────────────────────────────────────────────

const CATEGORIES = [
  { label: 'Left foot',     emoji: '🦶',  href: '/app/browse?side=L',                     bg: 'bg-blue-950'    },
  { label: 'Right foot',    emoji: '👟',  href: '/app/browse?side=R',                     bg: 'bg-emerald-950' },
  { label: 'Nike',          emoji: '✔︎',  href: '/app/browse?brand=Nike',                 bg: 'bg-zinc-800'    },
  { label: 'Adidas',        emoji: '⚡',  href: '/app/browse?brand=Adidas',               bg: 'bg-zinc-800'    },
  { label: 'New with tags', emoji: '✨',  href: '/app/browse?condition=new_with_tags',    bg: 'bg-amber-950'   },
  { label: 'Open to swap',  emoji: '🔄',  href: '/app/browse?swap=true',                  bg: 'bg-teal-950'    },
  { label: 'Jordan',        emoji: '🏀',  href: '/app/browse?brand=Jordan',               bg: 'bg-red-950'     },
  { label: 'New Balance',   emoji: '🏃',  href: '/app/browse?brand=New%20Balance',        bg: 'bg-indigo-950'  },
];

// ── Types ─────────────────────────────────────────────────────────────────────

interface UserResult {
  id: string;
  name: string;
  username: string | null;
  avatar_url: string | null;
  location: string | null;
}

interface ListingResult {
  id: string;
  shoe_brand: string;
  shoe_model: string;
  price: number | null;
  currency: string;
  photos: string[];
  foot_side: string;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SearchPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query,    setQuery]    = useState('');
  const [users,    setUsers]    = useState<UserResult[]>([]);
  const [listings, setListings] = useState<ListingResult[]>([]);
  const [loading,  setLoading]  = useState(false);

  // Auto-focus search bar
  useEffect(() => { inputRef.current?.focus(); }, []);

  // Live search
  useEffect(() => {
    const q = query.trim();
    if (!q) { setUsers([]); setListings([]); return; }

    const timeout = setTimeout(async () => {
      setLoading(true);
      const pattern = `%${q}%`;

      const [usersRes, listingsRes] = await Promise.all([
        supabase
          .from('users')
          .select('id, name, username, avatar_url, location')
          .or(`name.ilike.${pattern},username.ilike.${pattern}`)
          .limit(6),
        supabase
          .from('listings')
          .select('id, shoe_brand, shoe_model, price, currency, photos, foot_side')
          .or(`shoe_brand.ilike.${pattern},shoe_model.ilike.${pattern}`)
          .eq('status', 'active')
          .limit(12),
      ]);

      setUsers((usersRes.data ?? []) as UserResult[]);
      setListings((listingsRes.data ?? []) as ListingResult[]);
      setLoading(false);
    }, 280);

    return () => clearTimeout(timeout);
  }, [query]);

  const hasResults = users.length > 0 || listings.length > 0;

  return (
    <div className="min-h-screen bg-background pb-24">

      {/* ── Search bar ──────────────────────────────────────────── */}
      <div className="sticky top-0 z-40 bg-background px-4 pt-12 pb-3 border-b border-black/[0.06]">
        <div className="relative flex items-center gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-black/30 pointer-events-none" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search shoes or members…"
              className="w-full pl-10 pr-10 h-11 bg-black/[0.05] rounded-2xl text-[15px] text-foreground placeholder:text-black/30 outline-none border border-transparent focus:border-black/10 transition-colors"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-black/25 hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <button className="w-11 h-11 rounded-2xl bg-black/[0.05] flex items-center justify-center flex-shrink-0">
            <Camera className="h-4.5 w-4.5 text-black/40" />
          </button>
        </div>
      </div>

      {/* ── No query → categories ───────────────────────────────── */}
      {!query && (
        <div className="px-4 pt-5">
          <p className="text-[11px] font-semibold text-black/35 uppercase tracking-wider mb-3">Browse by category</p>
          <div className="grid grid-cols-2 gap-2.5">
            {CATEGORIES.map(cat => (
              <Link
                key={cat.label}
                href={cat.href}
                className={`${cat.bg} rounded-2xl p-4 flex items-end justify-between aspect-[5/3] active:scale-[0.97] transition-transform`}
              >
                <span className="text-[15px] font-bold text-white leading-tight">{cat.label}</span>
                <span className="text-3xl">{cat.emoji}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Query → results ─────────────────────────────────────── */}
      {query.trim() && (
        <div className="px-4 pt-4 space-y-6">

          {loading && (
            <div className="flex justify-center pt-10">
              <div className="flex gap-1.5">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-2 h-2 rounded-full bg-black/20 animate-bounce" style={{ animationDelay: `${i * 0.12}s` }} />
                ))}
              </div>
            </div>
          )}

          {!loading && !hasResults && (
            <div className="text-center pt-16">
              <p className="text-[17px] font-semibold text-foreground mb-1">No results</p>
              <p className="text-[14px] text-black/40">Try a different search term</p>
            </div>
          )}

          {/* Members */}
          {users.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-black/35 uppercase tracking-wider mb-3">Members</p>
              <div className="bg-white rounded-2xl border border-black/8 overflow-hidden">
                {users.map((u, i) => (
                  <Link
                    key={u.id}
                    href={`/app/profile/${u.id}`}
                    className={`flex items-center gap-3 px-4 py-3 active:bg-black/[0.03] transition-colors ${i < users.length - 1 ? 'border-b border-black/5' : ''}`}
                  >
                    {u.avatar_url ? (
                      <img src={u.avatar_url} alt={u.name} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-[#f05d23]/15 flex items-center justify-center text-sm font-bold text-[#f05d23] flex-shrink-0">
                        {u.name?.[0]?.toUpperCase() ?? '?'}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-foreground leading-tight">{u.name}</p>
                      {u.username && (
                        <p className="text-[12px] text-black/40">@{u.username}</p>
                      )}
                      {u.location && (
                        <p className="text-[11px] text-black/30 mt-0.5">{u.location}</p>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-black/20 flex-shrink-0" />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Listings */}
          {listings.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-black/35 uppercase tracking-wider mb-3">Listings</p>
              <div className="grid grid-cols-2 gap-3">
                {listings.map(l => {
                  const sym       = getCurrencySymbol(l.currency || 'USD');
                  const sideLabel = l.foot_side === 'L' ? 'Left' : l.foot_side === 'R' ? 'Right' : '';
                  return (
                    <Link key={l.id} href={`/app/listing/${l.id}`} className="block rounded-2xl overflow-hidden bg-white border border-black/8 active:scale-[0.98] transition-transform">
                      <div className="aspect-square bg-muted overflow-hidden relative">
                        {l.photos[0] ? (
                          <img src={l.photos[0]} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-4xl opacity-20">👟</div>
                        )}
                        {sideLabel && (
                          <span className="absolute top-2 left-2 text-[9px] font-bold px-2 py-0.5 rounded-full bg-black/50 text-white">
                            {sideLabel}
                          </span>
                        )}
                      </div>
                      <div className="p-2.5">
                        <p className="text-[13px] font-semibold text-foreground leading-tight truncate">{l.shoe_brand} {l.shoe_model}</p>
                        <p className="text-[13px] font-bold text-foreground mt-0.5">
                          {l.price != null ? `${sym}${l.price}` : '—'}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>

              {listings.length === 12 && (
                <button
                  onClick={() => router.push(`/app/browse?q=${encodeURIComponent(query)}`)}
                  className="w-full mt-3 h-11 rounded-2xl border-2 border-black/10 text-[13px] font-semibold text-foreground flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all"
                >
                  See all results <ChevronRight className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

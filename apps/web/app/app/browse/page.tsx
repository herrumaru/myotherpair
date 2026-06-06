'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { SlidersHorizontal, X, Search, Heart } from 'lucide-react';
import {
  type SizeSystem,
  getSizes,
  toUKCanonical,
  formatSizeLabel,
  getEquivalents,
  detectSizeSystem,
} from '../../../lib/sizeConversion';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Listing {
  id: string;
  shoe_brand: string;
  shoe_model: string;
  size: number;           // stored as UK canonical
  foot_side: string;
  condition: string;
  price: number | null;
  photos: string[];
  swap_available: boolean;
  location: string | null;
}

interface Filters {
  size: string;           // value in current sizeSystem ('all' | size string)
  side: string;
  condition: string;
  brand: string;
  maxPrice: number;
  swapOnly: boolean;
  location: string;
}

const DEFAULT_FILTERS: Filters = {
  size: 'all', side: 'all', condition: 'all', brand: 'all', maxPrice: 500, swapOnly: false, location: '',
};

const CONDITIONS = ['new_with_tags','new_without_tags','excellent','good','fair','poor'];
const CONDITION_LABELS: Record<string, string> = {
  new_with_tags: 'New (tags)', new_without_tags: 'New', excellent: 'Excellent',
  good: 'Good', fair: 'Fair', poor: 'Poor',
};

const selectCls = 'w-full h-9 rounded-lg bg-secondary border border-border/30 text-sm text-foreground px-2 outline-none focus:border-accent/40 transition-colors appearance-none';

// ─── Listing card ──────────────────────────────────────────────────────────────

function ListingCard({
  listing,
  saved,
  onToggleSave,
  sizeSystem,
}: {
  listing: Listing;
  saved: boolean;
  onToggleSave: (id: string) => void;
  sizeSystem: SizeSystem;
}) {
  const sideVariant = listing.foot_side === 'L' ? 'left' as const : listing.foot_side === 'R' ? 'right' as const : 'default' as const;
  const sideLabel   = listing.foot_side === 'L' ? 'Left' : listing.foot_side === 'R' ? 'Right' : 'Either';

  // Show size in user's preferred system using getEquivalents
  const ukStr = String(listing.size);
  const eq = getEquivalents(ukStr, 'UK');
  let primarySize = `UK ${listing.size}`;
  if (eq) {
    const key = sizeSystem.toLowerCase() as 'uk' | 'us' | 'eu';
    primarySize = `${sizeSystem} ${eq[key]}`;
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-card shadow-card hover-lift border border-border/30 group">
      <Link href={`/app/listing/${listing.id}`} className="block">
        <div className="aspect-square overflow-hidden bg-muted relative">
          {listing.photos[0] ? (
            <img
              src={listing.photos[0]}
              alt={`${listing.shoe_brand} ${listing.shoe_model}`}
              className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-5xl opacity-20">👟</div>
          )}
          {/* Gradient hover */}
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          {/* Side badge */}
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            <Badge variant={sideVariant} className="shadow-sm backdrop-blur-sm text-[10px]">
              {sideLabel}
            </Badge>
            {listing.swap_available && (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-teal-500/90 text-white backdrop-blur-sm shadow-sm">
                🔄 Swap
              </span>
            )}
          </div>
        </div>
        <div className="p-3 space-y-0.5">
          <p className="font-semibold text-sm text-foreground leading-tight truncate">
            {listing.shoe_brand} {listing.shoe_model}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {primarySize} · {CONDITION_LABELS[listing.condition] ?? listing.condition}
          </p>
          <p className="font-bold text-base text-foreground pt-0.5">
            {listing.price != null ? `$${listing.price}` : '$—'}
          </p>
        </div>
      </Link>

      {/* Save button */}
      <div className="px-3 pb-3">
        <button
          onClick={() => onToggleSave(listing.id)}
          className={`w-full flex items-center justify-center gap-1.5 text-[11px] font-medium border rounded-lg py-1.5 transition-colors ${
            saved
              ? 'bg-accent/10 text-accent border-accent/30'
              : 'border-border/30 text-muted-foreground hover:text-foreground hover:bg-secondary/30'
          }`}
        >
          <Heart className={`h-3 w-3 ${saved ? 'fill-accent text-accent' : ''}`} />
          {saved ? 'Saved' : 'Save'}
        </button>
      </div>
    </div>
  );
}

// ─── Filters panel ─────────────────────────────────────────────────────────────

function FiltersPanel({
  filters,
  onChange,
  onClose,
  brands,
  sizeSystem,
  onSizeSystemChange,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  onClose: () => void;
  brands: string[];
  sizeSystem: SizeSystem;
  onSizeSystemChange: (s: SizeSystem) => void;
}) {
  const sizes = getSizes(sizeSystem);

  return (
    <div className="p-4 rounded-2xl bg-card border border-border/30 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm text-foreground">Filters</h3>
        <button
          onClick={() => onChange({ ...DEFAULT_FILTERS })}
          className="text-xs text-accent font-semibold"
        >
          Reset all
        </button>
      </div>

      {/* Size system toggle */}
      <div>
        <label className="text-[11px] text-muted-foreground font-medium mb-1.5 block">
          Size system
        </label>
        <div className="flex gap-1.5">
          {(['UK', 'US', 'EU'] as SizeSystem[]).map(sys => (
            <button
              key={sys}
              type="button"
              onClick={() => {
                onSizeSystemChange(sys);
                onChange({ ...filters, size: 'all' }); // reset size filter when system changes
              }}
              className={`flex-1 h-8 rounded-lg text-xs font-semibold border transition-all duration-200 ${
                sizeSystem === sys
                  ? 'bg-accent text-accent-foreground border-accent shadow-sm'
                  : 'bg-muted/50 text-muted-foreground border-border/30 hover:border-border'
              }`}
            >
              {sys}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Size */}
        <div>
          <label className="text-[11px] text-muted-foreground font-medium mb-1 block">
            Size ({sizeSystem})
          </label>
          <select
            value={filters.size}
            onChange={e => onChange({ ...filters, size: e.target.value })}
            className={selectCls}
          >
            <option value="all">All sizes</option>
            {sizes.map(s => (
              <option key={s} value={s}>
                {formatSizeLabel(s, sizeSystem)}
              </option>
            ))}
          </select>
        </div>

        {/* Side */}
        <div>
          <label className="text-[11px] text-muted-foreground font-medium mb-1 block">Side</label>
          <select
            value={filters.side}
            onChange={e => onChange({ ...filters, side: e.target.value })}
            className={selectCls}
          >
            <option value="all">All</option>
            <option value="L">Left</option>
            <option value="R">Right</option>
            <option value="single">Either</option>
          </select>
        </div>

        {/* Condition */}
        <div>
          <label className="text-[11px] text-muted-foreground font-medium mb-1 block">Condition</label>
          <select
            value={filters.condition}
            onChange={e => onChange({ ...filters, condition: e.target.value })}
            className={selectCls}
          >
            <option value="all">All</option>
            {CONDITIONS.map(c => (
              <option key={c} value={c}>{CONDITION_LABELS[c]}</option>
            ))}
          </select>
        </div>

        {/* Brand */}
        <div>
          <label className="text-[11px] text-muted-foreground font-medium mb-1 block">Brand</label>
          <select
            value={filters.brand}
            onChange={e => onChange({ ...filters, brand: e.target.value })}
            className={selectCls}
          >
            <option value="all">All brands</option>
            {brands.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>

        {/* Max price — spans full width */}
        <div className="col-span-2">
          <label className="text-[11px] text-muted-foreground font-medium mb-1 block">
            Max price: <span className="text-foreground font-semibold">${filters.maxPrice}</span>
          </label>
          <input
            type="range"
            min={0} max={500} step={10}
            value={filters.maxPrice}
            onChange={e => onChange({ ...filters, maxPrice: Number(e.target.value) })}
            className="w-full accent-accent h-1.5"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground/50 mt-1">
            <span>$0</span><span>$500</span>
          </div>
        </div>
      </div>

      {/* Location */}
      <div>
        <label className="text-[11px] text-muted-foreground font-medium mb-1 block">Location</label>
        <input
          type="text"
          value={filters.location}
          onChange={e => onChange({ ...filters, location: e.target.value })}
          placeholder="City or country…"
          className="w-full h-9 rounded-lg bg-secondary border border-border/30 text-sm text-foreground px-2 outline-none focus:border-accent/40 transition-colors placeholder:text-muted-foreground/50"
        />
      </div>

      {/* Swap only toggle */}
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-foreground">Open to swap only</span>
        <button
          type="button"
          onClick={() => onChange({ ...filters, swapOnly: !filters.swapOnly })}
          className={`w-11 h-6 rounded-full transition-colors relative ${filters.swapOnly ? 'bg-teal-500' : 'bg-muted-foreground/25'}`}
        >
          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-background shadow transition-all ${filters.swapOnly ? 'left-5' : 'left-0.5'}`} />
        </button>
      </div>

      <Button variant="accent" className="w-full rounded-xl" onClick={onClose}>
        Apply filters
      </Button>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function BrowsePage() {
  const [userId,      setUserId]      = useState<string | null>(null);
  const [listings,    setListings]    = useState<Listing[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sizeSystem,  setSizeSystem]  = useState<SizeSystem>('UK');
  const [saved,       setSaved]       = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<Filters>({ ...DEFAULT_FILTERS });

  // Get current user
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setUserId(session.user.id);
    });
  }, []);

  // Detect locale size system on mount + read URL params from search page categories
  useEffect(() => {
    setSizeSystem(detectSizeSystem());
    const params = new URLSearchParams(window.location.search);
    const updates: Partial<Filters> = {};
    const side      = params.get('side');
    const brand     = params.get('brand');
    const condition = params.get('condition');
    const swap      = params.get('swap');
    const q         = params.get('q');
    const loc       = params.get('location');
    if (side)      updates.side      = side;
    if (brand)     updates.brand     = brand;
    if (condition) updates.condition = condition;
    if (swap)      updates.swapOnly  = swap === 'true';
    if (loc)       updates.location  = loc;
    if (q)         setSearchQuery(q);
    if (Object.keys(updates).length) setFilters(prev => ({ ...prev, ...updates }));
  }, []);

  // Load saved listing IDs from Supabase
  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data } = await supabase
        .from('saved_listings')
        .select('listing_id')
        .eq('user_id', userId);
      if (data) {
        setSaved(new Set((data as { listing_id: string }[]).map(r => r.listing_id)));
      }
    })();
  }, [userId]);

  // Fetch listings from Supabase
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('listings')
        .select('id, shoe_brand, shoe_model, size, foot_side, condition, price, photos, swap_available, users!user_id(location)')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(80);

      if (error) { console.error(error); }

      setListings(
        (data ?? []).map((r: Record<string, unknown>) => ({
          id:         r.id         as string,
          shoe_brand: r.shoe_brand as string,
          shoe_model: r.shoe_model as string,
          size:       r.size       as number,
          foot_side:  r.foot_side  as string,
          condition:  r.condition  as string,
          price:          r.price          as number | null,
          photos:         Array.isArray(r.photos) ? (r.photos as string[]) : [],
          swap_available: !!(r.swap_available),
          location:   (r.users as { location?: string } | null)?.location ?? null,
        })),
      );
      setLoading(false);
    })();
  }, []);

  // Toggle save — insert or delete from Supabase
  const toggleSave = async (id: string) => {
    if (!userId) return;
    const isSaved = saved.has(id);
    // Optimistic UI update
    setSaved(prev => {
      const next = new Set(prev);
      isSaved ? next.delete(id) : next.add(id);
      return next;
    });
    if (isSaved) {
      await supabase.from('saved_listings').delete().eq('user_id', userId).eq('listing_id', id);
    } else {
      await supabase.from('saved_listings').insert({ user_id: userId, listing_id: id });
    }
  };

  // Dynamic brand list from loaded listings
  const brands = useMemo(() =>
    [...new Set(listings.map(l => l.shoe_brand))].sort(),
  [listings]);

  // Apply filters + search
  const filtered = useMemo(() => {
    return listings.filter(l => {
      // Text search
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!l.shoe_brand.toLowerCase().includes(q) && !l.shoe_model.toLowerCase().includes(q)) return false;
      }
      // Side
      if (filters.side !== 'all' && l.foot_side !== filters.side) return false;
      // Condition
      if (filters.condition !== 'all' && l.condition !== filters.condition) return false;
      // Brand
      if (filters.brand !== 'all' && l.shoe_brand !== filters.brand) return false;
      // Price
      if (l.price != null && l.price > filters.maxPrice) return false;
      // Size — convert selected size back to UK canonical to compare
      if (filters.size !== 'all') {
        const targetUK = toUKCanonical(filters.size, sizeSystem);
        if (l.size !== targetUK) return false;
      }
      // Swap only
      if (filters.swapOnly && !l.swap_available) return false;
      // Location
      if (filters.location) {
        if (!l.location?.toLowerCase().includes(filters.location.toLowerCase())) return false;
      }
      return true;
    });
  }, [listings, filters, searchQuery, sizeSystem]);

  const activeFilterCount =
    [filters.size, filters.side, filters.condition, filters.brand].filter(f => f !== 'all').length +
    (filters.maxPrice < 500 ? 1 : 0) +
    (filters.swapOnly ? 1 : 0) +
    (filters.location ? 1 : 0);

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Sticky header + search */}
      <header className="sticky top-0 z-40 bg-background px-4 pb-3">
        <div className="flex items-end justify-between max-w-lg mx-auto pt-5 pb-1">
          <h1 className="text-[28px] font-bold text-foreground leading-none tracking-[-0.02em]">Browse</h1>
          <button
            onClick={() => setShowFilters(v => !v)}
            className={`relative flex items-center gap-1.5 h-9 px-4 rounded-full text-[13px] font-semibold border-2 transition-all ${
              showFilters
                ? 'bg-foreground text-background border-foreground'
                : 'bg-transparent text-foreground border-border hover:border-border/80'
            }`}
          >
            {showFilters ? <X className="h-3.5 w-3.5" /> : <SlidersHorizontal className="h-3.5 w-3.5" />}
            Filters
            {activeFilterCount > 0 && !showFilters && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-foreground text-background text-[10px] font-bold flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
        <div className="relative max-w-lg mx-auto">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search brand or model…"
            className="w-full pl-10 pr-4 h-10 bg-card border border-border rounded-2xl text-[14px] text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-border/80 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-4">
        {/* Filters panel */}
        {showFilters && (
          <div className="mb-4 animate-fade-in">
            <FiltersPanel
              filters={filters}
              onChange={setFilters}
              onClose={() => setShowFilters(false)}
              brands={brands}
              sizeSystem={sizeSystem}
              onSizeSystemChange={setSizeSystem}
            />
          </div>
        )}

        {/* Result count */}
        <p className="text-xs text-muted-foreground mb-4 font-medium">
          {loading
            ? 'Loading listings…'
            : `${filtered.length} listing${filtered.length !== 1 ? 's' : ''} available`}
        </p>

        {/* Skeleton */}
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {[0, 1, 2, 3, 4, 5].map(i => (
              <div key={i} className="rounded-2xl overflow-hidden bg-card border border-border/20">
                <div className="aspect-square bg-muted animate-pulse" />
                <div className="p-3 space-y-2">
                  <div className="h-3 w-3/4 rounded bg-muted animate-pulse" />
                  <div className="h-2.5 w-1/2 rounded bg-muted animate-pulse" />
                  <div className="h-4 w-1/3 rounded bg-muted animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((listing, i) => (
              <div
                key={listing.id}
                className={`opacity-0 animate-fade-in stagger-${Math.min(i + 1, 6)}`}
              >
                <ListingCard
                  listing={listing}
                  saved={saved.has(listing.id)}
                  onToggleSave={toggleSave}
                  sizeSystem={sizeSystem}
                />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <div className="text-center py-20 animate-fade-in">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <Search className="h-7 w-7 text-muted-foreground/40" />
            </div>
            <p className="text-foreground font-semibold mb-1">No listings found</p>
            <p className="text-sm text-muted-foreground mb-4">Try adjusting your search or filters</p>
            <Button
              variant="accent"
              className="rounded-full"
              onClick={() => { setFilters({ ...DEFAULT_FILTERS }); setSearchQuery(''); }}
            >
              Clear all
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

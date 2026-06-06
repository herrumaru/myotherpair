'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '../../../../lib/supabase';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import {
  ArrowLeft, MapPin, MessageCircle, ShoppingCart,
  Loader2, Heart, Share2, Flag, ShieldCheck, Tag, X,
} from 'lucide-react';
import { getEquivalents } from '../../../../lib/sizeConversion';
import { getCurrencySymbol } from '../../../../lib/currency';

interface Listing {
  id: string;
  shoe_brand: string;
  shoe_model: string;
  size: number;
  foot_side: string;
  condition: string;
  price: number | null;
  currency: string;
  description: string | null;
  photos: string[];
  user_id: string;
  status: string;
  created_at: string;
}

interface Seller {
  id: string;
  name: string;
  location: string;
  avatar_url: string | null;
  created_at: string;
  listing_count: number;
}

const CONDITION_LABELS: Record<string, string> = {
  new_with_tags: 'New with tags', new_without_tags: 'New', excellent: 'Excellent',
  good: 'Good', fair: 'Fair', poor: 'Poor',
};

const CONDITION_COLORS: Record<string, string> = {
  new_with_tags:    'bg-emerald-50 text-emerald-700 border-emerald-200',
  new_without_tags: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  excellent:        'bg-blue-50 text-blue-700 border-blue-200',
  good:             'bg-blue-50 text-blue-700 border-blue-200',
  fair:             'bg-amber-50 text-amber-700 border-amber-200',
  poor:             'bg-red-50 text-red-700 border-red-200',
};

function timeAgo(dateStr: string): string {
  const diff  = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs   = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days  = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function memberSince(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

export default function ListingDetailPage() {
  const router    = useRouter();
  const params    = useParams<{ id: string }>();
  const listingId = params.id;

  // ── All hooks at top (React rules) ───────────────────────────────────────
  const [userId,       setUserId]       = useState<string | null>(null);
  const [listing,      setListing]      = useState<Listing | null>(null);
  const [seller,       setSeller]       = useState<Seller | null>(null);
  const [matchId,      setMatchId]      = useState<string | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [notFound,     setNotFound]     = useState(false);
  const [contacting,   setContacting]   = useState(false);
  const [buyingNow,    setBuyingNow]    = useState(false);
  const [contactError, setContactError] = useState('');
  const [saved,        setSaved]        = useState(false);
  const [savingHeart,  setSavingHeart]  = useState(false);
  const [photoIndex,   setPhotoIndex]   = useState(0);
  const [offerOpen,    setOfferOpen]    = useState(false);
  const [offerPrice,   setOfferPrice]   = useState('');
  const [offerSending, setOfferSending] = useState(false);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setUserId(session.user.id);
    });
  }, []);

  useEffect(() => {
    if (!listingId) return;
    (async () => {
      const { data, error } = await supabase
        .from('listings')
        .select('id, shoe_brand, shoe_model, size, foot_side, condition, price, currency, description, photos, user_id, status, created_at')
        .eq('id', listingId)
        .single();

      if (error || !data) { setNotFound(true); setLoading(false); return; }

      const d = data as Record<string, unknown>;
      const listingData: Listing = {
        id:          d.id          as string,
        shoe_brand:  d.shoe_brand  as string,
        shoe_model:  d.shoe_model  as string,
        size:        d.size        as number,
        foot_side:   d.foot_side   as string,
        condition:   d.condition   as string,
        price:       d.price       as number | null,
        currency:    (d.currency   as string) || 'USD',
        description: d.description as string | null,
        photos:      Array.isArray(d.photos) ? (d.photos as string[]) : [],
        user_id:     d.user_id     as string,
        status:      d.status      as string,
        created_at:  d.created_at  as string,
      };
      setListing(listingData);

      // Pre-fill offer with 10% below asking
      if (listingData.price != null) {
        setOfferPrice(String(Math.floor(listingData.price * 0.9)));
      }

      const [profileRes, countRes] = await Promise.all([
        supabase.from('users').select('id, name, location, avatar_url, created_at').eq('id', d.user_id as string).single(),
        supabase.from('listings').select('id', { count: 'exact', head: true }).eq('user_id', d.user_id as string).eq('status', 'active'),
      ]);

      if (profileRes.data) {
        const s = profileRes.data as Record<string, unknown>;
        setSeller({
          id:            s.id          as string,
          name:          (s.name as string) || 'User',
          location:      (s.location   as string) || '',
          avatar_url:    s.avatar_url  as string | null,
          created_at:    s.created_at  as string,
          listing_count: countRes.count ?? 0,
        });
      }
      setLoading(false);
    })();
  }, [listingId]);

  useEffect(() => {
    if (!userId || !listingId) return;
    supabase.from('saved_listings').select('id').eq('user_id', userId).eq('listing_id', listingId).maybeSingle()
      .then(({ data }) => { if (data) setSaved(true); });
  }, [userId, listingId]);

  useEffect(() => {
    if (!userId || !listing) return;
    supabase.from('matches').select('id')
      .or(`and(user_id_1.eq.${userId},user_id_2.eq.${listing.user_id}),and(user_id_1.eq.${listing.user_id},user_id_2.eq.${userId})`)
      .limit(1).maybeSingle()
      .then(({ data }) => { if (data) setMatchId((data as { id: string }).id); });
  }, [userId, listing]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!userId || !listingId || savingHeart) return;
    setSavingHeart(true);
    if (saved) {
      await supabase.from('saved_listings').delete().eq('user_id', userId).eq('listing_id', listingId);
      setSaved(false);
    } else {
      await supabase.from('saved_listings').insert({ user_id: userId, listing_id: listingId });
      setSaved(true);
    }
    setSavingHeart(false);
  };

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({ title: listing ? `${listing.shoe_brand} ${listing.shoe_model}` : 'Listing', url: window.location.href });
    } else {
      await navigator.clipboard.writeText(window.location.href);
      alert('Link copied!');
    }
  };

  /** Create (or reuse) a match and return its ID */
  const ensureMatch = async (): Promise<string | null> => {
    if (matchId) return matchId;
    if (!userId || !seller) return null;
    const { data, error } = await supabase.from('matches').insert({
      listing_id_1: null, listing_id_2: listingId,
      user_id_1: userId, user_id_2: seller.id, status: 'pending',
    }).select('id').single();
    if (error || !data) return null;
    const id = (data as { id: string }).id;
    setMatchId(id);
    return id;
  };

  const handleContact = async () => {
    if (!userId || !listing || !seller) return;
    if (matchId) { router.push(`/app/messages/${matchId}`); return; }
    setContacting(true);
    setContactError('');
    try {
      const id = await ensureMatch();
      if (!id) throw new Error('Could not start conversation');
      fetch('/api/notifications/email', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'new_contact', toUserId: seller.id, listingId }),
      }).catch(() => {});
      router.push(`/app/messages/${id}`);
    } catch {
      setContactError('Could not start conversation. Please try again.');
      setContacting(false);
    }
  };

  const handleBuyNow = async () => {
    if (!userId || !listing) return;
    setBuyingNow(true);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId, buyerId: userId }),
      });
      const json = await res.json() as { url?: string; error?: string };
      if (json.url) { window.location.href = json.url; }
      else { alert(json.error ?? 'Payment unavailable right now.'); setBuyingNow(false); }
    } catch {
      alert('Payment unavailable right now.');
      setBuyingNow(false);
    }
  };

  const handleSendOffer = async () => {
    if (!userId || !listing || !seller || !offerPrice || parseFloat(offerPrice) <= 0) return;
    setOfferSending(true);
    try {
      const id = await ensureMatch();
      if (!id) throw new Error('No match');
      const sym     = getCurrencySymbol(listing.currency || 'USD');
      const content = `Hi! I'd like to offer ${sym}${offerPrice} for your ${listing.shoe_brand} ${listing.shoe_model}. Would you accept that?`;
      const { error } = await supabase.from('messages').insert({
        match_id:  id,
        sender_id: userId,
        content,
      });
      if (error) throw error;
      setOfferOpen(false);
      router.push(`/app/messages/${id}`);
    } catch {
      setOfferSending(false);
    }
  };

  // ── Loading / Not found ───────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="aspect-[4/3] bg-muted animate-pulse" />
        <div className="max-w-lg mx-auto px-4 py-5 space-y-4">
          <div className="h-8 w-3/4 rounded-xl bg-muted animate-pulse" />
          <div className="h-4 w-1/2 rounded-lg bg-muted animate-pulse" />
          <div className="h-24 rounded-2xl bg-muted animate-pulse" />
        </div>
      </div>
    );
  }

  if (notFound || !listing) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center px-5">
          <p className="text-lg font-semibold text-foreground mb-2">Listing not found</p>
          <p className="text-sm text-muted-foreground mb-6">It may have been removed or sold.</p>
          <Button variant="outline" onClick={() => router.back()}>Go back</Button>
        </div>
      </div>
    );
  }

  const sym         = getCurrencySymbol(listing.currency || 'USD');
  const isOwner     = listing.user_id === userId;
  const isSold      = listing.status === 'sold';
  const sideLabel   = listing.foot_side === 'L' ? 'Left' : listing.foot_side === 'R' ? 'Right' : 'Either';
  const sideVariant = listing.foot_side === 'L' ? 'left' as const : listing.foot_side === 'R' ? 'right' as const : 'default' as const;
  const photos      = listing.photos.length > 0 ? listing.photos : [];
  const sizeEq      = getEquivalents(String(listing.size), 'UK');

  return (
    <div className="min-h-screen bg-background pb-36">

      {/* ── Photo carousel ──────────────────────────────────────────── */}
      <div className="relative bg-muted">
        <div
          className="aspect-[4/3] overflow-hidden select-none"
          onTouchStart={e => { touchStartX.current = e.touches[0].clientX; }}
          onTouchEnd={e => {
            if (touchStartX.current === null) return;
            const dx = e.changedTouches[0].clientX - touchStartX.current;
            if (dx < -40) setPhotoIndex(i => Math.min(photos.length - 1, i + 1));
            else if (dx > 40) setPhotoIndex(i => Math.max(0, i - 1));
            touchStartX.current = null;
          }}
        >
          {photos[photoIndex] ? (
            <img src={photos[photoIndex]} alt={`${listing.shoe_brand} ${listing.shoe_model}`} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-8xl opacity-20">👟</div>
          )}
        </div>

        <button onClick={() => router.back()} className="absolute top-4 left-4 h-10 w-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center">
          <ArrowLeft className="h-4 w-4 text-white" />
        </button>
        <button onClick={handleShare} className="absolute top-4 right-4 h-10 w-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center">
          <Share2 className="h-4 w-4 text-white" />
        </button>

        {isSold && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="text-white font-bold text-2xl tracking-widest uppercase">Sold</span>
          </div>
        )}

        {photos.length > 1 && (
          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
            {photos.map((_, i) => (
              <button key={i} onClick={() => setPhotoIndex(i)}
                className={`rounded-full transition-all duration-200 ${i === photoIndex ? 'w-5 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/50'}`} />
            ))}
          </div>
        )}
      </div>

      {/* ── Thumbnail strip ─────────────────────────────────────────── */}
      {photos.length > 1 && (
        <div className="flex gap-2 px-4 pt-3 overflow-x-auto scrollbar-hide">
          {photos.map((src, i) => (
            <button key={i} onClick={() => setPhotoIndex(i)}
              className={`flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${i === photoIndex ? 'border-foreground' : 'border-transparent opacity-50'}`}>
              <img src={src} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      <div className="max-w-lg mx-auto px-4 pt-4 space-y-4">

        {/* ── Price + Save ─────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[32px] font-bold text-foreground leading-none">
              {listing.price != null ? `${sym}${listing.price}` : 'Price on request'}
            </p>
            {listing.price != null && (
              <p className="text-[12px] text-muted-foreground mt-1">{listing.currency} · Listed {timeAgo(listing.created_at)}</p>
            )}
          </div>
          {!isOwner && (
            <button
              onClick={handleSave}
              disabled={savingHeart}
              className={`flex-shrink-0 w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all active:scale-95 ${
                saved ? 'border-red-400 bg-red-50' : 'border-black/10 bg-white'
              }`}
            >
              <Heart className={`h-5 w-5 transition-all ${saved ? 'fill-red-500 text-red-500' : 'text-black/30'}`} />
            </button>
          )}
        </div>

        {/* ── Title ────────────────────────────────────────────────── */}
        <div>
          <h1 className="text-[22px] font-bold text-foreground leading-tight">
            {listing.shoe_brand} {listing.shoe_model}
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className={`text-[12px] font-semibold px-3 py-1 rounded-full border ${CONDITION_COLORS[listing.condition] ?? 'bg-muted text-foreground border-border'}`}>
              {CONDITION_LABELS[listing.condition] ?? listing.condition}
            </span>
            <Badge variant={sideVariant} className="text-[12px] px-3 py-1">
              {sideLabel} foot
            </Badge>
          </div>
        </div>

        {/* ── Size chips ───────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-black/8 p-4">
          <p className="text-[11px] text-black/35 font-semibold uppercase tracking-wider mb-3">Shoe size</p>
          <div className="flex gap-3">
            {[
              { label: 'UK', value: sizeEq?.uk ?? String(listing.size) },
              { label: 'US', value: sizeEq?.us ?? String(listing.size) },
              { label: 'EU', value: sizeEq?.eu ?? String(listing.size) },
            ].map(({ label, value }) => (
              <div key={label} className="flex-1 text-center bg-background rounded-xl py-3 border border-black/6">
                <p className="text-[11px] text-black/35 font-medium mb-0.5">{label}</p>
                <p className="text-[18px] font-bold text-foreground">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Seller card ──────────────────────────────────────────── */}
        {seller && (
          <div className="bg-white rounded-2xl border border-black/8 p-4">
            <p className="text-[11px] text-black/35 font-semibold uppercase tracking-wider mb-3">Seller</p>
            <div className="flex items-center gap-3">
              {seller.avatar_url ? (
                <img src={seller.avatar_url} alt={seller.name} className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-accent/15 flex items-center justify-center text-base font-bold text-accent flex-shrink-0">
                  {seller.name[0]?.toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[15px] text-foreground">{seller.name}</p>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                  {seller.location && (
                    <p className="text-[12px] text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" />{seller.location}
                    </p>
                  )}
                  {seller.created_at && (
                    <p className="text-[12px] text-muted-foreground">Member since {memberSince(seller.created_at)}</p>
                  )}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-[18px] font-bold text-foreground">{seller.listing_count}</p>
                <p className="text-[11px] text-muted-foreground">listings</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Description ──────────────────────────────────────────── */}
        {listing.description && (
          <div className="bg-white rounded-2xl border border-black/8 p-4">
            <p className="text-[11px] text-black/35 font-semibold uppercase tracking-wider mb-2">Description</p>
            <p className="text-[14px] text-foreground leading-relaxed">{listing.description}</p>
          </div>
        )}

        {/* ── Details table ────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-black/8 overflow-hidden">
          <p className="text-[11px] text-black/35 font-semibold uppercase tracking-wider px-4 pt-4 pb-3">Details</p>
          {[
            { label: 'Brand',     value: listing.shoe_brand },
            { label: 'Model',     value: listing.shoe_model },
            { label: 'Condition', value: CONDITION_LABELS[listing.condition] ?? listing.condition },
            { label: 'UK size',   value: `UK ${sizeEq?.uk ?? listing.size}` },
            { label: 'US size',   value: `US ${sizeEq?.us ?? listing.size}` },
            { label: 'EU size',   value: `EU ${sizeEq?.eu ?? listing.size}` },
            { label: 'Foot',      value: sideLabel },
            { label: 'Listed',    value: timeAgo(listing.created_at) },
          ].map(({ label, value }, i, arr) => (
            <div key={label} className={`flex items-center justify-between px-4 py-3 ${i < arr.length - 1 ? 'border-b border-black/5' : ''}`}>
              <span className="text-[13px] text-muted-foreground">{label}</span>
              <span className="text-[13px] font-medium text-foreground">{value}</span>
            </div>
          ))}
        </div>

        {/* ── Buyer protection ─────────────────────────────────────── */}
        {!isOwner && !isSold && (
          <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
            <ShieldCheck className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-[13px] font-semibold text-emerald-800">Buyer protection</p>
              <p className="text-[12px] text-emerald-700 mt-0.5 leading-relaxed">
                Message the seller to confirm details before purchasing. Report any issues within 48 hours.
              </p>
            </div>
          </div>
        )}

        {/* ── Owner actions ────────────────────────────────────────── */}
        {isOwner && (
          <div className="flex gap-2.5">
            <Link href={`/app/listing/${listingId}/edit`} className="flex-1">
              <Button variant="outline" className="w-full rounded-xl" style={{ height: 48 }}>Edit listing</Button>
            </Link>
            <Link href="/app/listings" className="flex-1">
              <Button variant="outline" className="w-full rounded-xl" style={{ height: 48 }}>My listings</Button>
            </Link>
          </div>
        )}

        {/* ── Sold state ───────────────────────────────────────────── */}
        {!isOwner && isSold && (
          <div className="p-4 rounded-2xl bg-muted/40 border border-border/30 text-center">
            <p className="font-semibold text-foreground">This shoe has been sold</p>
            <Link href="/app/browse" className="text-sm text-accent font-semibold mt-1 inline-block">Browse other listings →</Link>
          </div>
        )}

        {/* ── Report ───────────────────────────────────────────────── */}
        {!isOwner && (
          <button className="w-full flex items-center justify-center gap-1.5 py-3 text-[13px] text-muted-foreground/50 hover:text-muted-foreground transition-colors">
            <Flag className="h-3.5 w-3.5" /> Report this listing
          </button>
        )}
      </div>

      {/* ── Sticky bottom actions ────────────────────────────────── */}
      {!isOwner && !isSold && (
        <div className="fixed bottom-[60px] left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-black/[0.07] px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)] space-y-2.5 max-w-lg mx-auto">
          {contactError && (
            <p className="text-xs text-destructive bg-destructive/10 rounded-xl px-4 py-2">{contactError}</p>
          )}
          <Button variant="hero" size="lg" className="w-full gap-2 rounded-xl text-[15px]" style={{ height: 52 }}
            onClick={handleContact} disabled={contacting}>
            {contacting
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Opening chat…</>
              : <><MessageCircle className="h-5 w-5" /> {matchId ? 'Continue chat' : 'Message seller'}</>
            }
          </Button>
          <div className="flex gap-2.5">
            {listing.price != null && (
              <button
                onClick={() => setOfferOpen(true)}
                className="flex-1 h-[48px] rounded-xl border-2 border-black/15 bg-white text-foreground text-[14px] font-semibold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all"
              >
                <Tag className="h-4 w-4" /> Make offer
              </button>
            )}
            {listing.price != null && (
              <button onClick={handleBuyNow} disabled={buyingNow}
                className="flex-1 h-[48px] rounded-xl border-2 border-foreground bg-transparent text-foreground text-[14px] font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40 active:scale-[0.98] transition-all">
                {buyingNow
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Redirecting…</>
                  : <><ShoppingCart className="h-4 w-4" /> Buy now</>
                }
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Make an offer sheet ──────────────────────────────────── */}
      {offerOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            onClick={() => setOfferOpen(false)}
          />
          {/* Sheet */}
          <div className="fixed bottom-0 left-0 right-0 z-50 max-w-lg mx-auto bg-background rounded-t-[28px] px-6 pt-5 pb-[calc(env(safe-area-inset-bottom)+24px)] shadow-2xl">
            {/* Handle */}
            <div className="w-10 h-1 bg-black/15 rounded-full mx-auto mb-5" />

            <div className="flex items-center justify-between mb-1">
              <h2 className="text-[20px] font-bold text-foreground">Make an offer</h2>
              <button onClick={() => setOfferOpen(false)} className="w-8 h-8 rounded-full bg-black/6 flex items-center justify-center">
                <X className="h-4 w-4 text-foreground" />
              </button>
            </div>
            <p className="text-[13px] text-muted-foreground mb-6 leading-relaxed">
              Your offer will be sent as a message to the seller. They can accept, decline, or counter.
            </p>

            {/* Asking price context */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-[13px] text-muted-foreground">Asking price</span>
              <span className="text-[13px] font-semibold text-foreground">{sym}{listing.price}</span>
            </div>

            {/* Offer price input */}
            <div className="bg-black/[0.03] rounded-2xl px-5 py-4 mb-6">
              <p className="text-[11px] text-black/35 font-semibold uppercase tracking-wider mb-1.5">Your offer ({listing.currency})</p>
              <div className="flex items-center gap-2">
                <span className="text-[28px] font-bold text-black/20">{sym}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={offerPrice}
                  onChange={e => setOfferPrice(e.target.value)}
                  min="1"
                  step="1"
                  className="flex-1 bg-transparent text-foreground text-[28px] font-bold outline-none placeholder-black/15"
                  placeholder="0"
                  autoFocus
                />
              </div>
            </div>

            <button
              onClick={handleSendOffer}
              disabled={offerSending || !offerPrice || parseFloat(offerPrice) <= 0}
              className="w-full h-[54px] rounded-full bg-foreground text-background text-[15px] font-semibold flex items-center justify-center gap-2 disabled:opacity-25 active:scale-[0.98] transition-all"
            >
              {offerSending
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
                : `Send offer · ${sym}${offerPrice || '0'}`
              }
            </button>
          </div>
        </>
      )}
    </div>
  );
}

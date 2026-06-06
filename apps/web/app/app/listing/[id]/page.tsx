'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../../lib/supabase';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { ArrowLeft, MapPin, MessageCircle, ArrowLeftRight, ShoppingCart, Loader2 } from 'lucide-react';
import { formatSizeLabel } from '../../../../lib/sizeConversion';
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
}

interface Seller {
  id: string;
  name: string;
  location: string;
  avatar_url: string | null;
}

const CONDITION_LABELS: Record<string, string> = {
  new_with_tags: 'New (tags on)', new_without_tags: 'New', excellent: 'Excellent',
  good: 'Good', fair: 'Fair', poor: 'Poor',
};

interface PageProps { params: { id: string } }

export default function ListingDetailPage({ params }: PageProps) {
  const router    = useRouter();
  const listingId = params.id;

  const [userId,        setUserId]        = useState<string | null>(null);
  const [listing,       setListing]       = useState<Listing | null>(null);
  const [seller,        setSeller]        = useState<Seller | null>(null);
  const [matchId,       setMatchId]       = useState<string | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [notFound,      setNotFound]      = useState(false);
  const [contacting,    setContacting]    = useState(false);
  const [buyingNow,     setBuyingNow]     = useState(false);
  const [contactError,  setContactError]  = useState('');

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
        .select('id, shoe_brand, shoe_model, size, foot_side, condition, price, currency, description, photos, user_id, status')
        .eq('id', listingId)
        .single();

      if (error || !data) { setNotFound(true); setLoading(false); return; }

      const d = data as Record<string, unknown>;
      setListing({
        id:          d.id          as string,
        shoe_brand:  d.shoe_brand  as string,
        shoe_model:  d.shoe_model  as string,
        size:        d.size        as number,
        foot_side:   d.foot_side   as string,
        condition:   d.condition   as string,
        price:       d.price       as number | null,
        currency:    (d.currency as string) || 'USD',
        description: d.description as string | null,
        photos:      Array.isArray(d.photos) ? (d.photos as string[]) : [],
        user_id:     d.user_id     as string,
        status:      d.status      as string,
      });

      const { data: sellerData } = await supabase
        .from('users').select('id, name, location, avatar_url')
        .eq('id', d.user_id as string).single();

      if (sellerData) {
        const s = sellerData as Record<string, unknown>;
        setSeller({ id: s.id as string, name: s.name as string, location: s.location as string, avatar_url: s.avatar_url as string | null });
      }
      setLoading(false);
    })();
  }, [listingId]);

  // Find existing match/conversation between current user and seller
  useEffect(() => {
    if (!userId || !listing) return;
    (async () => {
      // Look for any match between these two users (regardless of listing)
      const { data } = await supabase
        .from('matches')
        .select('id')
        .or(
          `and(user_id_1.eq.${userId},user_id_2.eq.${listing.user_id}),and(user_id_1.eq.${listing.user_id},user_id_2.eq.${userId})`
        )
        .limit(1)
        .maybeSingle();
      if (data) setMatchId((data as { id: string }).id);
    })();
  }, [userId, listing]);

  // Create a direct conversation with the seller
  const handleContact = async () => {
    if (!userId || !listing || !seller) return;
    if (matchId) { router.push(`/app/messages/${matchId}`); return; }

    setContacting(true);
    setContactError('');

    try {
      const { data, error } = await supabase
        .from('matches')
        .insert({
          listing_id_1: null,
          listing_id_2: listingId,
          user_id_1:    userId,
          user_id_2:    seller.id,
          status:       'pending',
        })
        .select('id')
        .single();

      if (error) throw error;
      const newMatchId = (data as { id: string }).id;
      setMatchId(newMatchId);

      // Fire-and-forget email notification to seller
      fetch('/api/notifications/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type:       'new_contact',
          toUserId:   seller.id,
          listingId,
        }),
      }).catch(() => {});

      router.push(`/app/messages/${newMatchId}`);
    } catch {
      setContactError('Could not start conversation. Please try again.');
      setContacting(false);
    }
  };

  // Stripe checkout
  const handleBuyNow = async () => {
    if (!userId || !listing) return;
    setBuyingNow(true);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId, buyerId: userId }),
      });
      const json = await res.json() as { url?: string; error?: string };
      if (json.url) {
        window.location.href = json.url;
      } else {
        alert(json.error ?? 'Payment unavailable right now.');
        setBuyingNow(false);
      }
    } catch {
      alert('Payment unavailable right now.');
      setBuyingNow(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="aspect-[4/3] bg-muted animate-pulse" />
        <div className="max-w-lg mx-auto px-4 py-5 space-y-4">
          <div className="h-8 w-3/4 rounded-xl bg-muted animate-pulse" />
          <div className="h-4 w-1/2 rounded-lg bg-muted animate-pulse" />
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

  const sym     = getCurrencySymbol(listing.currency || 'USD');
  const isOwner = listing.user_id === userId;
  const isSold      = listing.status === 'sold';
  const sideLabel   = listing.foot_side === 'L' ? 'Left' : listing.foot_side === 'R' ? 'Right' : 'Either';
  const sideVariant = listing.foot_side === 'L' ? 'left' as const : listing.foot_side === 'R' ? 'right' as const : 'default' as const;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Image */}
      <div className="relative">
        <div className="aspect-[4/3] bg-muted overflow-hidden">
          {listing.photos[0] ? (
            <img src={listing.photos[0]} alt={`${listing.shoe_brand} ${listing.shoe_model}`} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-8xl opacity-20">👟</div>
          )}
        </div>
        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="absolute top-4 left-4 h-10 w-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center"
        >
          <ArrowLeft className="h-4 w-4 text-white" />
        </button>
        {/* Sold overlay */}
        {isSold && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="text-white font-bold text-2xl tracking-widest uppercase">Sold</span>
          </div>
        )}
        {/* Badges */}
        <div className="absolute bottom-3 left-4 flex gap-2">
          <Badge variant={sideVariant} className="shadow-sm backdrop-blur-sm text-xs px-3 py-1">{sideLabel} shoe</Badge>
          <Badge variant="default" className="shadow-sm backdrop-blur-sm text-xs px-3 py-1">
            {CONDITION_LABELS[listing.condition] ?? listing.condition}
          </Badge>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-4">
        {/* Title & price */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground leading-tight">
              {listing.shoe_brand} {listing.shoe_model}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {formatSizeLabel(String(listing.size), 'UK')} · {sideLabel} foot
            </p>
          </div>
          <p className="text-3xl font-bold text-foreground whitespace-nowrap flex-shrink-0">
            {listing.price != null ? `${sym}${listing.price}` : '—'}
          </p>
        </div>

        {/* Description */}
        {listing.description && (
          <div className="p-4 rounded-2xl bg-muted/40 border border-border/30">
            <p className="text-sm text-foreground leading-relaxed">{listing.description}</p>
          </div>
        )}

        {/* Seller card */}
        {seller && (
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-card border border-border/30">
            {seller.avatar_url ? (
              <img src={seller.avatar_url} alt={seller.name} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-accent/15 flex items-center justify-center text-base font-bold text-accent flex-shrink-0">
                {seller.name[0]}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-foreground">{seller.name}</p>
              {seller.location && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <MapPin className="h-3 w-3" /> {seller.location}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Actions — buyers only, non-sold listings */}
        {!isOwner && !isSold && (
          <div className="space-y-2.5">
            {contactError && (
              <p className="text-xs text-destructive bg-destructive/10 rounded-xl px-4 py-2.5">{contactError}</p>
            )}

            {/* Message */}
            <Button
              variant="hero"
              size="lg"
              className="w-full gap-2 rounded-xl text-base"
              style={{ height: 52 }}
              onClick={handleContact}
              disabled={contacting}
            >
              {contacting
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Opening chat…</>
                : <><MessageCircle className="h-5 w-5" /> {matchId ? 'Continue chat' : 'Message seller'}</>
              }
            </Button>

            {/* Buy Now — only when Stripe is configured */}
            {listing.price != null && (
              <button
                onClick={handleBuyNow}
                disabled={buyingNow}
                className="w-full h-[52px] rounded-xl border-2 border-foreground bg-transparent text-foreground text-[15px] font-semibold flex items-center justify-center gap-2 disabled:opacity-40 transition-all active:scale-[0.98]"
              >
                {buyingNow
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Redirecting…</>
                  : <><ShoppingCart className="h-5 w-5" /> Buy now · {sym}{listing.price}</>
                }
              </button>
            )}
          </div>
        )}

        {/* Owner actions */}
        {isOwner && (
          <div className="flex gap-2.5">
            <Link href={`/app/listing/${listingId}/edit`} className="flex-1">
              <Button variant="outline" className="w-full rounded-xl" style={{ height: 48 }}>
                Edit listing
              </Button>
            </Link>
            <Link href="/app/listings" className="flex-1">
              <Button variant="outline" className="w-full rounded-xl" style={{ height: 48 }}>
                My listings
              </Button>
            </Link>
          </div>
        )}

        {/* Sold state */}
        {!isOwner && isSold && (
          <div className="p-4 rounded-2xl bg-muted/40 border border-border/30 text-center">
            <p className="font-semibold text-foreground">This shoe has been sold</p>
            <Link href="/app/browse" className="text-sm text-accent font-semibold mt-1 inline-block">Browse other listings →</Link>
          </div>
        )}

        {/* How matching works */}
        {!isOwner && !isSold && (
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-muted/30 border border-border/20">
            <div className="w-7 h-7 rounded-lg bg-match-green/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <ArrowLeftRight className="h-3.5 w-3.5 text-match-green" />
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Message the seller directly, or swipe right in <Link href="/app" className="text-accent font-semibold">Discover</Link> to show mutual interest.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

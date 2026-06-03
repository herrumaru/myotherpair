'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../../lib/supabase';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { ArrowLeft, MapPin, MessageCircle, Heart, ArrowLeftRight } from 'lucide-react';
import { formatSizeLabel } from '../../../../lib/sizeConversion';

interface Listing {
  id: string;
  shoe_brand: string;
  shoe_model: string;
  size: number;
  foot_side: string;
  condition: string;
  price: number | null;
  description: string | null;
  photos: string[];
  user_id: string;
}

interface Seller {
  id: string;
  name: string;
  location: string;
  avatar_url: string | null;
}

interface MatchInfo {
  matchId: string;
}

const CONDITION_LABELS: Record<string, string> = {
  new_with_tags: 'New (tags on)', new_without_tags: 'New', excellent: 'Excellent',
  good: 'Good', fair: 'Fair', poor: 'Poor',
};

interface PageProps {
  params: { id: string };
}

export default function ListingDetailPage({ params }: PageProps) {
  const router    = useRouter();
  const listingId = params.id;

  const [userId,   setUserId]   = useState<string | null>(null);
  const [listing,  setListing]  = useState<Listing | null>(null);
  const [seller,   setSeller]   = useState<Seller | null>(null);
  const [matchId,  setMatchId]  = useState<string | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [notFound, setNotFound] = useState(false);

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
        .select('id, shoe_brand, shoe_model, size, foot_side, condition, price, description, photos, user_id')
        .eq('id', listingId)
        .single();

      if (error || !data) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const d = data as Record<string, unknown>;
      const l: Listing = {
        id:         d.id         as string,
        shoe_brand: d.shoe_brand as string,
        shoe_model: d.shoe_model as string,
        size:       d.size       as number,
        foot_side:  d.foot_side  as string,
        condition:  d.condition  as string,
        price:      d.price      as number | null,
        description:d.description as string | null,
        photos:     Array.isArray(d.photos) ? (d.photos as string[]) : [],
        user_id:    d.user_id    as string,
      };
      setListing(l);

      // Load seller
      const { data: sellerData } = await supabase
        .from('users')
        .select('id, name, location, avatar_url')
        .eq('id', l.user_id)
        .single();
      if (sellerData) {
        const s = sellerData as Record<string, unknown>;
        setSeller({
          id:         s.id         as string,
          name:       s.name       as string,
          location:   s.location   as string,
          avatar_url: s.avatar_url as string | null,
        });
      }

      setLoading(false);
    })();
  }, [listingId]);

  // Look for an existing match to use as message thread
  useEffect(() => {
    if (!userId || !listing) return;
    supabase
      .from('matches')
      .select('id')
      .or(`listing_id_1.eq.${listingId},listing_id_2.eq.${listingId}`)
      .or(`user_id_1.eq.${userId},user_id_2.eq.${userId}`)
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data) setMatchId((data as { id: string }).id);
      });
  }, [userId, listing, listingId]);

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
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Listing not found</p>
          <Button variant="outline" onClick={() => router.back()}>Go back</Button>
        </div>
      </div>
    );
  }

  const sideLabel   = listing.foot_side === 'L' ? 'Left' : listing.foot_side === 'R' ? 'Right' : 'Either';
  const sideVariant = listing.foot_side === 'L' ? 'left' as const : listing.foot_side === 'R' ? 'right' as const : 'default' as const;
  const messageHref = matchId ? `/app/messages/${matchId}` : null;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Image */}
      <div className="relative">
        <div className="aspect-[4/3] bg-muted overflow-hidden">
          {listing.photos[0] ? (
            <img
              src={listing.photos[0]}
              alt={`${listing.shoe_brand} ${listing.shoe_model}`}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-8xl opacity-30">👟</div>
          )}
        </div>

        {/* Nav buttons */}
        <div className="absolute top-4 left-4 right-4 flex justify-between">
          <button
            onClick={() => router.back()}
            className="h-10 w-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center"
          >
            <ArrowLeft className="h-4 w-4 text-white" />
          </button>
        </div>

        {/* Floating badges */}
        <div className="absolute bottom-3 left-4 flex gap-2">
          <Badge variant={sideVariant} className="shadow-sm backdrop-blur-sm text-xs px-3 py-1">
            {sideLabel} shoe
          </Badge>
          <Badge variant="default" className="shadow-sm backdrop-blur-sm text-xs px-3 py-1">
            {CONDITION_LABELS[listing.condition] ?? listing.condition}
          </Badge>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-5 animate-fade-in">
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
          <p className="text-3xl font-bold text-foreground whitespace-nowrap">
            {listing.price != null ? `$${listing.price}` : '$—'}
          </p>
        </div>

        {/* Description */}
        {listing.description && (
          <div className="p-4 rounded-2xl bg-muted/30 border border-border/30">
            <p className="text-sm text-foreground leading-relaxed">{listing.description}</p>
          </div>
        )}

        {/* Seller */}
        {seller && (
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-card shadow-card border border-border/30 hover-lift">
            <div className="relative">
              {seller.avatar_url ? (
                <img src={seller.avatar_url} alt={seller.name} className="w-12 h-12 rounded-xl object-cover" />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center text-base font-bold text-accent">
                  {seller.name[0]}
                </div>
              )}
              <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-match-green border-2 border-card" />
            </div>
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

        {/* Actions */}
        {listing.user_id !== userId && (
          <div className="flex gap-3">
            {messageHref ? (
              <Link href={messageHref} className="flex-1">
                <Button variant="hero" size="lg" className="w-full gap-2 rounded-xl text-base" style={{ height: 52 }}>
                  <MessageCircle className="h-5 w-5" /> Message seller
                </Button>
              </Link>
            ) : (
              <div className="flex-1 p-4 rounded-2xl bg-muted/40 border border-border/30 text-center">
                <p className="text-sm font-medium text-foreground mb-0.5">Want to connect?</p>
                <p className="text-xs text-muted-foreground">Swipe right on this listing in <Link href="/app" className="text-accent font-semibold">Discover</Link> to request a match.</p>
              </div>
            )}
          </div>
        )}

        {/* Compatible matches note */}
        <div className="pt-2">
          <div className="flex items-center gap-2 p-4 rounded-2xl bg-match-green/5 border border-match-green/15">
            <div className="w-7 h-7 rounded-lg bg-match-green/10 flex items-center justify-center">
              <ArrowLeftRight className="h-3.5 w-3.5 text-match-green" />
            </div>
            <p className="text-sm text-foreground/70">
              Swipe right on the discover tab to request a match with this listing.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

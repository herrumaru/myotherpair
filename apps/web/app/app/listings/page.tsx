'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { Badge } from '../../components/ui/Badge';
import { ArrowLeft, ShoppingBag, PlusCircle, Pencil, Trash2 } from 'lucide-react';

interface Listing {
  id: string;
  shoe_brand: string;
  shoe_model: string;
  size: number;
  foot_side: string;
  condition: string;
  price: number | null;
  photos: string[];
  status: string;
}

const CONDITION_LABELS: Record<string, string> = {
  new_with_tags: 'New (tags)', new_without_tags: 'New',
  excellent: 'Excellent', good: 'Good', fair: 'Fair', poor: 'Poor',
};

export default function ListingsPage() {
  const router = useRouter();
  const [userId,      setUserId]      = useState<string | null>(null);
  const [listings,    setListings]    = useState<Listing[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [deletingId,  setDeletingId]  = useState<string | null>(null);
  const [confirmId,   setConfirmId]   = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setUserId(session.user.id);
      else router.replace('/login');
    });
  }, [router]);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data } = await supabase
        .from('listings')
        .select('id, shoe_brand, shoe_model, size, foot_side, condition, price, photos, status')
        .eq('user_id', userId)
        .neq('status', 'deleted')
        .order('created_at', { ascending: false });

      setListings((data ?? []) as Listing[]);
      setLoading(false);
    })();
  }, [userId]);

  const removeListing = async (id: string) => {
    setDeletingId(id);
    await supabase.from('listings').update({ status: 'deleted' }).eq('id', id);
    setListings(prev => prev.filter(l => l.id !== id));
    setDeletingId(null);
    setConfirmId(null);
  };

  const toggleStatus = async (listing: Listing) => {
    const newStatus = listing.status === 'active' ? 'sold' : 'active';
    await supabase.from('listings').update({ status: newStatus }).eq('id', listing.id);
    setListings(prev =>
      prev.map(l => l.id === listing.id ? { ...l, status: newStatus } : l),
    );
  };

  const sideLabel   = (side: string) => side === 'L' ? 'Left' : side === 'R' ? 'Right' : 'Either';
  const sideVariant = (side: string): 'left' | 'right' | 'default' =>
    side === 'L' ? 'left' : side === 'R' ? 'right' : 'default';

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background">
        <div className="flex items-end justify-between px-5 pt-5 pb-3 max-w-lg mx-auto">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="w-8 h-8 flex items-center justify-center -ml-1">
              <ArrowLeft className="h-5 w-5 text-muted-foreground" />
            </button>
            <h1 className="text-[28px] font-bold text-foreground leading-none tracking-[-0.02em]">
              My Listings
            </h1>
          </div>
          <Link href="/app/create" className="w-8 h-8 flex items-center justify-center">
            <PlusCircle className="h-[20px] w-[20px] text-accent" />
          </Link>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pt-5 pb-12">

        {/* CTA banner */}
        <Link href="/app/create">
          <div className="bg-foreground rounded-2xl p-4 flex items-center gap-4 mb-5">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
              <PlusCircle className="h-5 w-5 text-white/80" />
            </div>
            <div>
              <p className="font-semibold text-[14px] text-white">List a new shoe</p>
              <p className="text-[12px] text-white/50">Find someone who needs your complement</p>
            </div>
          </div>
        </Link>

        {/* Loading skeleton */}
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="rounded-2xl overflow-hidden bg-card border border-border/20">
                <div className="aspect-square bg-muted animate-pulse" />
                <div className="p-3 space-y-2">
                  <div className="h-3 w-3/4 rounded bg-muted animate-pulse" />
                  <div className="h-2.5 w-1/2 rounded bg-muted animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : listings.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {listings.map(listing => (
              <div
                key={listing.id}
                className="overflow-hidden rounded-2xl bg-card shadow-card border border-border/30 group flex flex-col"
              >
                {/* Photo */}
                <Link href={`/app/listing/${listing.id}`} className="relative block">
                  <div className="aspect-square overflow-hidden bg-muted">
                    {listing.photos[0] ? (
                      <img
                        src={listing.photos[0]}
                        alt={`${listing.shoe_brand} ${listing.shoe_model}`}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-5xl opacity-20">
                        👟
                      </div>
                    )}
                  </div>
                  {/* Badges */}
                  <div className="absolute top-2 left-2 flex flex-col gap-1">
                    <Badge variant={sideVariant(listing.foot_side)} className="text-[10px] shadow-sm backdrop-blur-sm">
                      {sideLabel(listing.foot_side)}
                    </Badge>
                    {listing.status === 'sold' && (
                      <Badge variant="default" className="text-[10px] bg-muted-foreground/60 text-white border-0">
                        Sold
                      </Badge>
                    )}
                  </div>
                </Link>

                {/* Details */}
                <Link href={`/app/listing/${listing.id}`} className="px-3 pt-2.5 pb-1 flex-1">
                  <p className="font-semibold text-sm text-foreground leading-tight truncate">
                    {listing.shoe_brand} {listing.shoe_model}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    UK {listing.size} · {CONDITION_LABELS[listing.condition] ?? listing.condition}
                  </p>
                  <p className="font-bold text-base text-foreground mt-1">
                    {listing.price != null ? `$${listing.price}` : '—'}
                  </p>
                </Link>

                {/* Actions */}
                <div className="px-3 pb-3 pt-1 flex gap-1.5">
                  {/* Edit */}
                  <Link
                    href={`/app/listing/${listing.id}/edit`}
                    className="flex-1 flex items-center justify-center gap-1 text-[11px] text-muted-foreground hover:text-foreground border border-border/30 rounded-lg py-1.5 hover:bg-secondary/30 transition-colors"
                  >
                    <Pencil className="h-3 w-3" /> Edit
                  </Link>

                  {/* Toggle sold */}
                  <button
                    onClick={() => toggleStatus(listing)}
                    className={`flex-1 text-[11px] border rounded-lg py-1.5 transition-colors ${
                      listing.status === 'sold'
                        ? 'border-match-green/30 text-match-green hover:bg-match-green/5'
                        : 'border-border/30 text-muted-foreground hover:text-foreground hover:bg-secondary/30'
                    }`}
                  >
                    {listing.status === 'sold' ? 'Relist' : 'Mark sold'}
                  </button>

                  {/* Delete */}
                  {confirmId === listing.id ? (
                    <button
                      onClick={() => removeListing(listing.id)}
                      disabled={deletingId === listing.id}
                      className="flex-1 text-[11px] text-destructive border border-destructive/30 rounded-lg py-1.5 hover:bg-destructive/5 transition-colors"
                    >
                      {deletingId === listing.id ? '…' : 'Confirm'}
                    </button>
                  ) : (
                    <button
                      onClick={() => setConfirmId(listing.id)}
                      className="w-8 flex items-center justify-center border border-border/30 rounded-lg hover:border-destructive/30 hover:text-destructive text-muted-foreground/50 transition-colors"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>

                {/* Cancel confirm */}
                {confirmId === listing.id && (
                  <button
                    onClick={() => setConfirmId(null)}
                    className="text-[10px] text-muted-foreground/40 hover:text-muted-foreground pb-2 transition-colors"
                  >
                    cancel
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-24">
            <ShoppingBag className="h-8 w-8 text-muted-foreground/20 mx-auto mb-4" />
            <p className="text-sm text-muted-foreground/50">No listings yet</p>
            <Link
              href="/app/create"
              className="text-xs text-accent font-semibold mt-3 inline-block hover:underline"
            >
              List your first shoe
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

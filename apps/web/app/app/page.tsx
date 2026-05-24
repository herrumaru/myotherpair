'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import type { PanInfo } from 'framer-motion';
import { Badge } from '../components/ui/Badge';
import { Heart, X, MapPin } from 'lucide-react';
import { formatSizeLabel } from '../../lib/sizeConversion';

// ─── Types ────────────────────────────────────────────────────────────────────

type Foot = 'Left' | 'Right' | 'Either';
type Condition = 'new_with_tags' | 'new_without_tags' | 'excellent' | 'good' | 'fair' | 'poor';

function fromDbFoot(s: string): Foot {
  if (s === 'L') return 'Left';
  if (s === 'R') return 'Right';
  return 'Either';
}

function toDbFoot(f: Foot): string {
  if (f === 'Left')  return 'L';
  if (f === 'Right') return 'R';
  return 'single';
}

const CONDITION_LABELS: Record<Condition, string> = {
  new_with_tags:    'New (tags on)',
  new_without_tags: 'New',
  excellent:        'Excellent',
  good:             'Good',
  fair:             'Fair',
  poor:             'Poor',
};

interface Listing {
  id: string;
  shoe_brand: string;
  shoe_model: string;
  size: string;
  foot_side: string;
  condition: Condition;
  price: number | null;
  photos: string[];
  side: Foot;
  brand: string;
  model: string;
  category: string;
  photo: string | null;
  userId: string;
  sellerName: string;
  sellerLocation: string;
  sellerAvatar?: string;
}

const CARD_COLORS = [
  'from-blue-600 to-blue-400', 'from-green-600 to-emerald-400', 'from-red-600 to-rose-400',
  'from-gray-600 to-slate-400', 'from-zinc-700 to-zinc-500', 'from-sky-600 to-cyan-400',
  'from-orange-600 to-amber-400', 'from-purple-600 to-violet-400',
];

const SWIPE_THRESHOLD = 100;

// ─── Main component ───────────────────────────────────────────────────────────

export default function DiscoverPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const [deck, setDeck] = useState<Listing[]>([]);
  const [passed, setPassed] = useState<string[]>([]);
  const [liked, setLiked] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [matchCelebration, setMatchCelebration] = useState(false);
  const [direction, setDirection] = useState<number>(0);

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 0, 300], [-12, 0, 12]);
  const likeOpacity = useTransform(x, [0, SWIPE_THRESHOLD], [0, 1]);
  const passOpacity = useTransform(x, [-SWIPE_THRESHOLD, 0], [1, 0]);

  // Get current user
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setUserId(session.user.id);
    });
  }, []);

  // Load unseen listings from Supabase
  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    (async () => {
      try {
        const { data: swiped } = await supabase
          .from('swipes')
          .select('listing_id')
          .eq('swiper_id', userId);
        const swipedIds = (swiped ?? []).map((s: { listing_id: string }) => s.listing_id);

        let query = supabase
          .from('listings')
          .select('id, shoe_brand, shoe_model, size, foot_side, condition, price, photos, user_id')
          .eq('status', 'active')
          .neq('user_id', userId)
          .limit(30);

        if (swipedIds.length) {
          query = query.not('id', 'in', `(${swipedIds.join(',')})`) as typeof query;
        }

        const { data, error } = await query;
        if (error) throw error;

        // Load seller profiles separately (avoids FK constraint name dependency)
        const rawListings = (data ?? []) as Record<string, unknown>[];
        const sellerIds = [...new Set(rawListings.map(r => r.user_id as string))];
        const profileMap: Record<string, { name: string; location: string; avatar_url: string | null }> = {};
        if (sellerIds.length) {
          const { data: profiles } = await supabase
            .from('users')
            .select('id, name, location, avatar_url')
            .in('id', sellerIds);
          (profiles ?? []).forEach((p: Record<string, unknown>) => {
            profileMap[p.id as string] = {
              name:       p.name       as string ?? 'User',
              location:   p.location   as string ?? '',
              avatar_url: p.avatar_url as string | null ?? null,
            };
          });
        }

        const mapped: Listing[] = rawListings.map((r, i) => {
          const photos  = Array.isArray(r.photos) ? (r.photos as string[]) : [];
          const profile = profileMap[r.user_id as string];
          return {
            id:              r.id as string,
            shoe_brand:      r.shoe_brand as string,
            shoe_model:      r.shoe_model as string,
            size:            String(r.size),
            foot_side:       r.foot_side as string,
            condition:       r.condition as Condition,
            price:           r.price as number | null,
            photos,
            side:            fromDbFoot(r.foot_side as string),
            brand:           r.shoe_brand as string,
            model:           r.shoe_model as string,
            category:        CARD_COLORS[i % CARD_COLORS.length],
            photo:           photos[0] ?? null,
            userId:          r.user_id as string,
            sellerName:      profile?.name ?? 'User',
            sellerLocation:  profile?.location ?? '',
            sellerAvatar:    profile?.avatar_url ?? undefined,
          };
        });
        setDeck(mapped);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  const availableListings = deck.filter(
    (l) => !passed.includes(l.id) && !liked.includes(l.id)
  );

  const currentListing = availableListings[0];
  const nextListing    = availableListings[1];

  const handleSwipe = useCallback(async (dir: number) => {
    if (!currentListing) return;
    setDirection(dir);

    // Record swipe in DB
    if (userId) {
      const swipeDir = dir > 0 ? 'match' : 'pass';
      await supabase.from('swipes').insert({
        swiper_id:  userId,
        listing_id: currentListing.id,
        direction:  swipeDir,
      });

      // Check for mutual match when swiping right
      if (dir > 0) {
        const { data: myListings } = await supabase
          .from('listings').select('id').eq('user_id', userId).eq('status', 'active');
        if (myListings && myListings.length > 0) {
          const myIds = (myListings as { id: string }[]).map(l => l.id);
          const { data: ownerListing } = await supabase
            .from('listings').select('user_id').eq('id', currentListing.id).single();
          if (ownerListing) {
            const ownerId = (ownerListing as { user_id: string }).user_id;
            const { data: theirSwipe } = await supabase
              .from('swipes')
              .select('listing_id')
              .eq('swiper_id', ownerId)
              .in('direction', ['match', 'super'])
              .in('listing_id', myIds)
              .limit(1);
            if (theirSwipe && theirSwipe.length > 0) {
              const { error: matchErr } = await supabase.from('matches').insert({
                listing_id_1: (theirSwipe[0] as { listing_id: string }).listing_id,
                listing_id_2: currentListing.id,
                user_id_1:    userId,
                user_id_2:    ownerId,
                status:       'pending',
              });
              if (!matchErr) {
                setMatchCelebration(true);
                setTimeout(() => setMatchCelebration(false), 2800);
              }
            }
          }
        }
      }
    }

    setTimeout(() => {
      if (dir > 0) {
        setLiked((prev) => [...prev, currentListing.id]);
      } else {
        setPassed((prev) => [...prev, currentListing.id]);
      }
      setDirection(0);
      x.set(0);
    }, 250);
  }, [currentListing, userId, x]);

  const handleDragEnd = useCallback((_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const swipe    = info.offset.x;
    const velocity = info.velocity.x;
    if (swipe > SWIPE_THRESHOLD || velocity > 600) {
      handleSwipe(1);
    } else if (swipe < -SWIPE_THRESHOLD || velocity < -600) {
      handleSwipe(-1);
    }
  }, [handleSwipe]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-black/8">
          <div className="flex items-center justify-center px-5 h-14 max-w-lg mx-auto">
            <h1 className="font-display text-[15px] font-bold tracking-[0.12em] uppercase text-foreground">myotherpair</h1>
          </div>
        </header>
        <div className="max-w-lg mx-auto px-5 pt-5">
          <div className="relative touch-none" style={{ height: 'min(65vh, 480px)' }}>
            <div className="absolute inset-0 rounded-2xl bg-muted animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 overflow-x-hidden">
      {/* Match celebration overlay */}
      {matchCelebration && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center text-center px-8 bg-black/85">
          <div className="text-6xl mb-5">🎉</div>
          <h3 className="font-display text-4xl font-bold text-foreground mb-3">It's a match!</h3>
          <p className="text-muted-foreground text-sm">Head to Messages to say hello 👋</p>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-black/8">
        <div className="relative flex items-center justify-center px-5 h-14 max-w-lg mx-auto">
          <h1 className="font-display text-[15px] font-bold tracking-[0.12em] uppercase text-foreground">
            myotherpair
          </h1>
          <span className="absolute right-5 text-[11px] text-black/25 font-medium">
            {availableListings.length} left
          </span>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-5 pt-5">
        {currentListing ? (
          <div>
            {/* Card stack */}
            <div className="relative touch-none" style={{ height: 'min(65vh, 480px)' }}>

              {/* Next card peek */}
              {nextListing && (
                <div className="absolute inset-x-3 top-2 bottom-0 rounded-2xl overflow-hidden bg-card border border-border/20 shadow-card">
                  {nextListing.photo && (
                    <img
                      src={nextListing.photo}
                      alt=""
                      className="w-full h-full object-cover opacity-40"
                      draggable={false}
                    />
                  )}
                </div>
              )}

              {/* Active card */}
              <AnimatePresence>
                {direction === 0 && (
                  <motion.div
                    key={currentListing.id}
                    style={{ x, rotate }}
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.9}
                    onDragEnd={handleDragEnd}
                    initial={{ scale: 0.96, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    className="absolute inset-0 cursor-grab active:cursor-grabbing z-10"
                  >
                    {/* LIKE stamp */}
                    <motion.div
                      className="absolute top-6 left-5 z-20 pointer-events-none"
                      style={{ opacity: likeOpacity }}
                    >
                      <div className="border-[3px] border-match-green rounded-md px-4 py-1.5 -rotate-12">
                        <span className="font-display text-2xl font-bold text-match-green tracking-wider uppercase">
                          Like
                        </span>
                      </div>
                    </motion.div>

                    {/* NOPE stamp */}
                    <motion.div
                      className="absolute top-6 right-5 z-20 pointer-events-none"
                      style={{ opacity: passOpacity }}
                    >
                      <div className="border-[3px] border-destructive rounded-md px-4 py-1.5 rotate-12">
                        <span className="font-display text-2xl font-bold text-destructive tracking-wider uppercase">
                          Nope
                        </span>
                      </div>
                    </motion.div>

                    {/* Card */}
                    <div className="w-full h-full rounded-2xl overflow-hidden bg-card shadow-elevated relative">
                      {currentListing.photo ? (
                        <img
                          src={currentListing.photo}
                          alt={`${currentListing.brand} ${currentListing.model}`}
                          className="w-full h-full object-cover pointer-events-none select-none"
                          draggable={false}
                        />
                      ) : (
                        <div className={`w-full h-full bg-gradient-to-br ${CARD_COLORS[deck.indexOf(currentListing) % CARD_COLORS.length]} flex items-center justify-center`}>
                          <span className="text-[120px] opacity-20">👟</span>
                        </div>
                      )}

                      {/* Gradient overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />

                      {/* Top badges */}
                      <div className="absolute top-3.5 left-3.5 flex gap-1.5 z-10">
                        <Badge
                          variant={currentListing.side === 'Left' ? 'left' : 'right'}
                          className="text-[9px] px-2.5 py-1 tracking-[0.06em] uppercase font-semibold rounded-full"
                        >
                          {currentListing.side}
                        </Badge>
                        <Badge variant="outline" className="text-[9px] px-2.5 py-1 tracking-[0.06em] uppercase rounded-full">
                          {CONDITION_LABELS[currentListing.condition]}
                        </Badge>
                      </div>

                      {/* Bottom info */}
                      <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
                        <div className="flex items-end justify-between mb-1.5">
                          <h3 className="font-display text-xl font-bold text-white leading-tight">
                            {currentListing.brand}{' '}
                            <span className="text-white/60 font-normal text-base">{currentListing.model}</span>
                          </h3>
                          <span className="font-display text-lg font-bold text-white">
                            {currentListing.price != null ? `$${currentListing.price}` : '$—'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-white/50 text-xs mb-2.5">
                          <span>{formatSizeLabel(currentListing.size, 'UK')}</span>
                          <span className="w-0.5 h-0.5 rounded-full bg-white/30" />
                          <span>{currentListing.side} foot</span>
                        </div>

                        <div className="flex items-center gap-2.5 pt-2.5 border-t border-white/10">
                          {currentListing.sellerAvatar ? (
                            <img
                              src={currentListing.sellerAvatar}
                              alt={currentListing.sellerName}
                              className="w-7 h-7 rounded-full object-cover border border-white/20 pointer-events-none"
                              draggable={false}
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-bold text-white">
                              {currentListing.sellerName[0]}
                            </div>
                          )}
                          <span className="text-xs font-medium text-white/80 flex-1 truncate">{currentListing.sellerName}</span>
                          {currentListing.sellerLocation && (
                            <div className="flex items-center gap-1 text-white/35">
                              <MapPin className="h-2.5 w-2.5" />
                              <span className="text-[10px]">{currentListing.sellerLocation}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-center gap-8 mt-6">
              <motion.button
                onClick={() => handleSwipe(-1)}
                className="w-14 h-14 rounded-full border-2 border-border/60 flex items-center justify-center text-muted-foreground hover:border-destructive hover:text-destructive transition-colors"
                whileTap={{ scale: 0.85 }}
                aria-label="Pass"
              >
                <X className="h-5 w-5" strokeWidth={2.5} />
              </motion.button>
              <motion.button
                onClick={() => handleSwipe(1)}
                className="w-16 h-16 rounded-full gradient-warm flex items-center justify-center text-accent-foreground shadow-elevated"
                whileTap={{ scale: 0.85 }}
                aria-label="Like"
              >
                <Heart className="h-6 w-6" strokeWidth={2.5} />
              </motion.button>
            </div>
          </div>
        ) : (
          <motion.div
            className="text-center py-32"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <div className="w-px h-12 bg-border/40 mx-auto mb-8" />
            <h3 className="font-display text-2xl font-bold text-foreground tracking-[-0.02em] mb-3">
              All caught up
            </h3>
            <p className="text-[13px] text-muted-foreground/50 max-w-[260px] mx-auto leading-relaxed">
              You've explored every listing. New shoes drop daily.
            </p>
            <button
              onClick={() => { setLiked([]); setPassed([]); }}
              className="mt-8 text-[11px] tracking-[0.15em] uppercase font-semibold text-accent hover:text-accent/80 transition-colors inline-flex items-center gap-2"
            >
              Start over
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}

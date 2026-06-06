'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '../../../../lib/supabase';
import { ArrowLeft, MapPin, MessageCircle } from 'lucide-react';
import { getCurrencySymbol } from '../../../../lib/currency';

interface PublicProfile {
  id: string;
  name: string;
  username: string | null;
  avatar_url: string | null;
  location: string | null;
  bio: string | null;
  created_at: string;
}

interface PublicListing {
  id: string;
  shoe_brand: string;
  shoe_model: string;
  price: number | null;
  currency: string;
  photos: string[];
  foot_side: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 30)  return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export default function PublicProfilePage() {
  const router  = useRouter();
  const params  = useParams<{ id: string }>();
  const targetId = params.id;

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [profile,   setProfile]   = useState<PublicProfile | null>(null);
  const [listings,  setListings]  = useState<PublicListing[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [notFound,  setNotFound]  = useState(false);
  const [contacting, setContacting] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setCurrentUserId(session.user.id);
    });
  }, []);

  useEffect(() => {
    if (!targetId) return;
    (async () => {
      const [profileRes, listingsRes] = await Promise.all([
        supabase.from('users')
          .select('id, name, username, avatar_url, location, bio, created_at')
          .eq('id', targetId)
          .single(),
        supabase.from('listings')
          .select('id, shoe_brand, shoe_model, price, currency, photos, foot_side')
          .eq('user_id', targetId)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(24),
      ]);

      if (profileRes.error || !profileRes.data) { setNotFound(true); setLoading(false); return; }

      const d = profileRes.data as PublicProfile;
      setProfile({ ...d, name: d.name || 'Member' });
      setListings((listingsRes.data ?? []) as PublicListing[]);
      setLoading(false);
    })();
  }, [targetId]);

  const handleMessage = async () => {
    if (!currentUserId || !profile) return;
    if (currentUserId === profile.id) return;
    setContacting(true);
    const existing = await supabase.from('matches').select('id')
      .or(`and(user_id_1.eq.${currentUserId},user_id_2.eq.${profile.id}),and(user_id_1.eq.${profile.id},user_id_2.eq.${currentUserId})`)
      .limit(1).maybeSingle();

    if (existing.data) {
      router.push(`/app/messages/${(existing.data as { id: string }).id}`);
      return;
    }

    const { data } = await supabase.from('matches').insert({
      listing_id_1: null, listing_id_2: null,
      user_id_1: currentUserId, user_id_2: profile.id, status: 'pending',
    }).select('id').single();

    if (data) router.push(`/app/messages/${(data as { id: string }).id}`);
    else setContacting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="h-14 flex items-center px-4">
          <button onClick={() => router.back()} className="w-8 h-8 flex items-center justify-center">
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
        </div>
        <div className="max-w-lg mx-auto px-5 space-y-4 pt-4">
          <div className="flex gap-4">
            <div className="w-16 h-16 rounded-full bg-black/5 animate-pulse flex-shrink-0" />
            <div className="flex-1 space-y-2 pt-2">
              <div className="h-4 w-1/2 rounded bg-black/5 animate-pulse" />
              <div className="h-3 w-1/3 rounded bg-black/5 animate-pulse" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[0,1,2,3].map(i => (
              <div key={i} className="aspect-square rounded-2xl bg-black/5 animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-[17px] font-semibold text-foreground">Member not found</p>
        <button onClick={() => router.back()} className="text-accent text-[14px] font-semibold">Go back</button>
      </div>
    );
  }

  const initials   = profile.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const isOwnProfile = currentUserId === profile.id;
  const memberSince  = new Date(profile.created_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });

  return (
    <div className="min-h-screen bg-background pb-24">

      {/* Header */}
      <header className="sticky top-0 z-40 bg-background border-b border-black/[0.06]">
        <div className="flex items-center justify-between px-4 h-14 max-w-lg mx-auto">
          <button onClick={() => router.back()} className="w-8 h-8 flex items-center justify-center -ml-1">
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <p className="text-[15px] font-semibold text-foreground">
            {profile.username ? `@${profile.username}` : profile.name}
          </p>
          <div className="w-8" />
        </div>
      </header>

      <div className="max-w-lg mx-auto px-5">

        {/* Profile hero */}
        <div className="flex items-center gap-4 pt-6 pb-5">
          <div className="flex-shrink-0">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.name} className="w-20 h-20 rounded-full object-cover" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-[#f05d23]/15 flex items-center justify-center text-2xl font-bold text-[#f05d23]">
                {initials}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-[20px] font-bold text-foreground leading-tight">{profile.name}</h1>
            {profile.username && (
              <p className="text-[13px] text-black/35 font-medium">@{profile.username}</p>
            )}
            {profile.location && (
              <div className="flex items-center gap-1 text-black/40 mt-1">
                <MapPin className="w-3 h-3 flex-shrink-0" />
                <span className="text-[12px] truncate">{profile.location}</span>
              </div>
            )}
            <p className="text-[11px] text-black/25 mt-1">Member since {memberSince}</p>
          </div>
        </div>

        {/* Bio */}
        {profile.bio && (
          <div className="bg-white rounded-2xl border border-black/[0.07] px-4 py-3.5 mb-4">
            <p className="text-[14px] text-foreground leading-relaxed">{profile.bio}</p>
          </div>
        )}

        {/* Message button */}
        {!isOwnProfile && currentUserId && (
          <button
            onClick={handleMessage}
            disabled={contacting}
            className="w-full h-12 rounded-2xl bg-foreground text-background text-[14px] font-semibold flex items-center justify-center gap-2 mb-5 active:scale-[0.98] transition-all disabled:opacity-40"
          >
            <MessageCircle className="h-4 w-4" />
            {contacting ? 'Opening chat…' : `Message ${profile.name.split(' ')[0]}`}
          </button>
        )}
        {isOwnProfile && (
          <Link
            href="/app/profile/edit"
            className="w-full h-12 rounded-2xl border-2 border-black/10 text-foreground text-[14px] font-semibold flex items-center justify-center mb-5 active:scale-[0.98] transition-all"
          >
            Edit profile
          </Link>
        )}

        {/* Listings */}
        {listings.length > 0 ? (
          <>
            <p className="text-[11px] font-bold text-black/30 tracking-[0.15em] uppercase mb-3">
              {listings.length} listing{listings.length !== 1 ? 's' : ''}
            </p>
            <div className="grid grid-cols-2 gap-3">
              {listings.map(l => {
                const sym       = getCurrencySymbol(l.currency || 'USD');
                const sideLabel = l.foot_side === 'L' ? 'Left' : l.foot_side === 'R' ? 'Right' : '';
                return (
                  <Link
                    key={l.id}
                    href={`/app/listing/${l.id}`}
                    className="block rounded-2xl overflow-hidden bg-white border border-black/8 active:scale-[0.98] transition-transform"
                  >
                    <div className="aspect-square bg-black/5 overflow-hidden relative">
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
          </>
        ) : (
          <div className="text-center py-16">
            <p className="text-[14px] text-black/30">No active listings yet</p>
          </div>
        )}
      </div>
    </div>
  );
}

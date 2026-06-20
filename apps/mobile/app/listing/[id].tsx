import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator, Alert, Dimensions,
  FlatList, TextInput,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { ArrowLeft, Heart, MessageCircle, Tag, MapPin } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { colors, spacing, font, radius } from '../../lib/theme';

const { width: SCREEN_W } = Dimensions.get('window');

const CONDITION_LABELS: Record<string, string> = {
  new_with_tags: 'New with tags', new_without_tags: 'New without tags',
  excellent: 'Excellent', good: 'Good', fair: 'Fair', poor: 'Poor',
};

interface Listing {
  id: string; shoe_brand: string; shoe_model: string; size: number;
  foot_side: string; condition: string; price: number | null;
  currency: string; description: string | null; photos: string[];
  user_id: string; status: string; created_at: string; swap_available: boolean;
}
interface Seller {
  id: string; name: string; location: string; avatar_url: string | null; listing_count: number;
}

function sym(currency: string) {
  return ({ USD: '$', EUR: '€', GBP: '£' } as Record<string, string>)[currency] ?? '$';
}

export default function ListingDetailScreen() {
  const { id: listingId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [userId,     setUserId]     = useState<string | null>(null);
  const [listing,    setListing]    = useState<Listing | null>(null);
  const [seller,     setSeller]     = useState<Seller | null>(null);
  const [matchId,    setMatchId]    = useState<string | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [saved,      setSaved]      = useState(false);
  const [contacting, setContacting] = useState(false);
  const [photoIdx,   setPhotoIdx]   = useState(0);
  const [offerOpen,  setOfferOpen]  = useState(false);
  const [offerPrice, setOfferPrice] = useState('');

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
        .select('id, shoe_brand, shoe_model, size, foot_side, condition, price, currency, description, photos, user_id, status, created_at, swap_available')
        .eq('id', listingId).single();
      if (error || !data) { setLoading(false); return; }

      const d = data as Record<string, unknown>;
      const l: Listing = {
        id: d.id as string, shoe_brand: d.shoe_brand as string, shoe_model: d.shoe_model as string,
        size: d.size as number, foot_side: d.foot_side as string, condition: d.condition as string,
        price: d.price as number | null, currency: (d.currency as string) ?? 'USD',
        description: d.description as string | null,
        photos: Array.isArray(d.photos) ? (d.photos as string[]) : [],
        user_id: d.user_id as string, status: d.status as string,
        created_at: d.created_at as string, swap_available: !!(d.swap_available),
      };
      setListing(l);
      if (l.price != null) setOfferPrice(String(Math.floor(l.price * 0.9)));

      const [profileRes, countRes] = await Promise.all([
        supabase.from('users').select('id, name, location, avatar_url').eq('id', d.user_id as string).single(),
        supabase.from('listings').select('id', { count: 'exact', head: true }).eq('user_id', d.user_id as string).eq('status', 'active'),
      ]);
      if (profileRes.data) {
        const s = profileRes.data as Record<string, unknown>;
        setSeller({ id: s.id as string, name: (s.name as string) ?? 'User', location: (s.location as string) ?? '', avatar_url: s.avatar_url as string | null, listing_count: countRes.count ?? 0 });
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

  const ensureMatch = async (): Promise<string | null> => {
    if (matchId) return matchId;
    if (!userId || !seller || !listingId) return null;
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
    if (!userId) { Alert.alert('Sign in required'); return; }
    if (matchId) { router.push(`/conversation/${matchId}` as never); return; }
    setContacting(true);
    const id = await ensureMatch();
    setContacting(false);
    if (id) router.push(`/conversation/${id}` as never);
    else Alert.alert('Error', 'Could not start conversation. Try again.');
  };

  const handleSave = async () => {
    if (!userId || !listingId) return;
    if (saved) {
      await supabase.from('saved_listings').delete().eq('user_id', userId).eq('listing_id', listingId);
      setSaved(false);
    } else {
      await supabase.from('saved_listings').insert({ user_id: userId, listing_id: listingId });
      setSaved(true);
    }
  };

  const handleOffer = async () => {
    const amount = parseFloat(offerPrice);
    if (!amount || amount <= 0) return;
    const id = await ensureMatch();
    if (!id) { Alert.alert('Error', 'Could not start conversation.'); return; }
    await supabase.from('messages').insert({
      match_id: id, sender_id: userId,
      content: JSON.stringify({ type: 'offer', amount, currency: listing?.currency ?? 'USD' }),
    });
    setOfferOpen(false);
    router.push(`/conversation/${id}` as never);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (!listing) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text style={{ color: colors.foreground, fontSize: font.md, fontWeight: '600', marginBottom: 8 }}>Listing not found</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={{ color: colors.accent }}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isOwner  = listing.user_id === userId;
  const isSold   = listing.status === 'sold';
  const photos   = listing.photos;
  const sideLabel = listing.foot_side === 'L' ? 'Left' : listing.foot_side === 'R' ? 'Right' : 'Either';
  const leftShoeAccent  = '#1E3A5F';
  const rightShoeAccent = '#4A1428';
  const swapAccent      = '#1A3A2A';

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Photo carousel */}
      <View style={styles.photoWrap}>
        {photos.length > 0 ? (
          <FlatList
            data={photos} horizontal pagingEnabled showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={e => setPhotoIdx(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W))}
            renderItem={({ item }) => (
              <Image source={{ uri: item }} style={{ width: SCREEN_W, height: SCREEN_W * 0.75 }} contentFit="cover" />
            )}
            keyExtractor={(_, i) => String(i)}
          />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Text style={{ fontSize: 72, opacity: 0.2 }}>👟</Text>
          </View>
        )}
        <TouchableOpacity style={styles.overlayBtn} onPress={() => router.back()}>
          <ArrowLeft size={18} color="#fff" />
        </TouchableOpacity>
        {!isOwner && (
          <TouchableOpacity style={[styles.overlayBtn, { right: 16, left: undefined }]} onPress={handleSave}>
            <Heart size={18} color={saved ? '#e05252' : '#fff'} fill={saved ? '#e05252' : 'transparent'} />
          </TouchableOpacity>
        )}
        {photos.length > 1 && (
          <View style={styles.dots}>
            {photos.map((_, i) => (
              <View key={i} style={[styles.dot, i === photoIdx && styles.dotActive]} />
            ))}
          </View>
        )}
        {isSold && (
          <View style={styles.soldOverlay}>
            <Text style={styles.soldText}>SOLD</Text>
          </View>
        )}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 140 }}>
        <View style={{ padding: spacing.lg }}>
          <Text style={styles.price}>
            {listing.price != null ? `${sym(listing.currency)}${listing.price}` : 'Price on request'}
          </Text>
          <Text style={styles.title}>{listing.shoe_brand} {listing.shoe_model}</Text>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{CONDITION_LABELS[listing.condition] ?? listing.condition}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: listing.foot_side === 'L' ? leftShoeAccent : listing.foot_side === 'R' ? rightShoeAccent : colors.muted }]}>
              <Text style={[styles.badgeText, { color: listing.foot_side === 'L' ? colors.leftShoe : listing.foot_side === 'R' ? colors.rightShoe : colors.foreground }]}>
                {sideLabel} foot
              </Text>
            </View>
            {listing.swap_available && (
              <View style={[styles.badge, { backgroundColor: swapAccent }]}>
                <Text style={[styles.badgeText, { color: colors.matchGreen }]}>🔄 Open to swap</Text>
              </View>
            )}
          </View>

          {/* Size card */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Shoe size</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              {[
                { label: 'UK', value: listing.size },
                { label: 'US', value: Number(listing.size) + 0.5 },
                { label: 'EU', value: Math.round(Number(listing.size) + 33) },
              ].map(({ label, value }) => (
                <View key={label} style={styles.sizeChip}>
                  <Text style={styles.sizeLabel}>{label}</Text>
                  <Text style={styles.sizeValue}>{value}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Seller card */}
          {seller && (
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Seller</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 }}>
                {seller.avatar_url ? (
                  <Image source={{ uri: seller.avatar_url }} style={styles.sellerAvatar} contentFit="cover" />
                ) : (
                  <View style={[styles.sellerAvatar, { backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center' }]}>
                    <Text style={{ fontSize: font.md, fontWeight: '700', color: colors.accent }}>{seller.name[0]}</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: font.sm, fontWeight: '600', color: colors.foreground }}>{seller.name}</Text>
                  {seller.location ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 }}>
                      <MapPin size={11} color={colors.foregroundMuted} />
                      <Text style={{ fontSize: 12, color: colors.foregroundMuted }}>{seller.location}</Text>
                    </View>
                  ) : null}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: font.xl, fontWeight: '700', color: colors.foreground }}>{seller.listing_count}</Text>
                  <Text style={{ fontSize: 11, color: colors.foregroundMuted }}>listings</Text>
                </View>
              </View>
            </View>
          )}

          {/* Description */}
          {listing.description ? (
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Description</Text>
              <Text style={{ fontSize: font.sm, color: colors.foreground, lineHeight: 22, marginTop: 8 }}>{listing.description}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Bottom actions */}
      {!isOwner && !isSold && (
        <View style={styles.actionBar}>
          <TouchableOpacity style={styles.primaryBtn} onPress={handleContact} disabled={contacting}>
            {contacting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <MessageCircle size={18} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.primaryBtnText}>{matchId ? 'Continue chat' : 'Message seller'}</Text>
              </>
            )}
          </TouchableOpacity>
          {listing.price != null && (
            <TouchableOpacity style={[styles.secondaryBtn, { marginTop: 10 }]} onPress={() => setOfferOpen(true)}>
              <Tag size={16} color={colors.foreground} />
              <Text style={styles.secondaryBtnText}>Make offer</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Offer sheet */}
      {offerOpen && (
        <>
          <TouchableOpacity
            style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' } as object}
            onPress={() => setOfferOpen(false)}
          />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: font.xl, fontWeight: '700', color: colors.foreground }}>Make an offer</Text>
              <TouchableOpacity onPress={() => setOfferOpen(false)} style={{ padding: 4 }}>
                <Text style={{ color: colors.foregroundMuted, fontSize: font.md }}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
              <Text style={{ color: colors.foregroundMuted }}>Asking price</Text>
              <Text style={{ color: colors.foreground, fontWeight: '600' }}>{sym(listing.currency)}{listing.price}</Text>
            </View>
            <View style={styles.offerInputWrap}>
              <Text style={styles.offerSym}>{sym(listing.currency)}</Text>
              <TextInput
                style={styles.offerInput}
                value={offerPrice}
                onChangeText={setOfferPrice}
                keyboardType="decimal-pad"
                placeholderTextColor={colors.foregroundMuted}
                selectionColor={colors.accent}
                autoFocus
              />
            </View>
            <TouchableOpacity style={[styles.primaryBtn, { marginTop: 16 }]} onPress={handleOffer}>
              <Text style={styles.primaryBtnText}>Send offer · {sym(listing.currency)}{offerPrice || '0'}</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: colors.background },
  photoWrap:        { position: 'relative' },
  photoPlaceholder: { width: '100%', aspectRatio: 4/3, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
  overlayBtn:       { position: 'absolute', top: 14, left: 16, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  dots:             { position: 'absolute', bottom: 10, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 5 },
  dot:              { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.5)' },
  dotActive:        { width: 18, backgroundColor: '#fff' },
  soldOverlay:      { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  soldText:         { color: '#fff', fontSize: 28, fontWeight: '800', letterSpacing: 6 },
  price:            { fontSize: 34, fontWeight: '800', color: colors.foreground },
  title:            { fontSize: font.xl, fontWeight: '700', color: colors.foreground, marginTop: 4 },
  badge:            { paddingHorizontal: 12, paddingVertical: 5, borderRadius: radius.full, backgroundColor: colors.muted },
  badgeText:        { fontSize: 12, fontWeight: '600', color: colors.foreground },
  card:             { backgroundColor: colors.card, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginTop: 12 },
  cardLabel:        { fontSize: 11, fontWeight: '700', color: colors.foregroundMuted, textTransform: 'uppercase', letterSpacing: 1 },
  sizeChip:         { flex: 1, backgroundColor: colors.background, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center', paddingVertical: 10 },
  sizeLabel:        { fontSize: 11, color: colors.foregroundMuted, fontWeight: '500' },
  sizeValue:        { fontSize: 20, fontWeight: '700', color: colors.foreground, marginTop: 2 },
  sellerAvatar:     { width: 46, height: 46, borderRadius: 23 },
  actionBar:        { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border, padding: 16, paddingBottom: 32 },
  primaryBtn:       { height: 52, borderRadius: radius.full, backgroundColor: colors.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  primaryBtnText:   { color: '#fff', fontSize: font.md, fontWeight: '700' },
  secondaryBtn:     { height: 46, borderRadius: radius.xl, borderWidth: 2, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  secondaryBtnText: { fontSize: font.sm, fontWeight: '600', color: colors.foreground },
  sheet:            { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 },
  sheetHandle:      { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 20 },
  offerInputWrap:   { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.muted, borderRadius: radius.xl, paddingHorizontal: 20, paddingVertical: 12, gap: 8 },
  offerSym:         { fontSize: 30, fontWeight: '700', color: colors.foregroundMuted },
  offerInput:       { flex: 1, fontSize: 30, fontWeight: '700', color: colors.foreground },
});

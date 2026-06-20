import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  StyleSheet, SafeAreaView,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { ArrowLeft, Send, Check, X, RefreshCw } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { colors, spacing, font, radius } from '../../lib/theme';

interface Message {
  id: string;
  from: 'me' | 'them';
  text: string;
  timestamp: string;
}

interface MatchInfo {
  otherUserName: string;
  otherUserAvatar: string | null;
  listingId: string | null;
  listingBrand: string;
  listingModel: string;
  listingPrice: number | null;
  listingCurrency: string;
  listingPhoto: string | null;
}

interface OfferPayload { type: 'offer'; amount: number; currency: string; }

function parseOffer(text: string): OfferPayload | null {
  try {
    const p = JSON.parse(text);
    if (p.type === 'offer' && typeof p.amount === 'number') return p as OfferPayload;
  } catch {}
  return null;
}

function sym(currency: string) {
  return ({ USD: '$', EUR: '€', GBP: '£', JPY: '¥' } as Record<string,string>)[currency] ?? '$';
}

export default function ConversationScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const router = useRouter();

  const [userId,        setUserId]        = useState<string | null>(null);
  const [isUser1,       setIsUser1]       = useState<boolean | null>(null);
  const [matchInfo,     setMatchInfo]     = useState<MatchInfo | null>(null);
  const [messages,      setMessages]      = useState<Message[]>([]);
  const [newMsg,        setNewMsg]        = useState('');
  const [sending,       setSending]       = useState(false);
  const [loading,       setLoading]       = useState(true);
  const [counterInputs, setCounterInputs] = useState<Record<string, string>>({});
  const [showCounter,   setShowCounter]   = useState<Record<string, boolean>>({});
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setUserId(session.user.id);
    });
  }, []);

  // Load match info
  useEffect(() => {
    if (!userId || !matchId) return;
    (async () => {
      const { data } = await supabase
        .from('matches')
        .select('id, user_id_1, user_id_2, listing_id_1, listing_id_2')
        .eq('id', matchId).single();
      if (!data) return;

      const r = data as { id: string; user_id_1: string; user_id_2: string; listing_id_1: string; listing_id_2: string };
      const u1 = r.user_id_1 === userId;
      setIsUser1(u1);
      const otherId   = u1 ? r.user_id_2 : r.user_id_1;
      const listingId = u1 ? r.listing_id_2 : r.listing_id_1;

      const [profileRes, listingRes] = await Promise.all([
        supabase.from('users').select('name, avatar_url').eq('id', otherId).single(),
        listingId
          ? supabase.from('listings').select('shoe_brand, shoe_model, size, price, currency, photos').eq('id', listingId).single()
          : Promise.resolve({ data: null }),
      ]);

      const profile = profileRes.data as Record<string, unknown> | null;
      const listing = listingRes.data as Record<string, unknown> | null;
      const photos  = Array.isArray(listing?.photos) ? (listing!.photos as string[]) : [];

      setMatchInfo({
        otherUserName:   (profile?.name as string) ?? 'User',
        otherUserAvatar: (profile?.avatar_url as string | null) ?? null,
        listingId:       listingId ?? null,
        listingBrand:    (listing?.shoe_brand as string) ?? '',
        listingModel:    (listing?.shoe_model as string) ?? '',
        listingPrice:    (listing?.price as number | null) ?? null,
        listingCurrency: (listing?.currency as string) ?? 'USD',
        listingPhoto:    photos[0] ?? null,
      });
    })();
  }, [userId, matchId]);

  // Mark as read
  useEffect(() => {
    if (!userId || !matchId || isUser1 === null) return;
    const col = isUser1 ? 'user1_last_read_at' : 'user2_last_read_at';
    supabase.from('matches').update({ [col]: new Date().toISOString() }).eq('id', matchId);
  }, [userId, matchId, isUser1]);

  // Load messages
  useEffect(() => {
    if (!userId || !matchId) return;
    (async () => {
      const { data } = await supabase
        .from('messages')
        .select('id, sender_id, content, created_at')
        .eq('match_id', matchId)
        .order('created_at', { ascending: false });

      if (data) {
        setMessages((data as { id: string; sender_id: string; content: string; created_at: string }[]).map(m => ({
          id:        m.id,
          from:      m.sender_id === userId ? 'me' : 'them',
          text:      m.content,
          timestamp: m.created_at,
        })));
      }
      setLoading(false);
    })();
  }, [userId, matchId]);

  // Realtime
  useEffect(() => {
    if (!userId || !matchId) return;
    const channel = supabase
      .channel(`mobile-messages:${matchId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `match_id=eq.${matchId}` },
        payload => {
          const m = payload.new as { id: string; sender_id: string; content: string; created_at: string };
          setMessages(prev => {
            if (prev.some(msg => msg.id === m.id)) return prev;
            return [{ id: m.id, from: m.sender_id === userId ? 'me' : 'them', text: m.content, timestamp: m.created_at }, ...prev];
          });
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, matchId]);

  const sendContent = useCallback(async (text: string) => {
    if (!userId || !matchId) return;
    const tempId = `opt-${Date.now()}`;
    setMessages(prev => [{ id: tempId, from: 'me', text, timestamp: new Date().toISOString() }, ...prev]);
    const { data: inserted } = await supabase
      .from('messages').insert({ match_id: matchId, sender_id: userId, content: text }).select('id').single();
    if (inserted) {
      const realId = (inserted as { id: string }).id;
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, id: realId } : m));
    }
  }, [userId, matchId]);

  const sendMessage = async () => {
    if (!newMsg.trim() || sending) return;
    const text = newMsg.trim();
    setNewMsg('');
    setSending(true);
    await sendContent(text);
    setSending(false);
  };

  const handleAccept = (offer: OfferPayload) =>
    sendContent(`✅ I accept your offer of ${sym(offer.currency)}${offer.amount}! Let's proceed.`);

  const handleDecline = (offer: OfferPayload) =>
    sendContent(`Sorry, I can't accept the ${sym(offer.currency)}${offer.amount} offer.`);

  const handleCounter = (msgId: string, offer: OfferPayload) => {
    const amount = parseFloat(counterInputs[msgId] ?? '');
    if (!amount || amount <= 0) return;
    sendContent(JSON.stringify({ type: 'offer', amount, currency: offer.currency }));
    setShowCounter(p => ({ ...p, [msgId]: false }));
    setCounterInputs(p => ({ ...p, [msgId]: '' }));
  };

  const renderOffer = (msg: Message, offer: OfferPayload) => {
    const isMine = msg.from === 'me';
    const isCountering = showCounter[msg.id];
    return (
      <View style={styles.offerCard}>
        <View style={styles.offerHeader}>
          <Text style={styles.offerLabel}>{isMine ? 'Your offer' : `Offer from ${matchInfo?.otherUserName ?? 'them'}`}</Text>
          <Text style={styles.offerAmount}>{sym(offer.currency)}{offer.amount}</Text>
          {matchInfo?.listingPrice != null && (
            <Text style={styles.offerSubtext}>
              Asking {sym(offer.currency)}{matchInfo.listingPrice} · {Math.round((1 - offer.amount / matchInfo.listingPrice) * 100)}% below
            </Text>
          )}
        </View>
        {!isMine && !isCountering && (
          <View style={styles.offerActions}>
            <TouchableOpacity style={[styles.offerBtn, styles.offerBtnDecline]} onPress={() => handleDecline(offer)}>
              <X size={14} color={colors.destructive} />
              <Text style={[styles.offerBtnText, { color: colors.destructive }]}>Decline</Text>
            </TouchableOpacity>
            <View style={styles.offerDivider} />
            <TouchableOpacity style={styles.offerBtn} onPress={() => setShowCounter(p => ({ ...p, [msg.id]: true }))}>
              <RefreshCw size={14} color={colors.foregroundMuted} />
              <Text style={[styles.offerBtnText, { color: colors.foregroundMuted }]}>Counter</Text>
            </TouchableOpacity>
            <View style={styles.offerDivider} />
            <TouchableOpacity style={[styles.offerBtn, styles.offerBtnAccept]} onPress={() => handleAccept(offer)}>
              <Check size={14} color={colors.matchGreen} />
              <Text style={[styles.offerBtnText, { color: colors.matchGreen }]}>Accept</Text>
            </TouchableOpacity>
          </View>
        )}
        {!isMine && isCountering && (
          <View style={styles.counterContainer}>
            <Text style={styles.offerLabel}>Counter offer ({offer.currency})</Text>
            <View style={styles.counterInput}>
              <Text style={styles.counterSym}>{sym(offer.currency)}</Text>
              <TextInput
                style={styles.counterField}
                value={counterInputs[msg.id] ?? ''}
                onChangeText={v => setCounterInputs(p => ({ ...p, [msg.id]: v }))}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={colors.foregroundMuted}
                autoFocus
              />
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <TouchableOpacity style={[styles.offerBtn, { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md }]}
                onPress={() => setShowCounter(p => ({ ...p, [msg.id]: false }))}>
                <Text style={[styles.offerBtnText, { color: colors.foreground }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.offerBtn, { flex: 1, backgroundColor: colors.foreground, borderRadius: radius.md }]}
                onPress={() => handleCounter(msg.id, offer)}>
                <Text style={[styles.offerBtnText, { color: colors.background }]}>Send</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        {isMine && (
          <View style={{ padding: spacing.md }}>
            <Text style={{ fontSize: font.xs, color: colors.foregroundMuted, textAlign: 'center' }}>Waiting for response…</Text>
          </View>
        )}
      </View>
    );
  };

  const renderMessage = ({ item: msg }: { item: Message }) => {
    const offer = parseOffer(msg.text);
    if (offer) return renderOffer(msg, offer);
    const isMine = msg.from === 'me';
    return (
      <View style={{ flexDirection: 'row', justifyContent: isMine ? 'flex-end' : 'flex-start', marginBottom: 6 }}>
        <View style={[styles.bubble, isMine ? styles.bubbleMe : styles.bubbleThem]}>
          <Text style={[styles.bubbleText, { color: isMine ? '#fff' : colors.foreground }]}>{msg.text}</Text>
        </View>
      </View>
    );
  };

  const listingCard = matchInfo && (matchInfo.listingBrand || matchInfo.listingModel) ? (
    <TouchableOpacity
      style={styles.listingCard}
      onPress={() => matchInfo.listingId && router.push(`/listing/${matchInfo.listingId}` as never)}
    >
      {matchInfo.listingPhoto ? (
        <Image source={{ uri: matchInfo.listingPhoto }} style={styles.listingThumb} contentFit="cover" />
      ) : (
        <View style={[styles.listingThumb, { backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={{ fontSize: 24 }}>👟</Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: font.xs, color: colors.foregroundMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>Listing</Text>
        <Text style={{ fontSize: font.sm, fontWeight: '600', color: colors.foreground }} numberOfLines={1}>
          {matchInfo.listingBrand} {matchInfo.listingModel}
        </Text>
      </View>
      {matchInfo.listingPrice != null && (
        <Text style={{ fontSize: font.md, fontWeight: '700', color: colors.foreground }}>
          {sym(matchInfo.listingCurrency)}{matchInfo.listingPrice}
        </Text>
      )}
    </TouchableOpacity>
  ) : null;

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={colors.foreground} />
        </TouchableOpacity>
        {matchInfo?.otherUserAvatar ? (
          <Image source={{ uri: matchInfo.otherUserAvatar }} style={styles.avatar} contentFit="cover" />
        ) : (
          <View style={[styles.avatar, { backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={{ fontSize: font.md, fontWeight: '700', color: colors.accent }}>
              {matchInfo?.otherUserName?.[0] ?? '?'}
            </Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.headerName} numberOfLines={1}>{matchInfo?.otherUserName ?? 'User'}</Text>
          {matchInfo && (matchInfo.listingBrand || matchInfo.listingModel) && (
            <Text style={styles.headerSub} numberOfLines={1}>{matchInfo.listingBrand} {matchInfo.listingModel}</Text>
          )}
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={m => m.id}
            renderItem={renderMessage}
            inverted
            contentContainerStyle={styles.messageList}
            ListFooterComponent={listingCard}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', paddingTop: 48 }}>
                <Text style={{ fontSize: 32, marginBottom: 12 }}>👋</Text>
                <Text style={{ fontSize: font.sm, fontWeight: '600', color: colors.foreground, marginBottom: 4 }}>Start the conversation</Text>
                <Text style={{ fontSize: font.xs, color: colors.foregroundMuted }}>Say hello and discuss the match!</Text>
              </View>
            }
          />
        )}

        {/* Input */}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={newMsg}
            onChangeText={setNewMsg}
            placeholder="Type a message…"
            placeholderTextColor={colors.foregroundMuted}
            multiline
            onSubmitEditing={sendMessage}
            returnKeyType="send"
          />
          <TouchableOpacity
            style={[styles.sendBtn, { opacity: newMsg.trim() && !sending ? 1 : 0.4 }]}
            onPress={sendMessage}
            disabled={!newMsg.trim() || sending}
          >
            {sending ? <ActivityIndicator size="small" color="#fff" /> : <Send size={18} color="#fff" />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: colors.background },
  header:           { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: spacing.lg, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn:          { padding: 4, marginRight: 2 },
  avatar:           { width: 36, height: 36, borderRadius: radius.md },
  headerName:       { fontSize: font.sm, fontWeight: '600', color: colors.foreground },
  headerSub:        { fontSize: 11, color: colors.foregroundMuted, marginTop: 1 },
  messageList:      { padding: spacing.lg, gap: 6 },
  bubble:           { maxWidth: '78%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMe:         { backgroundColor: colors.accent, borderBottomRightRadius: 4 },
  bubbleThem:       { backgroundColor: colors.card, borderBottomLeftRadius: 4 },
  bubbleText:       { fontSize: font.sm, lineHeight: 20 },
  offerCard:        { backgroundColor: colors.card, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, marginBottom: 6, overflow: 'hidden' },
  offerHeader:      { padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  offerLabel:       { fontSize: 10, color: colors.foregroundMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  offerAmount:      { fontSize: 32, fontWeight: '800', color: colors.foreground },
  offerSubtext:     { fontSize: 11, color: colors.foregroundMuted, marginTop: 2 },
  offerActions:     { flexDirection: 'row' },
  offerBtn:         { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 14 },
  offerBtnDecline:  {},
  offerBtnAccept:   {},
  offerBtnText:     { fontSize: font.xs, fontWeight: '600' },
  offerDivider:     { width: 1, backgroundColor: colors.border },
  counterContainer: { padding: spacing.lg },
  counterInput:     { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.muted, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, marginTop: 8 },
  counterSym:       { fontSize: 22, fontWeight: '700', color: colors.foregroundMuted, marginRight: 6 },
  counterField:     { flex: 1, fontSize: 22, fontWeight: '700', color: colors.foreground },
  listingCard:      { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: 12, marginTop: 12 },
  listingThumb:     { width: 52, height: 52, borderRadius: radius.md },
  inputRow:         { flexDirection: 'row', alignItems: 'flex-end', gap: 10, padding: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.card },
  input:            { flex: 1, minHeight: 44, maxHeight: 120, backgroundColor: colors.muted, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: font.sm, color: colors.foreground },
  sendBtn:          { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
});

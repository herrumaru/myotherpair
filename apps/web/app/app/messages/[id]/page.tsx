'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '../../../../lib/supabase';
import { ArrowLeft, Send, Check, X, RefreshCw } from 'lucide-react';
import { formatSizeLabel } from '../../../../lib/sizeConversion';
import { getCurrencySymbol } from '../../../../lib/currency';

interface Message {
  id: string;
  from: 'me' | 'them';
  text: string;
  time: string;
  timestamp: string;
}

interface MatchInfo {
  otherUserName: string;
  otherUserAvatar: string | null;
  listingId: string | null;
  listingBrand: string;
  listingModel: string;
  listingSize: string;
  listingPrice: number | null;
  listingCurrency: string;
  listingPhoto: string | null;
}

interface OfferPayload {
  type: 'offer';
  amount: number;
  currency: string;
}

function parseOffer(text: string): OfferPayload | null {
  try {
    const p = JSON.parse(text);
    if (p.type === 'offer' && typeof p.amount === 'number') return p as OfferPayload;
  } catch {}
  return null;
}

export default function MessageThreadPage() {
  const params  = useParams<{ id: string }>();
  const matchId = params.id;
  const [userId,        setUserId]        = useState<string | null>(null);
  const [isUser1,       setIsUser1]       = useState<boolean | null>(null);
  const [matchInfo,     setMatchInfo]     = useState<MatchInfo | null>(null);
  const [messages,      setMessages]      = useState<Message[]>([]);
  const [newMsg,        setNewMsg]        = useState('');
  const [sending,       setSending]       = useState(false);
  const [loading,       setLoading]       = useState(true);
  // Counter offer state: keyed by message id
  const [counterInputs, setCounterInputs] = useState<Record<string, string>>({});
  const [showCounter,   setShowCounter]   = useState<Record<string, boolean>>({});
  const bottomRef = useRef<HTMLDivElement>(null);

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
        .eq('id', matchId)
        .single();

      if (!data) return;
      const r          = data as { id: string; user_id_1: string; user_id_2: string; listing_id_1: string; listing_id_2: string };
      const isUser1Val = r.user_id_1 === userId;
      setIsUser1(isUser1Val);
      const otherId   = isUser1Val ? r.user_id_2 : r.user_id_1;
      const listingId = isUser1Val ? r.listing_id_2 : r.listing_id_1;

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
        listingSize:     listing?.size != null ? String(listing.size) : '',
        listingPrice:    (listing?.price as number | null) ?? null,
        listingCurrency: (listing?.currency as string) ?? 'USD',
        listingPhoto:    photos[0] ?? null,
      });
    })();
  }, [userId, matchId]);

  // Mark conversation as read when opened, then signal nav to clear the badge
  useEffect(() => {
    if (!userId || !matchId || isUser1 === null) return;
    const col = isUser1 ? 'user1_last_read_at' : 'user2_last_read_at';
    supabase.from('matches')
      .update({ [col]: new Date().toISOString() })
      .eq('id', matchId)
      .then(() => { window.dispatchEvent(new CustomEvent('conversation-read')); });
  }, [userId, matchId, isUser1]);

  // Load messages
  useEffect(() => {
    if (!userId || !matchId) return;
    (async () => {
      const { data } = await supabase
        .from('messages')
        .select('id, sender_id, content, created_at')
        .eq('match_id', matchId)
        .order('created_at', { ascending: true });

      if (data) {
        setMessages(
          (data as { id: string; sender_id: string; content: string; created_at: string }[]).map(m => ({
            id:        m.id,
            from:      m.sender_id === userId ? 'me' : 'them',
            text:      m.content,
            time:      new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            timestamp: m.created_at,
          })),
        );
      }
      setLoading(false);
    })();
  }, [userId, matchId]);

  // Real-time subscription
  useEffect(() => {
    if (!userId || !matchId) return;
    const channel = supabase
      .channel(`messages:${matchId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `match_id=eq.${matchId}`,
      }, payload => {
        const m = payload.new as { id: string; sender_id: string; content: string; created_at: string };
        setMessages(prev => {
          if (prev.some(msg => msg.id === m.id)) return prev;
          return [...prev, {
            id:        m.id,
            from:      m.sender_id === userId ? 'me' : 'them',
            text:      m.content,
            time:      new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            timestamp: m.created_at,
          }];
        });
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.warn('[Realtime] Channel error on messages:', matchId);
        }
      });
    return () => { supabase.removeChannel(channel); };
  }, [userId, matchId]);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Core send — used by both the input field and offer action buttons
  const sendContent = async (text: string) => {
    if (!userId || !matchId) return;
    const tempId = `opt-${Date.now()}`;
    setMessages(prev => [...prev, {
      id: tempId, from: 'me', text,
      time:      new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: new Date().toISOString(),
    }]);
    const { data: inserted } = await supabase
      .from('messages')
      .insert({ match_id: matchId, sender_id: userId, content: text })
      .select('id').single();
    if (inserted) {
      const realId = (inserted as { id: string }).id;
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, id: realId } : m));
    }
  };

  const sendMessage = async () => {
    if (!newMsg.trim() || sending) return;
    const text = newMsg.trim().slice(0, 2000);
    setNewMsg('');
    setSending(true);
    await sendContent(text);
    setSending(false);
  };

  const handleAccept = (offer: OfferPayload) => {
    const sym = getCurrencySymbol(offer.currency);
    sendContent(`✅ I accept your offer of ${sym}${offer.amount}! Let's proceed.`);
  };

  const handleDecline = (offer: OfferPayload) => {
    const sym = getCurrencySymbol(offer.currency);
    sendContent(`Sorry, I can't accept the ${sym}${offer.amount} offer.`);
  };

  const handleCounter = (msgId: string, offer: OfferPayload) => {
    const amount = parseFloat(counterInputs[msgId] ?? '');
    if (!amount || amount <= 0) return;
    sendContent(JSON.stringify({ type: 'offer', amount, currency: offer.currency }));
    setShowCounter(p => ({ ...p, [msgId]: false }));
    setCounterInputs(p => ({ ...p, [msgId]: '' }));
  };

  // ── Render offer bubble ────────────────────────────────────────────────────
  const renderOffer = (msg: Message, offer: OfferPayload) => {
    const isMine   = msg.from === 'me';
    const sym      = getCurrencySymbol(offer.currency);
    const isCountering = showCounter[msg.id];

    return (
      <div className="flex justify-center px-2">
        <div className="w-full max-w-[85%] bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          {/* Header */}
          <div className="px-4 pt-4 pb-3 border-b border-border/50">
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-1">
              {isMine ? 'Your offer' : `Offer from ${matchInfo?.otherUserName ?? 'them'}`}
            </p>
            <p className="text-[32px] font-bold text-foreground leading-none">
              {sym}{offer.amount}
            </p>
            {matchInfo?.listingPrice != null && (
              <p className="text-[11px] text-muted-foreground mt-1">
                Asking {sym}{matchInfo.listingPrice}
                {' '}·{' '}
                {Math.round((1 - offer.amount / matchInfo.listingPrice) * 100)}% below
              </p>
            )}
          </div>

          {/* Actions — only shown to the recipient */}
          {!isMine && (
            isCountering ? (
              <div className="px-4 py-3 space-y-2">
                <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">Counter offer ({offer.currency})</p>
                <div className="flex items-center gap-2 bg-muted/40 rounded-xl px-3 py-2">
                  <span className="text-[20px] font-bold text-muted-foreground/50">{sym}</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="1"
                    step="1"
                    autoFocus
                    value={counterInputs[msg.id] ?? ''}
                    onChange={e => setCounterInputs(p => ({ ...p, [msg.id]: e.target.value }))}
                    placeholder="0"
                    className="flex-1 bg-transparent text-foreground text-[20px] font-bold outline-none placeholder:text-muted-foreground/30"
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => setShowCounter(p => ({ ...p, [msg.id]: false }))}
                    className="flex-1 h-10 rounded-xl border border-border text-foreground text-[13px] font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleCounter(msg.id, offer)}
                    disabled={!counterInputs[msg.id] || parseFloat(counterInputs[msg.id] ?? '0') <= 0}
                    className="flex-1 h-10 rounded-xl bg-foreground text-background text-[13px] font-semibold disabled:opacity-30"
                  >
                    Send counter
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex divide-x divide-border">
                <button
                  onClick={() => handleDecline(offer)}
                  className="flex-1 py-3.5 flex items-center justify-center gap-1.5 text-[13px] font-semibold text-destructive active:bg-muted/40 transition-colors"
                >
                  <X className="h-3.5 w-3.5" /> Decline
                </button>
                <button
                  onClick={() => setShowCounter(p => ({ ...p, [msg.id]: true }))}
                  className="flex-1 py-3.5 flex items-center justify-center gap-1.5 text-[13px] font-semibold text-muted-foreground active:bg-muted/40 transition-colors"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Counter
                </button>
                <button
                  onClick={() => handleAccept(offer)}
                  className="flex-1 py-3.5 flex items-center justify-center gap-1.5 text-[13px] font-semibold text-accent active:bg-muted/40 transition-colors"
                >
                  <Check className="h-3.5 w-3.5" /> Accept
                </button>
              </div>
            )
          )}

          {isMine && (
            <div className="px-4 py-3">
              <p className="text-[12px] text-muted-foreground text-center">Waiting for response…</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="h-dvh flex flex-col bg-background">
      {/* Header */}
      <header className="bg-background border-b border-border px-4 py-3 flex items-center gap-3 flex-shrink-0">
        <Link href="/app/messages" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          {matchInfo?.otherUserAvatar ? (
            <img src={matchInfo.otherUserAvatar} alt="" className="w-9 h-9 rounded-xl object-cover flex-shrink-0" />
          ) : (
            <div className="w-9 h-9 rounded-xl bg-accent/20 flex items-center justify-center text-sm font-bold text-accent flex-shrink-0">
              {matchInfo?.otherUserName?.[0] ?? '?'}
            </div>
          )}
          <div className="min-w-0">
            <p className="font-semibold text-sm text-foreground truncate">{matchInfo?.otherUserName ?? 'User'}</p>
            {matchInfo && (matchInfo.listingBrand || matchInfo.listingModel) && (
              <p className="text-[11px] text-muted-foreground truncate">
                {matchInfo.listingBrand} {matchInfo.listingModel}
                {matchInfo.listingSize ? ` · ${formatSizeLabel(matchInfo.listingSize, 'UK')}` : ''}
              </p>
            )}
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Listing context card */}
        {matchInfo && (matchInfo.listingBrand || matchInfo.listingModel) && (
          <Link
            href={matchInfo.listingId ? `/app/listing/${matchInfo.listingId}` : '#'}
            className="flex items-center gap-3 bg-card border border-border rounded-2xl p-3 mb-2"
          >
            {matchInfo.listingPhoto ? (
              <img src={matchInfo.listingPhoto} alt="" className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center text-2xl flex-shrink-0">👟</div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-0.5">Listing</p>
              <p className="text-[13px] font-semibold text-foreground truncate">{matchInfo.listingBrand} {matchInfo.listingModel}</p>
              {matchInfo.listingSize && (
                <p className="text-[12px] text-muted-foreground">{formatSizeLabel(matchInfo.listingSize, 'UK')}</p>
              )}
            </div>
            {matchInfo.listingPrice != null && (
              <p className="text-[16px] font-bold text-foreground flex-shrink-0">
                {getCurrencySymbol(matchInfo.listingCurrency)}{matchInfo.listingPrice}
              </p>
            )}
          </Link>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-16">
            <span className="text-3xl block mb-3">👋</span>
            <p className="text-sm font-medium text-foreground mb-1">Start the conversation</p>
            <p className="text-xs text-muted-foreground">Say hello and discuss the match!</p>
          </div>
        ) : (
          messages.map((msg, i) => {
            const isMine = msg.from === 'me';
            const showTimestamp = i === 0 ||
              new Date(msg.timestamp).getTime() - new Date(messages[i - 1].timestamp).getTime() > 300_000;
            const offer = parseOffer(msg.text);

            return (
              <div key={msg.id}>
                {showTimestamp && (
                  <p className="text-[10px] text-muted-foreground text-center mb-2">{msg.time}</p>
                )}
                {offer ? (
                  renderOffer(msg, offer)
                ) : (
                  <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm ${
                        isMine
                          ? 'gradient-warm text-accent-foreground rounded-br-md shadow-sm'
                          : 'bg-muted text-foreground rounded-bl-md'
                      }`}
                    >
                      <p className="leading-relaxed">{msg.text}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border/30 p-3 flex gap-2 bg-card/80 backdrop-blur-sm flex-shrink-0">
        <input
          value={newMsg}
          onChange={e => setNewMsg(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 rounded-full h-11 px-4 bg-muted/50 border border-border/30 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-accent/50 transition-colors"
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
        />
        <button
          onClick={sendMessage}
          disabled={!newMsg.trim() || sending}
          className="rounded-full h-11 w-11 gradient-warm flex items-center justify-center shadow-sm disabled:opacity-40 transition-opacity"
          aria-label="Send"
        >
          <Send className="h-4 w-4 text-accent-foreground" />
        </button>
      </div>
    </div>
  );
}

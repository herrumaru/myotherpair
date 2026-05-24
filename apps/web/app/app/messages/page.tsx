'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase';
import { MessageCircle } from 'lucide-react';

interface Conversation {
  id: string;
  otherUserName: string;
  otherUserAvatar: string | null;
  lastMessage: string;
  lastMessageTime: string;
}

export default function MessagesPage() {
  const [userId,        setUserId]        = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading,       setLoading]       = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setUserId(session.user.id);
    });
  }, []);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      // 1. Load matches
      const { data: matches } = await supabase
        .from('matches')
        .select('id, created_at, user_id_1, user_id_2')
        .or(`user_id_1.eq.${userId},user_id_2.eq.${userId}`)
        .order('created_at', { ascending: false });

      if (!matches || matches.length === 0) {
        setLoading(false);
        return;
      }

      const rawMatches = matches as { id: string; created_at: string; user_id_1: string; user_id_2: string }[];

      // 2. Collect other user IDs and load profiles separately
      const otherIds = [...new Set(rawMatches.map(m => m.user_id_1 === userId ? m.user_id_2 : m.user_id_1))];
      const profileMap: Record<string, { name: string; avatar_url: string | null }> = {};
      if (otherIds.length) {
        const { data: profiles } = await supabase
          .from('users')
          .select('id, name, avatar_url')
          .in('id', otherIds);
        (profiles ?? []).forEach((p: Record<string, unknown>) => {
          profileMap[p.id as string] = {
            name:       (p.name as string) ?? 'User',
            avatar_url: (p.avatar_url as string | null) ?? null,
          };
        });
      }

      // 3. Load latest message per match
      const matchIds = rawMatches.map(m => m.id);
      const latestMsg: Record<string, { content: string; created_at: string }> = {};
      if (matchIds.length) {
        const { data: allMessages } = await supabase
          .from('messages')
          .select('match_id, content, created_at')
          .in('match_id', matchIds)
          .order('created_at', { ascending: false });
        (allMessages ?? []).forEach((m: Record<string, unknown>) => {
          const mid = m.match_id as string;
          if (!latestMsg[mid]) {
            latestMsg[mid] = { content: m.content as string, created_at: m.created_at as string };
          }
        });
      }

      // 4. Assemble conversations
      const mapped: Conversation[] = rawMatches.map(m => {
        const otherId  = m.user_id_1 === userId ? m.user_id_2 : m.user_id_1;
        const prof     = profileMap[otherId];
        const latest   = latestMsg[m.id];
        return {
          id:              m.id,
          otherUserName:   prof?.name ?? 'User',
          otherUserAvatar: prof?.avatar_url ?? null,
          lastMessage:     latest?.content ?? '',
          lastMessageTime: (latest?.created_at ?? m.created_at)
            ? new Date(latest?.created_at ?? m.created_at)
                .toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
            : '',
        };
      });

      setConversations(mapped);
      setLoading(false);
    })();
  }, [userId]);

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-black/8 px-5 flex items-center h-14">
        <h1 className="font-display text-[17px] font-bold text-foreground tracking-[-0.01em]">Messages</h1>
      </header>

      <div className="max-w-lg mx-auto">
        {loading ? (
          <>
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} className="flex items-center gap-3 px-4 py-4 border-b border-border/30">
                <div className="w-12 h-12 rounded-xl bg-muted animate-pulse flex-shrink-0" />
                <div className="flex-1">
                  <div className="h-3 w-24 rounded bg-muted animate-pulse mb-2" />
                  <div className="h-2.5 w-36 rounded bg-muted animate-pulse" />
                </div>
              </div>
            ))}
          </>
        ) : conversations.length > 0 ? (
          conversations.map((conv, i) => (
            <Link
              key={conv.id}
              href={`/app/messages/${conv.id}`}
              className={`flex items-center gap-3.5 px-5 py-4 border-b border-black/6 hover:bg-black/[0.02] active:bg-black/[0.04] transition-colors opacity-0 animate-fade-in stagger-${Math.min(i + 1, 6)}`}
            >
              <div className="flex-shrink-0">
                {conv.otherUserAvatar ? (
                  <img src={conv.otherUserAvatar} alt="" className="w-[46px] h-[46px] rounded-full object-cover" />
                ) : (
                  <div className="w-[46px] h-[46px] rounded-full bg-black/8 flex items-center justify-center text-[15px] font-bold text-foreground">
                    {conv.otherUserName[0]}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <p className="font-semibold text-[14px] text-foreground">{conv.otherUserName}</p>
                  <span className="text-[11px] text-black/30">{conv.lastMessageTime}</span>
                </div>
                <p className="text-[13px] text-black/40 truncate">
                  {conv.lastMessage || 'Start the conversation'}
                </p>
              </div>
            </Link>
          ))
        ) : (
          <div className="text-center py-20 px-4 animate-fade-in">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <MessageCircle className="h-7 w-7 text-muted-foreground/40" />
            </div>
            <p className="font-semibold text-foreground mb-1">No messages yet</p>
            <p className="text-sm text-muted-foreground">
              Match with someone on the discover tab to start chatting.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { supabase } from '../../lib/supabase';

type MatchRow = {
  id: string;
  user_id_1: string;
  user_id_2: string;
  user1_last_read_at: string | null;
  user2_last_read_at: string | null;
};

export function useUnreadCount(userId: string | null, disabled = false): number {
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);

  const fetchUnread = useCallback(async () => {
    if (!userId || disabled) { setUnread(0); return; }

    const { data: matches } = await supabase
      .from('matches')
      .select('id, user_id_1, user_id_2, user1_last_read_at, user2_last_read_at')
      .or(`user_id_1.eq.${userId},user_id_2.eq.${userId}`);

    if (!matches?.length) { setUnread(0); return; }

    const rows = matches as MatchRow[];
    const matchIds = rows.map(m => m.id);
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: msgs } = await supabase
      .from('messages')
      .select('match_id, created_at')
      .in('match_id', matchIds)
      .neq('sender_id', userId)
      .gte('created_at', since);

    if (!msgs) { setUnread(0); return; }

    const matchMap = new Map(rows.map(m => [m.id, m]));
    const unreadSet = new Set<string>();

    for (const msg of msgs as { match_id: string; created_at: string }[]) {
      const match = matchMap.get(msg.match_id);
      if (!match) continue;
      const lastRead = match.user_id_1 === userId
        ? match.user1_last_read_at
        : match.user2_last_read_at;
      if (!lastRead || new Date(msg.created_at) > new Date(lastRead)) {
        unreadSet.add(msg.match_id);
      }
    }

    setUnread(unreadSet.size);
  }, [userId, disabled]);

  // Re-fetch on navigation
  useEffect(() => {
    fetchUnread();
  }, [fetchUnread, pathname]);

  // Re-fetch when a conversation is explicitly marked read (fired by the chat page)
  useEffect(() => {
    window.addEventListener('conversation-read', fetchUnread);
    return () => window.removeEventListener('conversation-read', fetchUnread);
  }, [fetchUnread]);

  return unread;
}

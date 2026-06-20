import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MessageCircle } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { colors, spacing, radius, font } from '../../lib/theme';

interface Conversation {
  matchId: string;
  otherId: string;
  otherName: string;
  otherAvatar: string | null;
  lastMessage: string;
  lastAt: string;
  listing: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function MessagesScreen() {
  const router = useRouter();
  const [userId,       setUserId]       = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading,      setLoading]      = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setUserId(session.user.id);
    });
  }, []);

  useEffect(() => {
    if (!userId) return;
    loadConversations(userId);
  }, [userId]);

  async function loadConversations(uid: string) {
    setLoading(true);
    const { data: matches } = await supabase
      .from('matches')
      .select('id, user_id_1, user_id_2, listing_id_1, listing_id_2, created_at')
      .or(`user_id_1.eq.${uid},user_id_2.eq.${uid}`)
      .order('created_at', { ascending: false });

    if (!matches?.length) { setLoading(false); return; }

    const otherIds = matches.map(m => m.user_id_1 === uid ? m.user_id_2 : m.user_id_1);
    const { data: profiles } = await supabase
      .from('users').select('id, name, avatar_url').in('id', otherIds);
    const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]));

    // Load last message for each match
    const convs: Conversation[] = await Promise.all(matches.map(async m => {
      const otherId = m.user_id_1 === uid ? m.user_id_2 : m.user_id_1;
      const other   = profileMap[otherId] ?? { name: 'Unknown', avatar_url: null };
      const listingId = m.user_id_1 === uid ? m.listing_id_2 : m.listing_id_1;

      const { data: lastMsg } = await supabase
        .from('messages')
        .select('content, created_at')
        .eq('match_id', m.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      return {
        matchId:     m.id,
        otherId,
        otherName:   other.name,
        otherAvatar: other.avatar_url,
        lastMessage: lastMsg?.content ?? 'No messages yet',
        lastAt:      lastMsg?.created_at ?? m.created_at ?? '',
        listing:     listingId ?? '',
      };
    }));

    setConversations(convs);
    setLoading(false);
  }

  if (loading) {
    return (
      <SafeAreaView style={[s.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.accent} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Messages</Text>
      </View>

      {conversations.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg }}>
          <MessageCircle size={48} color={colors.foregroundMuted} style={{ opacity: 0.4, marginBottom: spacing.md }} />
          <Text style={s.emptyTitle}>No matches yet</Text>
          <Text style={s.emptyBody}>When you match with someone, your conversation will appear here.</Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={item => item.matchId}
          contentContainerStyle={{ paddingBottom: 100 }}
          ItemSeparatorComponent={() => <View style={s.sep} />}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={s.row}
              onPress={() => router.push(`/conversation/${item.matchId}` as any)}
              activeOpacity={0.7}
            >
              {item.otherAvatar ? (
                <Image source={{ uri: item.otherAvatar }} style={s.avatar} />
              ) : (
                <View style={s.avatarPlaceholder}>
                  <Text style={s.avatarInitial}>{item.otherName[0]?.toUpperCase() ?? '?'}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={s.name}>{item.otherName}</Text>
                  <Text style={s.time}>{timeAgo(item.lastAt)}</Text>
                </View>
                <Text style={s.preview} numberOfLines={1}>{item.lastMessage}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:              { flex: 1, backgroundColor: colors.background },
  header:            { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle:       { fontSize: font.xl, fontWeight: '700', color: colors.foreground },
  row:               { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, paddingHorizontal: spacing.lg },
  sep:               { height: 1, backgroundColor: colors.border, marginHorizontal: spacing.lg },
  avatar:            { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.card },
  avatarPlaceholder: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.accent + '33', alignItems: 'center', justifyContent: 'center' },
  avatarInitial:     { fontSize: font.md, fontWeight: '700', color: colors.accent },
  name:              { fontSize: font.base, fontWeight: '700', color: colors.foreground },
  time:              { fontSize: font.xs, color: colors.foregroundMuted },
  preview:           { fontSize: font.sm, color: colors.foregroundMuted, marginTop: 2 },
  emptyTitle:        { fontSize: font.lg, fontWeight: '700', color: colors.foreground, marginBottom: 8, textAlign: 'center' },
  emptyBody:         { fontSize: font.sm, color: colors.foregroundMuted, textAlign: 'center', lineHeight: 20 },
});

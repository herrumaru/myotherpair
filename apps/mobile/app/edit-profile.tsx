import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, Switch, Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { ArrowLeft, Camera, User } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { colors, spacing, font, radius } from '../lib/theme';

interface ProfileForm {
  name: string;
  location: string;
  bio: string;
  foot_size_left: string;
  foot_size_right: string;
  is_amputee: boolean;
  avatar_url: string;
}

export default function EditProfileScreen() {
  const router = useRouter();
  const [userId,  setUserId]  = useState<string | null>(null);
  const [form,    setForm]    = useState<ProfileForm>({
    name: '', location: '', bio: '', foot_size_left: '', foot_size_right: '', is_amputee: false, avatar_url: '',
  });
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { router.replace('/login'); return; }
      setUserId(session.user.id);

      const { data } = await supabase.from('users').select('*').eq('id', session.user.id).single();
      if (data) {
        const d = data as Record<string, unknown>;
        setForm({
          name:           (d.name as string)           ?? '',
          location:       (d.location as string)       ?? '',
          bio:            (d.bio as string)             ?? '',
          foot_size_left: d.foot_size_left != null ? String(d.foot_size_left) : '',
          foot_size_right:d.foot_size_right != null ? String(d.foot_size_right) : '',
          is_amputee:     !!(d.is_amputee),
          avatar_url:     (d.avatar_url as string)     ?? '',
        });
      }
      setLoading(false);
    })();
  }, []);

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if (!userId) return;

    setUploading(true);
    const ext  = asset.uri.split('.').pop() ?? 'jpg';
    const path = `avatars/${userId}/avatar.${ext}`;

    const formData = new FormData();
    formData.append('file', { uri: asset.uri, name: `avatar.${ext}`, type: `image/${ext}` } as never);

    const { error } = await supabase.storage.from('avatars').upload(path, formData, { upsert: true });
    if (error) { Alert.alert('Upload failed', error.message); setUploading(false); return; }

    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
    setForm(f => ({ ...f, avatar_url: urlData.publicUrl }));
    setUploading(false);
  };

  const handleSave = async () => {
    if (!userId) return;
    if (!form.name.trim()) { Alert.alert('Name required'); return; }

    setSaving(true);
    const { error } = await supabase.from('users').update({
      name:            form.name.trim(),
      location:        form.location.trim() || null,
      bio:             form.bio.trim()      || null,
      foot_size_left:  form.foot_size_left  ? parseFloat(form.foot_size_left)  : null,
      foot_size_right: form.foot_size_right ? parseFloat(form.foot_size_right) : null,
      is_amputee:      form.is_amputee,
      avatar_url:      form.avatar_url      || null,
    }).eq('id', userId);
    setSaving(false);

    if (error) { Alert.alert('Save failed', error.message); return; }
    Alert.alert('Saved!', 'Your profile has been updated.', [
      { text: 'OK', onPress: () => router.back() },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={s.root}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <ArrowLeft size={20} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Edit Profile</Text>
        <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator size="small" color={colors.accent} /> : <Text style={s.saveBtnText}>Save</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        {/* Avatar */}
        <View style={{ alignItems: 'center', marginBottom: spacing.xl }}>
          <TouchableOpacity onPress={pickAvatar} style={s.avatarWrap} disabled={uploading}>
            {form.avatar_url ? (
              <Image source={{ uri: form.avatar_url }} style={s.avatar} contentFit="cover" />
            ) : (
              <View style={[s.avatar, { backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center' }]}>
                <User size={32} color={colors.foregroundMuted} />
              </View>
            )}
            <View style={s.cameraOverlay}>
              {uploading ? <ActivityIndicator size="small" color="#fff" /> : <Camera size={16} color="#fff" />}
            </View>
          </TouchableOpacity>
          <Text style={{ fontSize: font.xs, color: colors.foregroundMuted, marginTop: 8 }}>Tap to change photo</Text>
        </View>

        {/* Name */}
        <View style={s.field}>
          <Text style={s.label}>Display name *</Text>
          <TextInput
            style={s.input} value={form.name} onChangeText={v => setForm(f => ({ ...f, name: v }))}
            placeholder="Your name" placeholderTextColor={colors.foregroundMuted} selectionColor={colors.accent}
          />
        </View>

        {/* Location */}
        <View style={s.field}>
          <Text style={s.label}>Location</Text>
          <TextInput
            style={s.input} value={form.location} onChangeText={v => setForm(f => ({ ...f, location: v }))}
            placeholder="City, Country" placeholderTextColor={colors.foregroundMuted} selectionColor={colors.accent}
          />
        </View>

        {/* Bio */}
        <View style={s.field}>
          <Text style={s.label}>Looking for</Text>
          <TextInput
            style={[s.input, { height: 88, textAlignVertical: 'top', paddingTop: 14 }]}
            value={form.bio} onChangeText={v => setForm(f => ({ ...f, bio: v }))}
            multiline placeholder="Describe the shoe you're searching for…" placeholderTextColor={colors.foregroundMuted}
            selectionColor={colors.accent}
          />
        </View>

        {/* Foot sizes */}
        <Text style={[s.label, { marginBottom: 10 }]}>Shoe sizes (UK)</Text>
        <View style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md }}>
          <View style={[s.field, { flex: 1, marginBottom: 0 }]}>
            <Text style={[s.label, { color: colors.leftShoe }]}>Left foot</Text>
            <TextInput
              style={s.input} value={form.foot_size_left} onChangeText={v => setForm(f => ({ ...f, foot_size_left: v }))}
              placeholder="e.g. 9" placeholderTextColor={colors.foregroundMuted} keyboardType="decimal-pad"
              selectionColor={colors.accent}
            />
          </View>
          <View style={[s.field, { flex: 1, marginBottom: 0 }]}>
            <Text style={[s.label, { color: colors.rightShoe }]}>Right foot</Text>
            <TextInput
              style={s.input} value={form.foot_size_right} onChangeText={v => setForm(f => ({ ...f, foot_size_right: v }))}
              placeholder="e.g. 10" placeholderTextColor={colors.foregroundMuted} keyboardType="decimal-pad"
              selectionColor={colors.accent}
            />
          </View>
        </View>

        {/* Amputee toggle */}
        <View style={s.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.toggleLabel}>I am an amputee</Text>
            <Text style={s.toggleSub}>This helps us find better matches for you</Text>
          </View>
          <Switch
            value={form.is_amputee}
            onValueChange={v => setForm(f => ({ ...f, is_amputee: v }))}
            trackColor={{ false: colors.border, true: colors.accent + '88' }}
            thumbColor={form.is_amputee ? colors.accent : colors.foregroundMuted}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:          { flex: 1, backgroundColor: colors.background },
  header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn:       { padding: 4 },
  headerTitle:   { fontSize: font.lg, fontWeight: '700', color: colors.foreground },
  saveBtn:       { paddingHorizontal: 16, paddingVertical: 6, borderRadius: radius.full, backgroundColor: colors.accent + '22' },
  saveBtnText:   { fontSize: font.sm, fontWeight: '700', color: colors.accent },
  avatarWrap:    { position: 'relative' },
  avatar:        { width: 90, height: 90, borderRadius: 45 },
  cameraOverlay: { position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  field:         { marginBottom: spacing.md },
  label:         { fontSize: 11, fontWeight: '700', color: colors.foregroundMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  input:         { backgroundColor: colors.card, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, height: 50, color: colors.foreground, fontSize: font.sm },
  toggleRow:     { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.md },
  toggleLabel:   { fontSize: font.sm, fontWeight: '600', color: colors.foreground },
  toggleSub:     { fontSize: font.xs, color: colors.foregroundMuted, marginTop: 2 },
});

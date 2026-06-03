'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../../lib/supabase';
import { motion } from 'framer-motion';
import { ArrowLeft, Camera, Check } from 'lucide-react';
import { Button } from '../../../components/ui/Button';

const UK_SIZES = [3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10, 10.5, 11, 11.5, 12, 13, 14];

export default function EditProfilePage() {
  const router    = useRouter();
  const avatarRef = useRef<HTMLInputElement>(null);

  const [userId,        setUserId]        = useState<string | null>(null);
  const [saving,        setSaving]        = useState(false);
  const [error,         setError]         = useState('');
  const [avatarFile,    setAvatarFile]    = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [currentAvatar, setCurrentAvatar] = useState<string | null>(null);

  const [form, setForm] = useState({
    name:      '',
    location:  '',
    leftSize:  '',
    rightSize: '',
    bio:       '',
    isAmputee: false,
  });

  const update = (key: string, value: string | boolean) =>
    setForm(prev => ({ ...prev, [key]: value }));

  // Load existing profile
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) return;
      setUserId(session.user.id);
      const { data } = await supabase
        .from('users')
        .select('name, location, foot_size_left, foot_size_right, is_amputee, avatar_url, bio')
        .eq('id', session.user.id)
        .single();
      if (data) {
        const d = data as {
          name?: string; location?: string;
          foot_size_left?: number | null; foot_size_right?: number | null;
          is_amputee?: boolean; avatar_url?: string | null; bio?: string | null;
        };
        setForm({
          name:      d.name      ?? '',
          location:  d.location  ?? '',
          leftSize:  d.foot_size_left  != null ? String(d.foot_size_left)  : '',
          rightSize: d.foot_size_right != null ? String(d.foot_size_right) : '',
          bio:       d.bio ?? '',
          isAmputee: d.is_amputee ?? false,
        });
        if (d.avatar_url) setCurrentAvatar(d.avatar_url);
      }
    });
  }, []);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Name is required'); return; }
    if (!form.location.trim()) { setError('Location is required'); return; }
    if (!userId) return;

    setSaving(true);
    setError('');

    try {
      let avatar_url = currentAvatar;

      if (avatarFile) {
        const ext  = avatarFile.name.split('.').pop() ?? 'jpg';
        const path = `${userId}/avatar.${ext}`;
        const { data: stored, error: uploadErr } = await supabase.storage
          .from('avatars').upload(path, avatarFile, { upsert: true });
        if (uploadErr) throw uploadErr;
        if (stored) {
          const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
          avatar_url = publicUrl;
        }
      }

      const { error: updateErr } = await supabase.from('users').update({
        name:            form.name.trim(),
        location:        form.location.trim(),
        foot_size_left:  form.leftSize  ? parseFloat(form.leftSize)  : null,
        foot_size_right: form.rightSize ? parseFloat(form.rightSize) : null,
        is_amputee:      form.isAmputee,
        bio:             form.bio.trim() || null,
        ...(avatar_url ? { avatar_url } : {}),
      }).eq('id', userId);

      if (updateErr) throw updateErr;
      router.push('/app/profile');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save. Please try again.');
      setSaving(false);
    }
  };

  const displayAvatar = avatarPreview ?? currentAvatar;
  const inputCls = 'w-full h-12 rounded-xl bg-card border border-border/40 text-sm text-foreground px-3 outline-none focus:border-accent/50 transition-colors placeholder:text-muted-foreground';
  const selectCls = `${inputCls} appearance-none`;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background border-b border-black/[0.07]">
        <div className="flex items-center justify-between px-5 h-14 max-w-lg mx-auto">
          <button onClick={() => router.back()} className="w-8 h-8 flex items-center justify-center -ml-1">
            <ArrowLeft className="h-5 w-5 text-black/50" />
          </button>
          <h1 className="text-[15px] font-semibold text-foreground">Edit Profile</h1>
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-[15px] font-semibold text-accent disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-5 pt-8 pb-12">
        {/* Avatar */}
        <motion.div
          className="flex justify-center mb-8"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="relative group">
            {displayAvatar ? (
              <img
                src={displayAvatar}
                alt={form.name}
                className="w-24 h-24 rounded-full object-cover border-2 border-border/30"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-accent to-accent/60 flex items-center justify-center text-3xl font-bold text-accent-foreground border-2 border-border/30">
                {form.name ? form.name[0].toUpperCase() : '?'}
              </div>
            )}
            <label className="absolute inset-0 flex items-center justify-center rounded-full bg-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
              <Camera className="h-5 w-5 text-white" />
              <input
                ref={avatarRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </label>
          </div>
        </motion.div>

        {/* Form */}
        <motion.div
          className="space-y-5"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
        >
          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-[11px] text-muted-foreground/50 tracking-[0.12em] uppercase font-medium">Name</label>
            <input
              value={form.name}
              onChange={e => update('name', e.target.value)}
              placeholder="Your name"
              maxLength={100}
              className={inputCls}
            />
          </div>

          {/* Location */}
          <div className="space-y-1.5">
            <label className="text-[11px] text-muted-foreground/50 tracking-[0.12em] uppercase font-medium">Location</label>
            <input
              value={form.location}
              onChange={e => update('location', e.target.value)}
              placeholder="City, Country"
              maxLength={100}
              className={inputCls}
            />
          </div>

          {/* Foot sizes */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[11px] text-muted-foreground/50 tracking-[0.12em] uppercase font-medium">Left foot (UK)</label>
              <select
                value={form.leftSize}
                onChange={e => update('leftSize', e.target.value)}
                className={selectCls}
              >
                <option value="">Not set</option>
                {UK_SIZES.map(s => <option key={s} value={String(s)}>UK {s}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] text-muted-foreground/50 tracking-[0.12em] uppercase font-medium">Right foot (UK)</label>
              <select
                value={form.rightSize}
                onChange={e => update('rightSize', e.target.value)}
                className={selectCls}
              >
                <option value="">Not set</option>
                {UK_SIZES.map(s => <option key={s} value={String(s)}>UK {s}</option>)}
              </select>
            </div>
          </div>

          {/* Bio */}
          <div className="space-y-1.5">
            <label className="text-[11px] text-muted-foreground/50 tracking-[0.12em] uppercase font-medium">Currently searching for</label>
            <textarea
              value={form.bio}
              onChange={e => update('bio', e.target.value)}
              placeholder="e.g. Right Nike Dunk, UK 8"
              maxLength={200}
              rows={3}
              className="w-full rounded-xl bg-card border border-border/40 text-sm text-foreground px-3 py-2.5 outline-none focus:border-accent/50 transition-colors placeholder:text-muted-foreground resize-none"
            />
            <p className="text-[10px] text-muted-foreground/30 text-right">{form.bio.length}/200</p>
          </div>

          {/* Amputee toggle */}
          <button
            type="button"
            onClick={() => update('isAmputee', !form.isAmputee)}
            className="flex items-center gap-3 text-sm text-foreground/70 text-left w-full"
          >
            <div className={`w-10 h-6 rounded-full flex-shrink-0 flex items-center px-0.5 transition-colors ${form.isAmputee ? 'bg-accent' : 'bg-muted'}`}>
              <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${form.isAmputee ? 'translate-x-4' : 'translate-x-0'}`} />
            </div>
            I am an amputee / missing limb
          </button>

          {error && (
            <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-2.5">
              {error}
            </p>
          )}

          {/* Save button */}
          <Button
            onClick={handleSave}
            variant="hero"
            size="lg"
            disabled={saving}
            className="w-full rounded-xl text-base shadow-elevated hover:shadow-glow transition-shadow mt-4"
            style={{ height: 52 }}
          >
            <Check className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save changes'}
          </Button>
        </motion.div>
      </div>
    </div>
  );
}

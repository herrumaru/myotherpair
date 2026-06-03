'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '../../../../../lib/supabase';
import { Button } from '../../../../components/ui/Button';
import { ArrowLeft, ImagePlus } from 'lucide-react';
import {
  type SizeSystem,
  getSizes,
  formatSizeLabel,
  toUKCanonical,
  detectSizeSystem,
} from '../../../../../lib/sizeConversion';

type Foot      = 'L' | 'R' | 'single';
type Condition = 'new_with_tags' | 'new_without_tags' | 'excellent' | 'good' | 'fair' | 'poor';

const CONDITIONS: { value: Condition; label: string }[] = [
  { value: 'new_with_tags',    label: 'New (tags on)' },
  { value: 'new_without_tags', label: 'New'           },
  { value: 'excellent',        label: 'Excellent'     },
  { value: 'good',             label: 'Good'          },
  { value: 'fair',             label: 'Fair'          },
  { value: 'poor',             label: 'Poor'          },
];

const BRANDS = ['Nike','Adidas','Jordan','New Balance','Vans','Converse','Timberland','Puma','Reebok','Other'];

function SizeSystemToggle({ value, onChange }: { value: SizeSystem; onChange: (v: SizeSystem) => void }) {
  return (
    <div className="flex gap-1.5">
      {(['UK', 'US', 'EU'] as SizeSystem[]).map(sys => (
        <button
          key={sys}
          type="button"
          onClick={() => onChange(sys)}
          className={`flex-1 h-9 rounded-lg text-xs font-semibold border transition-all duration-200 ${
            value === sys
              ? 'bg-accent text-accent-foreground border-accent shadow-sm'
              : 'bg-card text-muted-foreground border-border/40 hover:border-border'
          }`}
        >
          {sys}
        </button>
      ))}
    </div>
  );
}

export default function EditListingPage() {
  const router  = useRouter();
  const params  = useParams<{ id: string }>();
  const fileRef = useRef<HTMLInputElement>(null);

  const [userId,       setUserId]       = useState<string | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [submitting,   setSubmitting]   = useState(false);
  const [error,        setError]        = useState('');
  const [photoFile,    setPhotoFile]    = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [sizeSystem,   setSizeSystem]   = useState<SizeSystem>('UK');

  const [form, setForm] = useState({
    brand: '', model: '', size: '', side: '' as Foot | '',
    condition: '' as Condition | '', price: '', description: '',
  });

  useEffect(() => {
    setSizeSystem(detectSizeSystem());
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) { router.replace('/login'); return; }
      setUserId(session.user.id);
    });
  }, [router]);

  // Load existing listing
  useEffect(() => {
    if (!params?.id) return;
    (async () => {
      const { data, error: fetchErr } = await supabase
        .from('listings')
        .select('shoe_brand, shoe_model, size, foot_side, condition, price, description, photos, user_id')
        .eq('id', params.id)
        .single();

      if (fetchErr || !data) { router.replace('/app/listings'); return; }

      // Only allow owner to edit
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id !== data.user_id) { router.replace('/app/listings'); return; }

      // Size is stored as UK canonical — display in user's preferred system
      // For simplicity, show as UK in the form (user can switch system)
      setForm({
        brand:       data.shoe_brand ?? '',
        model:       data.shoe_model ?? '',
        size:        String(data.size ?? ''),
        side:        (data.foot_side as Foot) ?? '',
        condition:   (data.condition as Condition) ?? '',
        price:       data.price != null ? String(data.price) : '',
        description: data.description ?? '',
      });

      if (Array.isArray(data.photos) && data.photos[0]) {
        setPhotoPreview(data.photos[0] as string);
      }

      setLoading(false);
    })();
  }, [params?.id, router]);

  const update = (key: string, value: string) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (photoPreview && photoFile) URL.revokeObjectURL(photoPreview);
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleSizeSystemChange = (sys: SizeSystem) => {
    setSizeSystem(sys);
    update('size', '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.brand || !form.model || !form.size || !form.side || !form.condition || !form.price) {
      setError('Please fill in all required fields.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      let photos: string[] | undefined;

      if (photoFile && userId) {
        const ext  = photoFile.name.split('.').pop() ?? 'jpg';
        const path = `${userId}/${Date.now()}.${ext}`;
        const { data: stored, error: uploadErr } = await supabase.storage
          .from('shoe-images')
          .upload(path, photoFile, { upsert: true });
        if (uploadErr) throw uploadErr;
        if (stored) {
          const { data: { publicUrl } } = supabase.storage.from('shoe-images').getPublicUrl(path);
          photos = [publicUrl];
        }
      }

      const ukSize = toUKCanonical(form.size, sizeSystem);

      const patch: Record<string, unknown> = {
        shoe_brand:  form.brand,
        shoe_model:  form.model,
        size:        ukSize,
        foot_side:   form.side,
        condition:   form.condition,
        price:       parseFloat(form.price),
        description: form.description || null,
      };
      if (photos) patch.photos = photos;

      const { error: updateErr } = await supabase
        .from('listings')
        .update(patch)
        .eq('id', params?.id ?? '');

      if (updateErr) throw updateErr;
      router.push('/app/listings');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update listing.');
      setSubmitting(false);
    }
  };

  const selectCls = 'w-full h-11 rounded-xl bg-card border border-border/40 text-sm text-foreground px-3 outline-none focus:border-accent/50 transition-colors appearance-none';
  const inputCls  = 'w-full h-11 rounded-xl bg-card border border-border/40 text-sm text-foreground px-3 outline-none focus:border-accent/50 transition-colors placeholder:text-muted-foreground';
  const sizes     = getSizes(sizeSystem);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex gap-1.5">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-2 h-2 rounded-full bg-accent animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-40 bg-background border-b border-black/[0.07]">
        <div className="flex items-end gap-3 px-5 pt-5 pb-3 max-w-lg mx-auto">
          <button onClick={() => router.back()} className="w-8 h-8 flex items-center justify-center -ml-1 flex-shrink-0">
            <ArrowLeft className="h-5 w-5 text-black/50" />
          </button>
          <h1 className="text-[28px] font-bold text-foreground leading-none tracking-[-0.02em]">Edit Listing</h1>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-5">
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Photo */}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-full aspect-[16/10] rounded-2xl border-2 border-dashed border-accent/25 bg-accent/[0.03] flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-accent/[0.06] hover:border-accent/40 transition-all duration-300 group overflow-hidden"
          >
            {photoPreview ? (
              <div className="relative w-full h-full">
                <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <p className="text-white text-sm font-semibold">Change photo</p>
                </div>
              </div>
            ) : (
              <>
                <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <ImagePlus className="h-6 w-6 text-accent" />
                </div>
                <p className="text-sm font-semibold text-accent">Add photo</p>
              </>
            )}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />

          {/* Brand & Model */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium">Brand *</label>
              <select value={form.brand} onChange={e => update('brand', e.target.value)} className={selectCls}>
                <option value="">Select brand</option>
                {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium">Model *</label>
              <input value={form.model} onChange={e => update('model', e.target.value)} placeholder="e.g. Air Force 1" className={inputCls} />
            </div>
          </div>

          {/* Size system + size */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs text-muted-foreground font-medium">Size system</label>
              <SizeSystemToggle value={sizeSystem} onChange={handleSizeSystemChange} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium">Shoe size *</label>
              <select value={form.size} onChange={e => update('size', e.target.value)} className={selectCls}>
                <option value="">Select size</option>
                {sizes.map(s => (
                  <option key={s} value={s}>{formatSizeLabel(s, sizeSystem)}</option>
                ))}
              </select>
              {form.size && (
                <p className="text-[11px] text-muted-foreground/60 pl-1">
                  Stored as UK {toUKCanonical(form.size, sizeSystem)}
                </p>
              )}
            </div>
          </div>

          {/* Side & Condition */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium">Side *</label>
              <select value={form.side} onChange={e => update('side', e.target.value)} className={selectCls}>
                <option value="">Side</option>
                <option value="L">Left</option>
                <option value="R">Right</option>
                <option value="single">Either</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium">Condition *</label>
              <select value={form.condition} onChange={e => update('condition', e.target.value)} className={selectCls}>
                <option value="">Condition</option>
                {CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>

          {/* Price */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-medium">Price ($) *</label>
            <input
              type="number"
              value={form.price}
              onChange={e => update('price', e.target.value)}
              placeholder="0"
              className={`${inputCls} text-lg font-bold`}
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-medium">Description</label>
            <textarea
              value={form.description}
              onChange={e => update('description', e.target.value)}
              placeholder="Describe your shoe — condition, colour, any defects..."
              rows={3}
              className="w-full rounded-xl bg-card border border-border/40 text-sm text-foreground px-3 py-2.5 outline-none focus:border-accent/50 transition-colors placeholder:text-muted-foreground resize-none"
            />
          </div>

          {error && (
            <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-2.5">
              {error}
            </p>
          )}

          <Button
            type="submit"
            variant="hero"
            disabled={submitting}
            className="w-full rounded-xl text-base shadow-elevated hover:shadow-glow transition-shadow"
            style={{ height: 52 }}
          >
            {submitting ? 'Saving…' : 'Save changes'}
          </Button>
        </form>
      </div>
    </div>
  );
}

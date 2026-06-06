'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '../../../../../lib/supabase';
import { ChevronLeft, Camera, X, Plus, Check } from 'lucide-react';
import { getCurrencyForCountry, extractCountry, type CurrencyInfo } from '../../../../../lib/currency';
import {
  type SizeSystem,
  getSizes,
  formatSizeLabel,
  toUKCanonical,
  detectSizeSystem,
} from '../../../../../lib/sizeConversion';

type Foot      = 'L' | 'R';
type Condition = 'new_with_tags' | 'new_without_tags' | 'excellent' | 'good' | 'fair' | 'poor';

const BRANDS = ['Nike', 'Adidas', 'Jordan', 'New Balance', 'Vans', 'Converse', 'Timberland', 'Puma', 'Reebok', 'Other'];

const CONDITIONS: { value: Condition; label: string; sub: string }[] = [
  { value: 'new_with_tags',    label: 'New with tags',   sub: 'Unworn, original tags attached' },
  { value: 'new_without_tags', label: 'New',             sub: 'Unworn, no tags' },
  { value: 'excellent',        label: 'Excellent',       sub: 'Worn once or twice, like new' },
  { value: 'good',             label: 'Good',            sub: 'Lightly worn, minor signs of use' },
  { value: 'fair',             label: 'Fair',            sub: 'Visible wear, fully functional' },
  { value: 'poor',             label: 'Poor',            sub: 'Heavy wear or defects' },
];

const SIDES: { value: Foot; label: string; sub: string }[] = [
  { value: 'L', label: 'Left foot',  sub: 'Single left shoe only' },
  { value: 'R', label: 'Right foot', sub: 'Single right shoe only' },
];

interface PhotoItem {
  src:   string;   // blob URL (new) or storage URL (existing)
  file?: File;     // only present for new uploads
}

function RadioCard({ label, sub, selected, onClick }: {
  label: string; sub?: string; selected: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl border-2 bg-card transition-all text-left active:scale-[0.99] ${
        selected ? 'border-foreground shadow-sm' : 'border-border'
      }`}
    >
      <div>
        <p className="text-[16px] font-medium text-foreground">{label}</p>
        {sub && <p className="text-[13px] text-muted-foreground mt-0.5">{sub}</p>}
      </div>
      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ml-4 transition-all ${
        selected ? 'border-foreground bg-foreground' : 'border-border'
      }`}>
        {selected && <Check className="w-3 h-3 text-background" />}
      </div>
    </button>
  );
}

export default function EditListingPage() {
  const router  = useRouter();
  const params  = useParams<{ id: string }>();
  const fileRef = useRef<HTMLInputElement>(null);

  const [userId,        setUserId]        = useState<string | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [submitting,    setSubmitting]    = useState(false);
  const [error,         setError]         = useState('');
  const [sizeSystem,    setSizeSystem]    = useState<SizeSystem>('UK');
  const [currency,      setCurrency]      = useState<CurrencyInfo>({ code: 'USD', symbol: '$', name: 'US Dollar' });
  const [photos,        setPhotos]        = useState<PhotoItem[]>([]);
  const [swapAvailable, setSwapAvailable] = useState(false);
  const MAX_PHOTOS = 6;

  const [form, setForm] = useState({
    brand: '', model: '', size: '',
    side: '' as Foot | '',
    condition: '' as Condition | '',
    price: '', description: '',
  });

  const update = (key: string, value: string) =>
    setForm(prev => ({ ...prev, [key]: value }));

  useEffect(() => {
    setSizeSystem(detectSizeSystem());
  }, []);

  // Auth + currency detection
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) { router.replace('/login'); return; }
      setUserId(session.user.id);
      const { data } = await supabase.from('users').select('location').eq('id', session.user.id).single();
      if (data?.location) {
        const country = extractCountry(data.location as string);
        setCurrency(getCurrencyForCountry(country));
      }
    });
  }, [router]);

  // Load existing listing
  useEffect(() => {
    if (!params?.id) return;
    (async () => {
      const { data, error: fetchErr } = await supabase
        .from('listings')
        .select('shoe_brand, shoe_model, size, foot_side, condition, price, currency, description, photos, user_id, swap_available')
        .eq('id', params.id)
        .single();

      if (fetchErr || !data) { router.replace('/app/listings'); return; }

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id !== data.user_id) { router.replace('/app/listings'); return; }

      setForm({
        brand:       data.shoe_brand ?? '',
        model:       data.shoe_model ?? '',
        size:        String(data.size ?? ''),
        side:        (data.foot_side as Foot) ?? '',
        condition:   (data.condition as Condition) ?? '',
        price:       data.price != null ? String(data.price) : '',
        description: data.description ?? '',
      });
      setSwapAvailable(!!(data as Record<string, unknown>).swap_available);

      if (Array.isArray(data.photos)) {
        setPhotos((data.photos as string[]).map(src => ({ src })));
      }

      // Override currency from listing if present
      if (data.currency) {
        // will already be set via user location; listing currency is the canonical one
      }

      setLoading(false);
    })();
  }, [params?.id, router]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const remaining = MAX_PHOTOS - photos.length;
    const toAdd = files.slice(0, remaining);
    setPhotos(prev => [
      ...prev,
      ...toAdd.map(f => ({ src: URL.createObjectURL(f), file: f })),
    ]);
    e.target.value = '';
  };

  const removePhoto = (idx: number) => {
    const photo = photos[idx];
    if (photo.file) URL.revokeObjectURL(photo.src);
    setPhotos(prev => prev.filter((_, i) => i !== idx));
  };

  const canSave =
    photos.length > 0 &&
    !!form.brand &&
    form.model.trim().length > 0 &&
    !!form.size &&
    !!form.side &&
    !!form.condition &&
    form.price.trim().length > 0 &&
    parseFloat(form.price) > 0;

  const handleSubmit = async () => {
    if (!canSave || !userId || !params?.id) return;
    setSubmitting(true);
    setError('');

    try {
      const finalPhotos: string[] = [];

      for (const photo of photos) {
        if (photo.file) {
          const ext  = photo.file.name.split('.').pop() ?? 'jpg';
          const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
          const { error: uploadErr } = await supabase.storage
            .from('shoe-images')
            .upload(path, photo.file, { upsert: true });
          if (uploadErr) throw uploadErr;
          const { data: { publicUrl } } = supabase.storage.from('shoe-images').getPublicUrl(path);
          finalPhotos.push(publicUrl);
        } else {
          finalPhotos.push(photo.src);
        }
      }

      const ukSize = toUKCanonical(form.size, sizeSystem);

      const { error: updateErr } = await supabase
        .from('listings')
        .update({
          shoe_brand:     form.brand,
          shoe_model:     form.model.trim(),
          size:           ukSize,
          foot_side:      form.side,
          condition:      form.condition,
          price:          parseFloat(form.price),
          currency:       currency.code,
          description:    form.description.trim() || null,
          photos:         finalPhotos,
          swap_available: swapAvailable,
        })
        .eq('id', params.id);

      if (updateErr) throw updateErr;
      router.push(`/app/listing/${params.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update listing. Please try again.');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex gap-1.5">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-2.5 h-2.5 rounded-full bg-foreground animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* Header */}
      <div className="flex-shrink-0 px-5 pt-12 pb-2 flex items-center gap-3">
        <button onClick={() => router.back()} className="flex items-center justify-center -ml-1 p-1" aria-label="Back">
          <ChevronLeft className="w-7 h-7 text-foreground" />
        </button>
        <h1 className="text-[22px] font-bold text-foreground tracking-[-0.02em]">Edit listing</h1>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 px-6 pt-4 pb-8 overflow-y-auto space-y-6">

        {/* ── Photos ─────────────────────────────────────────────── */}
        <div>
          <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider mb-3 pl-1">Photos</p>
          <div className="grid grid-cols-2 gap-2">

            {/* Cover (first) — large */}
            {photos[0] ? (
              <div className="col-span-2 relative aspect-square rounded-2xl overflow-hidden">
                <img src={photos[0].src} alt="Cover" className="w-full h-full object-cover" />
                <button type="button" onClick={() => removePhoto(0)}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center">
                  <X className="w-3.5 h-3.5 text-white" />
                </button>
                <span className="absolute bottom-2 left-2 text-[10px] font-semibold text-white bg-black/40 rounded-full px-2 py-0.5">
                  Cover
                </span>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()}
                className="col-span-2 aspect-square rounded-2xl bg-card border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 active:scale-[0.98] transition-all">
                <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center">
                  <Camera className="h-6 w-6 text-muted-foreground/70" />
                </div>
                <p className="text-[14px] font-semibold text-foreground">Add cover photo</p>
                <p className="text-[12px] text-muted-foreground">Tap to upload</p>
              </button>
            )}

            {/* Additional photos */}
            {photos.slice(1).map((photo, i) => (
              <div key={i} className="relative aspect-square rounded-2xl overflow-hidden">
                <img src={photo.src} alt={`Angle ${i + 2}`} className="w-full h-full object-cover" />
                <button type="button" onClick={() => removePhoto(i + 1)}
                  className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/50 flex items-center justify-center">
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            ))}

            {/* Add more slot */}
            {photos.length > 0 && photos.length < MAX_PHOTOS && (
              <button type="button" onClick={() => fileRef.current?.click()}
                className="aspect-square rounded-2xl bg-card border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 active:scale-[0.98] transition-all">
                <Plus className="w-5 h-5 text-muted-foreground/50" />
                <p className="text-[11px] text-muted-foreground/50 font-medium">Add more</p>
              </button>
            )}
          </div>

          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoChange} />

          <p className="text-center text-[12px] text-muted-foreground/50 mt-2">
            {photos.length === 0
              ? 'At least 1 photo required · up to 6'
              : `${photos.length} of ${MAX_PHOTOS} photos`}
          </p>
        </div>

        {/* ── Brand & Model ──────────────────────────────────────── */}
        <div className="space-y-3">
          <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider pl-1">Shoe details</p>

          <div className="bg-card rounded-2xl border border-border px-5 py-4">
            <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider mb-1.5">Brand</p>
            <select
              value={form.brand}
              onChange={e => update('brand', e.target.value)}
              className="w-full bg-transparent text-foreground text-[17px] outline-none appearance-none leading-snug"
            >
              <option value="">Select brand</option>
              {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>

          <div className="bg-card rounded-2xl border border-border px-5 py-4">
            <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider mb-1.5">Model</p>
            <input
              type="text"
              value={form.model}
              onChange={e => update('model', e.target.value)}
              placeholder="e.g. Air Force 1, Chuck Taylor…"
              className="w-full bg-transparent text-foreground text-[17px] outline-none placeholder:text-muted-foreground/40 leading-snug"
            />
          </div>
        </div>

        {/* ── Size & Foot ────────────────────────────────────────── */}
        <div className="space-y-3">
          <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider pl-1">Size & foot</p>

          {/* System toggle */}
          <div className="flex gap-2">
            {(['UK', 'US', 'EU'] as SizeSystem[]).map(sys => (
              <button
                key={sys}
                type="button"
                onClick={() => { setSizeSystem(sys); update('size', ''); }}
                className={`flex-1 h-11 rounded-full text-[15px] font-semibold border-2 transition-all ${
                  sizeSystem === sys
                    ? 'bg-foreground text-background border-foreground'
                    : 'bg-card text-foreground border-border'
                }`}
              >
                {sys}
              </button>
            ))}
          </div>

          {/* Size dropdown */}
          <div className="bg-card rounded-2xl border border-border px-5 py-4">
            <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider mb-1.5">{sizeSystem} size</p>
            <select
              value={form.size}
              onChange={e => update('size', e.target.value)}
              className="w-full bg-transparent text-foreground text-[17px] outline-none appearance-none leading-snug"
            >
              <option value="">Select size</option>
              {getSizes(sizeSystem).map(s => (
                <option key={s} value={s}>{formatSizeLabel(s, sizeSystem)}</option>
              ))}
            </select>
          </div>

          {/* Foot side */}
          <div className="space-y-2.5">
            {SIDES.map(s => (
              <RadioCard
                key={s.value}
                label={s.label}
                sub={s.sub}
                selected={form.side === s.value}
                onClick={() => update('side', s.value)}
              />
            ))}
          </div>
        </div>

        {/* ── Condition ──────────────────────────────────────────── */}
        <div className="space-y-3">
          <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider pl-1">Condition</p>
          <div className="space-y-2.5">
            {CONDITIONS.map(c => (
              <RadioCard
                key={c.value}
                label={c.label}
                sub={c.sub}
                selected={form.condition === c.value}
                onClick={() => update('condition', c.value)}
              />
            ))}
          </div>
        </div>

        {/* ── Price & Description ────────────────────────────────── */}
        <div className="space-y-3">
          <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider pl-1">Pricing</p>

          <div className="bg-card rounded-2xl border border-border px-5 py-4">
            <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider mb-1.5">Price ({currency.code})</p>
            <div className="flex items-center gap-2">
              <span className="text-[22px] font-bold text-muted-foreground/50">{currency.symbol}</span>
              <input
                type="number"
                inputMode="decimal"
                value={form.price}
                onChange={e => update('price', e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                className="flex-1 bg-transparent text-foreground text-[22px] font-bold outline-none placeholder:text-muted-foreground/40 leading-snug"
              />
            </div>
          </div>

          <div className="bg-card rounded-2xl border border-border px-5 py-4">
            <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider mb-1.5">
              Description <span className="normal-case font-normal">(optional)</span>
            </p>
            <textarea
              value={form.description}
              onChange={e => update('description', e.target.value)}
              placeholder="Colour, any defects, reason for selling…"
              rows={3}
              maxLength={500}
              className="w-full bg-transparent text-foreground text-[15px] outline-none placeholder:text-muted-foreground/40 resize-none leading-relaxed"
            />
            <p className="text-[10px] text-muted-foreground/50 text-right mt-1">{form.description.length}/500</p>
          </div>

          {/* Swap toggle */}
          <button
            type="button"
            onClick={() => setSwapAvailable(v => !v)}
            className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl border-2 bg-card transition-all text-left active:scale-[0.99] ${
              swapAvailable ? 'border-foreground shadow-sm' : 'border-border'
            }`}
          >
            <div>
              <p className="text-[16px] font-medium text-foreground">Open to swap</p>
              <p className="text-[13px] text-muted-foreground mt-0.5">Mismatched pair? Find someone to swap with</p>
            </div>
            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ml-4 transition-all ${
              swapAvailable ? 'border-foreground bg-foreground' : 'border-border'
            }`}>
              {swapAvailable && <Check className="w-3 h-3 text-background" />}
            </div>
          </button>
        </div>

        {error && (
          <div className="px-4 py-3 rounded-2xl bg-red-500/10 border border-red-500/20">
            <p className="text-[13px] text-red-600">{error}</p>
          </div>
        )}
      </div>

      {/* Save button */}
      <div className="flex-shrink-0 px-6 pt-3 pb-[calc(60px+env(safe-area-inset-bottom)+12px)] bg-background">
        <button
          onClick={handleSubmit}
          disabled={!canSave || submitting}
          className="w-full h-[54px] rounded-full bg-foreground text-background text-[15px] font-semibold disabled:opacity-25 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Saving…
            </>
          ) : 'Save changes'}
        </button>
      </div>
    </div>
  );
}

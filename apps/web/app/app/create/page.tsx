'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { ChevronLeft, ChevronRight, Camera, Check, X, Plus } from 'lucide-react';
import { getCurrencyForCountry, extractCountry, type CurrencyInfo } from '../../../lib/currency';
import {
  type SizeSystem,
  getSizes,
  formatSizeLabel,
  toUKCanonical,
  detectSizeSystem,
} from '../../../lib/sizeConversion';

type Foot = 'L' | 'R' | 'single';
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

const TOTAL_STEPS = 5;

function RadioCard({
  label, sub, selected, onClick,
}: {
  label: string; sub?: string; selected: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl border-2 bg-white transition-all text-left active:scale-[0.99] ${
        selected ? 'border-foreground shadow-sm' : 'border-black/10'
      }`}
    >
      <div>
        <p className="text-[16px] font-medium text-foreground">{label}</p>
        {sub && <p className="text-[13px] text-black/40 mt-0.5">{sub}</p>}
      </div>
      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ml-4 transition-all ${
        selected ? 'border-foreground bg-foreground' : 'border-black/20'
      }`}>
        {selected && <Check className="w-3 h-3 text-background" />}
      </div>
    </button>
  );
}

export default function CreatePage() {
  const router  = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [userId,       setUserId]       = useState<string | null>(null);
  const [step,         setStep]         = useState(1);
  const [submitting,   setSubmitting]   = useState(false);
  const [sizeSystem,   setSizeSystem]   = useState<SizeSystem>('UK');
  const [currency,     setCurrency]     = useState<CurrencyInfo>({ code: 'USD', symbol: '$', name: 'US Dollar' });
  const [error,        setError]        = useState('');
  const [photoFiles,   setPhotoFiles]   = useState<File[]>([]);
  const [photoPreviews,setPhotoPreviews]= useState<string[]>([]);
  const MAX_PHOTOS = 6;

  const [swapAvailable, setSwapAvailable] = useState(false);
  const [form, setForm] = useState({
    brand: '', model: '', size: '',
    side: '' as Foot | '',
    condition: '' as Condition | '',
    price: '', description: '',
  });

  useEffect(() => {
    setSizeSystem(detectSizeSystem());
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

  const update = (key: string, value: string) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const remaining = MAX_PHOTOS - photoFiles.length;
    const toAdd = files.slice(0, remaining);
    setPhotoFiles(prev => [...prev, ...toAdd]);
    setPhotoPreviews(prev => [...prev, ...toAdd.map(f => URL.createObjectURL(f))]);
    e.target.value = '';
  };

  const removePhoto = (idx: number) => {
    URL.revokeObjectURL(photoPreviews[idx]);
    setPhotoFiles(prev => prev.filter((_, i) => i !== idx));
    setPhotoPreviews(prev => prev.filter((_, i) => i !== idx));
  };

  const canProceed = (() => {
    switch (step) {
      case 1: return photoPreviews.length > 0;
      case 2: return !!form.brand && form.model.trim().length > 0;
      case 3: return !!form.size && !!form.side;
      case 4: return !!form.condition;
      case 5: return form.price.trim().length > 0 && parseFloat(form.price) > 0;
      default: return false;
    }
  })();

  function handleBack() {
    setError('');
    if (step === 1) router.push('/app');
    else setStep(s => s - 1);
  }

  async function handleNext() {
    if (!canProceed) return;
    setError('');
    if (step < TOTAL_STEPS) { setStep(s => s + 1); return; }
    await handleSubmit();
  }

  async function handleSubmit() {
    if (!userId) return;
    setSubmitting(true);
    setError('');

    try {
      const photos: string[] = [];

      for (const file of photoFiles) {
        const ext  = file.name.split('.').pop() ?? 'jpg';
        const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { data: stored, error: uploadErr } = await supabase.storage
          .from('shoe-images')
          .upload(path, file, { upsert: true });
        if (uploadErr) throw uploadErr;
        if (stored) {
          const { data: { publicUrl } } = supabase.storage.from('shoe-images').getPublicUrl(path);
          photos.push(publicUrl);
        }
      }

      const ukSize = toUKCanonical(form.size, sizeSystem);

      const { error: insertErr } = await supabase.from('listings').insert({
        user_id:     userId,
        shoe_brand:     form.brand,
        shoe_model:     form.model.trim(),
        size:           ukSize,
        foot_side:      form.side,
        condition:      form.condition,
        price:          parseFloat(form.price),
        currency:       currency.code,
        description:    form.description.trim() || null,
        photos,
        status:         'active',
        swap_available: swapAvailable,
      });

      if (insertErr) throw insertErr;
      router.push('/app/listings');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create listing. Please try again.');
      setSubmitting(false);
    }
  }

  const stepConfig: Record<number, { title: string; subtitle: string }> = {
    1: { title: 'Add photos',          subtitle: 'Show different angles — up to 6 photos.' },
    2: { title: 'What shoe is it?',   subtitle: 'Brand and model help buyers find you.' },
    3: { title: 'Size and foot',      subtitle: 'Which foot does this shoe fit?' },
    4: { title: 'What\'s the condition?', subtitle: 'Be honest — buyers appreciate it.' },
    5: { title: 'Set your price',     subtitle: 'You can edit this anytime.' },
  };

  const { title, subtitle } = stepConfig[step];

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* Progress bar */}
      <div className="h-[3px] bg-black/8 w-full flex-shrink-0">
        <div
          className="h-full bg-foreground transition-all duration-500 ease-out"
          style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
        />
      </div>

      {/* Back button */}
      <div className="px-5 pt-12 pb-2 flex-shrink-0">
        <button onClick={handleBack} className="flex items-center justify-center -ml-1 p-1" aria-label="Back">
          <ChevronLeft className="w-7 h-7 text-foreground" />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 px-6 pt-4 pb-8 overflow-y-auto">
        <h1 className="font-display text-[2.6rem] font-bold text-foreground leading-[1.1] tracking-[-0.025em] text-center mb-3">
          {title}
        </h1>
        <p className="text-center text-black/40 text-[15px] mb-10 leading-relaxed max-w-[280px] mx-auto">
          {subtitle}
        </p>

        {/* ── Step 1: Photos ─────────────────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-3">
            {/* Main photo (large) */}
            <div className="grid grid-cols-2 gap-2">
              {/* First slot — always large */}
              {photoPreviews[0] ? (
                <div className="col-span-2 relative aspect-square rounded-2xl overflow-hidden">
                  <img src={photoPreviews[0]} alt="Main" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(0)}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center"
                  >
                    <X className="w-3.5 h-3.5 text-white" />
                  </button>
                  <span className="absolute bottom-2 left-2 text-[10px] font-semibold text-white bg-black/40 rounded-full px-2 py-0.5">
                    Cover
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="col-span-2 aspect-square rounded-2xl bg-white border-2 border-dashed border-black/15 flex flex-col items-center justify-center gap-2 active:scale-[0.98] transition-all"
                >
                  <div className="w-14 h-14 rounded-2xl bg-black/5 flex items-center justify-center">
                    <Camera className="h-6 w-6 text-black/30" />
                  </div>
                  <p className="text-[14px] font-semibold text-foreground">Add cover photo</p>
                  <p className="text-[12px] text-black/35">Tap to upload</p>
                </button>
              )}

              {/* Additional photo slots */}
              {photoPreviews.slice(1).map((src, i) => (
                <div key={i} className="relative aspect-square rounded-2xl overflow-hidden">
                  <img src={src} alt={`Angle ${i + 2}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(i + 1)}
                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/50 flex items-center justify-center"
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                </div>
              ))}

              {/* Add more slot */}
              {photoPreviews.length > 0 && photoPreviews.length < MAX_PHOTOS && (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="aspect-square rounded-2xl bg-white border-2 border-dashed border-black/12 flex flex-col items-center justify-center gap-1 active:scale-[0.98] transition-all"
                >
                  <Plus className="w-5 h-5 text-black/25" />
                  <p className="text-[11px] text-black/30 font-medium">Add more</p>
                </button>
              )}
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handlePhotoChange}
            />

            <p className="text-center text-[12px] text-black/30">
              {photoPreviews.length === 0
                ? 'At least 1 photo required · up to 6'
                : `${photoPreviews.length} of ${MAX_PHOTOS} photos added`}
            </p>
          </div>
        )}

        {/* ── Step 2: Brand & Model ──────────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-3">
            <div className="bg-white rounded-2xl border border-black/10 px-5 py-4">
              <p className="text-[11px] text-black/35 font-semibold uppercase tracking-wider mb-1.5">Brand</p>
              <select
                value={form.brand}
                onChange={e => update('brand', e.target.value)}
                className="w-full bg-transparent text-foreground text-[17px] outline-none appearance-none leading-snug"
              >
                <option value="">Select brand</option>
                {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div className="bg-white rounded-2xl border border-black/10 px-5 py-4">
              <p className="text-[11px] text-black/35 font-semibold uppercase tracking-wider mb-1.5">Model</p>
              <input
                type="text"
                value={form.model}
                onChange={e => update('model', e.target.value)}
                placeholder="e.g. Air Force 1, Chuck Taylor…"
                className="w-full bg-transparent text-foreground text-[17px] outline-none placeholder-black/20 leading-snug"
                onKeyDown={e => e.key === 'Enter' && canProceed && handleNext()}
              />
            </div>
          </div>
        )}

        {/* ── Step 3: Size & Side ────────────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-4">
            {/* Size system toggle */}
            <div className="flex gap-2">
              {(['UK', 'US', 'EU'] as SizeSystem[]).map(sys => (
                <button
                  key={sys}
                  type="button"
                  onClick={() => { setSizeSystem(sys); update('size', ''); }}
                  className={`flex-1 h-11 rounded-full text-[15px] font-semibold border-2 transition-all ${
                    sizeSystem === sys
                      ? 'bg-foreground text-background border-foreground'
                      : 'bg-white text-foreground border-black/10'
                  }`}
                >
                  {sys}
                </button>
              ))}
            </div>

            {/* Size picker for selected system */}
            <div className="bg-white rounded-2xl border border-black/10 px-5 py-4">
              <p className="text-[11px] text-black/35 font-semibold uppercase tracking-wider mb-1.5">{sizeSystem} size</p>
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
              <p className="text-[11px] text-black/35 font-semibold uppercase tracking-wider pl-1">Which foot?</p>
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
        )}

        {/* ── Step 4: Condition ──────────────────────────────────────────── */}
        {step === 4 && (
          <div className="space-y-2.5">
            {CONDITIONS.map(c => (
              <RadioCard
                key={c.value}
                label={c.label}
                sub={c.sub}
                selected={form.condition === c.value}
                onClick={() => { update('condition', c.value); setTimeout(handleNext, 300); }}
              />
            ))}
          </div>
        )}

        {/* ── Step 5: Price & Description ────────────────────────────────── */}
        {step === 5 && (
          <div className="space-y-3">
            <div className="bg-white rounded-2xl border border-black/10 px-5 py-4">
              <p className="text-[11px] text-black/35 font-semibold uppercase tracking-wider mb-1.5">
                Price ({currency.code})
              </p>
              <div className="flex items-center gap-2">
                <span className="text-[22px] font-bold text-black/20">{currency.symbol}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={form.price}
                  onChange={e => update('price', e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  className="flex-1 bg-transparent text-foreground text-[22px] font-bold outline-none placeholder-black/15 leading-snug"
                />
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-black/10 px-5 py-4">
              <p className="text-[11px] text-black/35 font-semibold uppercase tracking-wider mb-1.5">Description <span className="normal-case font-normal">(optional)</span></p>
              <textarea
                value={form.description}
                onChange={e => update('description', e.target.value)}
                placeholder="Colour, any defects, reason for selling…"
                rows={3}
                maxLength={500}
                className="w-full bg-transparent text-foreground text-[15px] outline-none placeholder-black/20 resize-none leading-relaxed"
              />
              <p className="text-[10px] text-black/20 text-right mt-1">{form.description.length}/500</p>
            </div>

            {/* Swap toggle */}
            <button
              type="button"
              onClick={() => setSwapAvailable(v => !v)}
              className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl border-2 bg-white transition-all text-left active:scale-[0.99] ${
                swapAvailable ? 'border-foreground shadow-sm' : 'border-black/10'
              }`}
            >
              <div>
                <p className="text-[16px] font-medium text-foreground">Open to swap</p>
                <p className="text-[13px] text-black/40 mt-0.5">Mismatched pair? Find someone to swap with</p>
              </div>
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ml-4 transition-all ${
                swapAvailable ? 'border-foreground bg-foreground' : 'border-black/20'
              }`}>
                {swapAvailable && <Check className="w-3 h-3 text-background" />}
              </div>
            </button>
          </div>
        )}

        {error && (
          <div className="mt-6 px-4 py-3 rounded-2xl bg-red-50 border border-red-100">
            <p className="text-[13px] text-red-600">{error}</p>
          </div>
        )}
      </div>

      {/* Continue button */}
      {step !== 4 && (
        <div className="flex-shrink-0 px-6 pt-3 pb-[calc(60px+env(safe-area-inset-bottom)+12px)] bg-background">
          <button
            onClick={handleNext}
            disabled={!canProceed || submitting}
            className="w-full h-[54px] rounded-full bg-foreground text-background text-[15px] font-semibold disabled:opacity-25 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Listing shoe…
              </>
            ) : step === TOTAL_STEPS ? (
              'List shoe'
            ) : (
              <>Continue <ChevronRight className="w-4 h-4" /></>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

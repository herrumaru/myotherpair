'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { Button } from '../../components/ui/Button';
import { ImagePlus, Info } from 'lucide-react';
import {
  type SizeSystem,
  getSizes,
  formatSizeLabel,
  toUKCanonical,
  detectSizeSystem,
} from '../../../lib/sizeConversion';

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

// ─── Size system toggle ───────────────────────────────────────────────────────

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

// ─── Conversion tooltip ───────────────────────────────────────────────────────

function ConversionTooltip() {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="text-muted-foreground/40 hover:text-accent transition-colors"
        aria-label="Size conversion chart"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div className="absolute bottom-6 left-0 z-50 w-52 bg-card border border-border/40 rounded-xl shadow-lg p-3 text-[11px] text-foreground">
          <p className="font-semibold mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">
            Quick reference
          </p>
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-muted-foreground/60">
                <th className="text-left pb-1 font-medium">UK</th>
                <th className="text-left pb-1 font-medium">US</th>
                <th className="text-left pb-1 font-medium">EU</th>
              </tr>
            </thead>
            <tbody>
              {[
                { uk: '5', us: '6', eu: '38' },
                { uk: '6', us: '7', eu: '39' },
                { uk: '7', us: '8', eu: '41' },
                { uk: '8', us: '9', eu: '42' },
                { uk: '9', us: '10', eu: '43' },
                { uk: '10', us: '11', eu: '44' },
                { uk: '11', us: '12', eu: '45' },
              ].map(r => (
                <tr key={r.uk} className="border-t border-border/20">
                  <td className="py-0.5">{r.uk}</td>
                  <td className="py-0.5">{r.us}</td>
                  <td className="py-0.5">{r.eu}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-muted-foreground/50 mt-2 text-[10px]">Mens/unisex sizing.</p>
        </div>
      )}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CreatePage() {
  const router  = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [userId,       setUserId]       = useState<string | null>(null);
  const [submitting,   setSubmitting]   = useState(false);
  const [error,        setError]        = useState('');
  const [photoFile,    setPhotoFile]    = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const [sizeSystem, setSizeSystem] = useState<SizeSystem>('UK');

  const [form, setForm] = useState({
    brand:       '',
    model:       '',
    size:        '',           // raw value in selected sizeSystem
    side:        '' as Foot | '',
    condition:   '' as Condition | '',
    price:       '',
    description: '',
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setUserId(session.user.id);
    });
    setSizeSystem(detectSizeSystem());
  }, []);

  const update = (key: string, value: string) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleSizeSystemChange = (sys: SizeSystem) => {
    setSizeSystem(sys);
    update('size', '');   // reset size when system changes
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.brand || !form.model || !form.size || !form.side || !form.condition || !form.price) {
      setError('Please fill in all required fields.');
      return;
    }
    if (!userId) {
      setError('You must be logged in to create a listing.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      let photos: string[] = [];

      if (photoFile) {
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

      // Convert to UK canonical size for consistent DB storage
      const ukSize = toUKCanonical(form.size, sizeSystem);

      const { error: insertErr } = await supabase.from('listings').insert({
        user_id:    userId,
        shoe_brand: form.brand,
        shoe_model: form.model,
        size:       ukSize,
        foot_side:  form.side,
        condition:  form.condition,
        price:      parseFloat(form.price),
        description: form.description || null,
        photos,
        status:     'active',
      });

      if (insertErr) throw insertErr;
      router.push('/app/browse');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create listing. Please try again.');
      setSubmitting(false);
    }
  };

  const selectCls = 'w-full h-11 rounded-xl bg-card border border-border/40 text-sm text-foreground px-3 outline-none focus:border-accent/50 transition-colors appearance-none';
  const inputCls  = 'w-full h-11 rounded-xl bg-card border border-border/40 text-sm text-foreground px-3 outline-none focus:border-accent/50 transition-colors placeholder:text-muted-foreground';
  const sizes     = getSizes(sizeSystem);

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-40 bg-background border-b border-black/[0.07]">
        <div className="flex items-end justify-between px-5 pt-5 pb-3 max-w-lg mx-auto">
          <h1 className="text-[28px] font-bold text-foreground leading-none tracking-[-0.02em]">List a Shoe</h1>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-5">
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Photo upload */}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-full aspect-[16/10] rounded-2xl border-2 border-dashed border-accent/25 bg-accent/[0.03] flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-accent/[0.06] hover:border-accent/40 transition-all duration-300 group overflow-hidden"
          >
            {photoPreview ? (
              <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
            ) : (
              <>
                <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <ImagePlus className="h-6 w-6 text-accent" />
                </div>
                <p className="text-sm font-semibold text-accent">Add photos</p>
                <p className="text-xs text-muted-foreground">Tap to upload shoe images</p>
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
              <input
                value={form.model}
                onChange={e => update('model', e.target.value)}
                placeholder="e.g. Air Force 1"
                className={inputCls}
              />
            </div>
          </div>

          {/* Size system + size dropdown */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                Size system <ConversionTooltip />
              </label>
              <SizeSystemToggle value={sizeSystem} onChange={handleSizeSystemChange} />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium">Shoe size *</label>
              <select
                value={form.size}
                onChange={e => update('size', e.target.value)}
                className={selectCls}
              >
                <option value="">Select size</option>
                {sizes.map(s => (
                  <option key={s} value={s}>
                    {formatSizeLabel(s, sizeSystem)}
                  </option>
                ))}
              </select>
              {form.size && (
                <p className="text-[11px] text-muted-foreground/60 pl-1">
                  Stored as UK {toUKCanonical(form.size, sizeSystem)} — visible to all buyers in their preferred system.
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
            {submitting ? 'Listing...' : 'List Shoe'}
          </Button>
        </form>
      </div>
    </div>
  );
}

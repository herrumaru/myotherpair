'use client';

import { useState, useEffect, useMemo, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { ChevronLeft, ChevronRight, Eye, EyeOff, Check } from 'lucide-react';
import { Country, City } from 'country-state-city';
import { getPasswordStrength } from '../../lib/passwordStrength';
import { SUPPORTED_COUNTRY_CODES } from '../../lib/countries';
import {
  type SizeSystem,
  getSizes,
  formatSizeLabel,
  toUKCanonical,
  detectSizeSystem,
} from '../../lib/sizeConversion';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function PasswordStrengthBar({ password }: { password: string }) {
  const result = useMemo(() => getPasswordStrength(password), [password]);
  if (!password) return null;
  return (
    <div className="mt-3 space-y-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className={`flex-1 h-1 rounded-full transition-all duration-300 ${i <= result.score ? result.barColor : 'bg-black/10'}`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {result.checks.map(c => (
          <span key={c.label} className={`text-[11px] flex items-center gap-1 ${c.pass ? 'text-green-600' : 'text-black/30'}`}>
            {c.pass ? <Check className="h-2.5 w-2.5" /> : <span className="w-2.5 inline-block" />}
            {c.label}
          </span>
        ))}
        {result.label && <span className={`text-[11px] font-semibold ml-auto ${result.color}`}>{result.label}</span>}
      </div>
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormState {
  firstName:      string;
  lastName:       string;
  email:          string;
  password:       string;
  countryCode:    string;
  city:           string;
  sizeSystem:     SizeSystem;
  leftFootSize:   string;
  rightFootSize:  string;
  isAmputee:      boolean;
  amputeeSide:    '' | 'left' | 'right';
  neededFootSize: string;
}

type FootType = 'different' | 'amputee' | null;

const ALL_COUNTRIES = Country.getAllCountries().filter(c => SUPPORTED_COUNTRY_CODES.has(c.isoCode));

// ─── Reusable components ──────────────────────────────────────────────────────

function CardInput({
  label, value, onChange, type = 'text', placeholder = '', disabled = false, autoComplete = '',
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; disabled?: boolean; autoComplete?: string;
}) {
  return (
    <div className={`bg-white rounded-2xl border border-black/10 px-5 py-4 transition-all ${disabled ? 'opacity-40' : ''}`}>
      <p className="text-xs text-black/40 font-medium mb-1">{label}</p>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete={autoComplete}
        className="w-full bg-transparent text-foreground text-[17px] outline-none placeholder-black/20 leading-snug"
      />
    </div>
  );
}

function RadioCard({
  label, sublabel, selected, onClick,
}: {
  label: string; sublabel?: string; selected: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl border-2 bg-white transition-all text-left ${
        selected ? 'border-foreground' : 'border-black/10'
      }`}
    >
      <div>
        <p className="text-[17px] text-foreground">{label}</p>
        {sublabel && <p className="text-xs text-black/40 mt-0.5">{sublabel}</p>}
      </div>
      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
        selected ? 'border-foreground' : 'border-black/20'
      }`}>
        {selected && <div className="w-3 h-3 rounded-full bg-foreground" />}
      </div>
    </button>
  );
}

function SizeCard({
  system, value, onChange, label,
}: {
  system: SizeSystem; value: string; onChange: (v: string) => void; label: string;
}) {
  const sizes = getSizes(system);
  return (
    <div className="bg-white rounded-2xl border border-black/10 px-5 py-4">
      <p className="text-xs text-black/40 font-medium mb-1">{label}</p>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-transparent text-foreground text-[17px] outline-none appearance-none leading-snug"
      >
        <option value="">Select size</option>
        {sizes.map(s => <option key={s} value={s}>{formatSizeLabel(s, system)}</option>)}
      </select>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TOTAL_STEPS = 6;

export default function SignupPage() {
  const router = useRouter();

  const [step,      setStep]      = useState(1);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [showPass,  setShowPass]  = useState(false);
  const [footType,  setFootType]  = useState<FootType>(null);

  const [form, setForm] = useState<FormState>({
    firstName: '', lastName: '', email: '', password: '',
    countryCode: '', city: '',
    sizeSystem: 'UK',
    leftFootSize: '', rightFootSize: '',
    isAmputee: false, amputeeSide: '', neededFootSize: '',
  });

  useEffect(() => {
    setForm(p => ({ ...p, sizeSystem: detectSizeSystem() }));
  }, []);

  const cities = useMemo(() => {
    if (!form.countryCode) return [];
    return City.getCitiesOfCountry(form.countryCode) ?? [];
  }, [form.countryCode]);

  const strength = useMemo(() => getPasswordStrength(form.password), [form.password]);

  const update = (key: keyof FormState, value: string | boolean) =>
    setForm(p => ({ ...p, [key]: value }));

  const handleFootTypeSelect = (type: 'different' | 'amputee') => {
    setFootType(type);
    setForm(p => ({ ...p, isAmputee: type === 'amputee', amputeeSide: '', neededFootSize: '', leftFootSize: '', rightFootSize: '' }));
  };

  const canProceed = useMemo(() => {
    switch (step) {
      case 0: return true;
      case 1: return form.firstName.trim().length > 0;
      case 2: return /\S+@\S+\.\S+/.test(form.email);
      case 3: return strength.score >= 2;
      case 4: return !!form.countryCode && form.city.trim().length > 0;
      case 5: return footType !== null;
      case 6: {
        if (footType === 'amputee') return !!form.amputeeSide && !!form.neededFootSize;
        return !!form.leftFootSize && !!form.rightFootSize;
      }
      default: return false;
    }
  }, [step, form, footType, strength]);

  function handleBack() {
    setError('');
    if (step === 1) router.push('/');
    else setStep(s => s - 1);
  }

  async function handleNext() {
    if (!canProceed) return;
    setError('');
    if (step < TOTAL_STEPS) { setStep(s => s + 1); return; }
    await handleSubmit();
  }

  async function handleSubmit() {
    setLoading(true);
    setError('');

    const leftUK   = form.isAmputee ? null : toUKCanonical(form.leftFootSize, form.sizeSystem);
    const rightUK  = form.isAmputee ? null : toUKCanonical(form.rightFootSize, form.sizeSystem);
    const neededUK = form.isAmputee ? toUKCanonical(form.neededFootSize, form.sizeSystem) : null;
    const countryName = ALL_COUNTRIES.find(c => c.isoCode === form.countryCode)?.name ?? form.countryCode;
    const fullName    = `${form.firstName.trim()}${form.lastName.trim() ? ' ' + form.lastName.trim() : ''}`;
    const locationStr = `${form.city.trim()}, ${countryName}`;

    const { data, error: signUpErr } = await supabase.auth.signUp({
      email:    form.email,
      password: form.password,
      options: {
        data: {
          full_name:        fullName,
          location:         locationStr,
          left_foot_size:   leftUK,
          right_foot_size:  rightUK,
          is_amputee:       form.isAmputee,
          amputee_side:     form.amputeeSide || null,
          needed_foot_size: neededUK,
          size_system:      form.sizeSystem,
        },
      },
    });

    if (signUpErr) { setError(signUpErr.message); setLoading(false); return; }

    const profilePayload = {
      name:            fullName,
      location:        locationStr,
      foot_size_left:  leftUK,
      foot_size_right: rightUK,
      is_amputee:      form.isAmputee,
    };

    if (data.session) {
      await supabase.from('users').upsert({ id: data.session.user.id, email: form.email, ...profilePayload });
      router.replace('/app');
    } else {
      sessionStorage.setItem('signup_profile', JSON.stringify(profilePayload));
      router.replace(`/verify-otp?email=${encodeURIComponent(form.email)}`);
    }
  }

  const changeSizeSystem = (sys: SizeSystem) => {
    setForm(p => ({ ...p, sizeSystem: sys, leftFootSize: '', rightFootSize: '', neededFootSize: '' }));
  };

  // ── Render ────────────────────────────────────────────────────────────────

  // Steps 1–6
  const stepConfig: Record<number, { title: string; subtitle: string }> = {
    1: { title: "What's your name?",     subtitle: "This is how you'll appear on myotherpair." },
    2: { title: "What's your email?",    subtitle: "Used for your account and verification. Never shared." },
    3: { title: "Create a password",     subtitle: "At least 8 characters with a mix of letters and numbers." },
    4: { title: "Where are you based?",  subtitle: "We'll show you listings near you." },
    5: { title: "Tell us about your feet", subtitle: "This helps us find you the perfect match." },
    6: { title: footType === 'amputee' ? "Which foot do you need?" : "What are your foot sizes?",
         subtitle: footType === 'amputee'
           ? "We'll find single shoes in your size."
           : "We'll match you with someone who complements you." },
  };

  const { title, subtitle } = stepConfig[step] ?? { title: '', subtitle: '' };

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* Top bar */}
      <div className="px-4 pt-12 pb-4 flex items-center gap-4">
        <button
          onClick={handleBack}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/5 transition-colors"
          aria-label="Back"
        >
          <ChevronLeft className="w-5 h-5 text-foreground" />
        </button>
        <div className="flex-1 h-[2px] bg-black/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-foreground rounded-full transition-all duration-500"
            style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
          />
        </div>
        <div className="w-10" />
      </div>

      {/* Content */}
      <div className="flex-1 px-6 pt-8 pb-4">
        <h1 className="font-display text-[1.9rem] font-bold text-foreground leading-tight tracking-[-0.02em] text-center mb-3">
          {title}
        </h1>
        <p className="text-center text-black/40 text-[14px] mb-10 leading-relaxed max-w-xs mx-auto">
          {subtitle}
        </p>

        {/* ── Step 1: Name ────────────────────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-3">
            <CardInput label="First name" value={form.firstName} onChange={v => update('firstName', v)} placeholder="Your first name" autoComplete="given-name" />
            <CardInput label="Last name (optional)" value={form.lastName} onChange={v => update('lastName', v)} placeholder="Your last name" autoComplete="family-name" />
          </div>
        )}

        {/* ── Step 2: Email ───────────────────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-3">
            <CardInput label="Your email" value={form.email} onChange={v => update('email', v)} type="email" placeholder="Enter your email" autoComplete="email" />
            <button
              type="button"
              onClick={() => {}}
              className="w-full flex items-start gap-3 bg-white rounded-2xl border border-black/10 px-5 py-4"
            >
              <div className="w-5 h-5 rounded border-2 border-black/20 mt-0.5 flex-shrink-0" />
              <p className="text-[13px] text-black/40 text-left leading-relaxed">
                Don't send me marketing communications about products and services
              </p>
            </button>
          </div>
        )}

        {/* ── Step 3: Password ────────────────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-3">
            <div className="bg-white rounded-2xl border border-black/10 px-5 py-4">
              <p className="text-xs text-black/40 font-medium mb-1">Password</p>
              <div className="flex items-center gap-2">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => update('password', e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className="flex-1 bg-transparent text-foreground text-[17px] outline-none placeholder-black/20"
                />
                <button type="button" onClick={() => setShowPass(v => !v)} className="text-black/30 hover:text-black/50 transition-colors">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <PasswordStrengthBar password={form.password} />
            </div>
          </div>
        )}

        {/* ── Step 4: Location ────────────────────────────────────────────── */}
        {step === 4 && (
          <div className="space-y-3">
            <div className="bg-white rounded-2xl border border-black/10 px-5 py-4">
              <p className="text-xs text-black/40 font-medium mb-1">Country</p>
              <select
                value={form.countryCode}
                onChange={e => { update('countryCode', e.target.value); update('city', ''); }}
                className="w-full bg-transparent text-foreground text-[17px] outline-none appearance-none leading-snug"
              >
                <option value="">Select your country</option>
                {ALL_COUNTRIES.map(c => (
                  <option key={c.isoCode} value={c.isoCode}>{c.flag} {c.name}</option>
                ))}
              </select>
            </div>
            <div className={`bg-white rounded-2xl border border-black/10 px-5 py-4 transition-all ${!form.countryCode ? 'opacity-40' : ''}`}>
              <p className="text-xs text-black/40 font-medium mb-1">City</p>
              <input
                list="city-options"
                value={form.city}
                onChange={e => update('city', e.target.value)}
                placeholder={form.countryCode ? 'Start typing…' : 'Select a country first'}
                disabled={!form.countryCode}
                autoComplete="off"
                className="w-full bg-transparent text-foreground text-[17px] outline-none placeholder-black/20 disabled:cursor-not-allowed leading-snug"
              />
              {cities.length > 0 && (
                <datalist id="city-options">
                  {cities.slice(0, 500).map(c => <option key={`${c.name}-${c.stateCode}`} value={c.name} />)}
                </datalist>
              )}
            </div>
          </div>
        )}

        {/* ── Step 5: Foot type ───────────────────────────────────────────── */}
        {step === 5 && (
          <div className="space-y-3">
            <RadioCard
              label="My feet are different sizes"
              sublabel="I need individual shoes for each foot"
              selected={footType === 'different'}
              onClick={() => handleFootTypeSelect('different')}
            />
            <RadioCard
              label="I'm an amputee / limb different"
              sublabel="I only need one shoe"
              selected={footType === 'amputee'}
              onClick={() => handleFootTypeSelect('amputee')}
            />
          </div>
        )}

        {/* ── Step 6: Sizes ───────────────────────────────────────────────── */}
        {step === 6 && (
          <div className="space-y-4">
            {/* Size system toggle */}
            <div className="flex gap-2">
              {(['UK', 'US', 'EU'] as SizeSystem[]).map(sys => (
                <button
                  key={sys}
                  type="button"
                  onClick={() => changeSizeSystem(sys)}
                  className={`flex-1 h-11 rounded-full text-sm font-semibold border-2 transition-all ${
                    form.sizeSystem === sys ? 'bg-foreground text-background border-foreground' : 'bg-white text-foreground border-black/10'
                  }`}
                >
                  {sys}
                </button>
              ))}
            </div>

            {footType === 'amputee' ? (
              <>
                <div className="space-y-3">
                  <RadioCard
                    label="Left foot"
                    selected={form.amputeeSide === 'left'}
                    onClick={() => update('amputeeSide', 'left')}
                  />
                  <RadioCard
                    label="Right foot"
                    selected={form.amputeeSide === 'right'}
                    onClick={() => update('amputeeSide', 'right')}
                  />
                </div>
                {form.amputeeSide && (
                  <SizeCard
                    system={form.sizeSystem}
                    value={form.neededFootSize}
                    onChange={v => update('neededFootSize', v)}
                    label={`${form.amputeeSide.charAt(0).toUpperCase() + form.amputeeSide.slice(1)} foot size`}
                  />
                )}
              </>
            ) : (
              <div className="space-y-3">
                <SizeCard system={form.sizeSystem} value={form.leftFootSize} onChange={v => update('leftFootSize', v)} label="Left foot size" />
                <SizeCard system={form.sizeSystem} value={form.rightFootSize} onChange={v => update('rightFootSize', v)} label="Right foot size" />
                {form.leftFootSize && form.rightFootSize && form.leftFootSize !== form.rightFootSize && (
                  <div className="px-5 py-4 rounded-2xl bg-white border border-green-200 flex items-start gap-3">
                    <span className="text-green-500 text-lg leading-none">✓</span>
                    <div>
                      <p className="text-[13px] font-semibold text-green-700">Great — myotherpair is built for you!</p>
                      <p className="text-[12px] text-black/40 mt-0.5">We'll find someone who's your complement.</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="mt-4 px-4 py-3 rounded-2xl bg-red-50 border border-red-100">
            <p className="text-[13px] text-red-600">{error}</p>
          </div>
        )}
      </div>

      {/* Bottom action */}
      <div className="px-6 pb-12 pt-4">
        <button
          onClick={handleNext}
          disabled={!canProceed || loading}
          className="w-full h-14 rounded-full bg-foreground text-background text-[15px] font-semibold disabled:opacity-25 transition-opacity active:opacity-80 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Creating account…
            </>
          ) : step < TOTAL_STEPS ? (
            <>Continue <ChevronRight className="w-4 h-4" /></>
          ) : 'Create account'}
        </button>

      </div>

    </div>
  );
}

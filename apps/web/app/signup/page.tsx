'use client';

import { useState, useEffect, useMemo, useRef, useCallback, type KeyboardEvent } from 'react';
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
  username:       string;
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

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

type FootType = 'different' | 'amputee' | null;

const ALL_COUNTRIES = Country.getAllCountries().filter(c => SUPPORTED_COUNTRY_CODES.has(c.isoCode));

// ─── Reusable components ──────────────────────────────────────────────────────

function CardInput({
  label, value, onChange, type = 'text', placeholder = '', disabled = false, autoComplete = '',
  inputRef, onKeyDown,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; disabled?: boolean; autoComplete?: string;
  inputRef?: React.Ref<HTMLInputElement>; onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className={`bg-white rounded-2xl border border-black/10 px-5 py-4 transition-all ${disabled ? 'opacity-40' : ''}`}>
      <p className="text-[11px] text-black/35 font-semibold uppercase tracking-wider mb-1.5">{label}</p>
      <input
        ref={inputRef}
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={onKeyDown}
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
      className={`w-full flex items-center justify-between px-5 py-5 rounded-2xl border-2 bg-white transition-all text-left active:scale-[0.99] ${
        selected ? 'border-foreground shadow-sm' : 'border-black/10'
      }`}
    >
      <div>
        <p className="text-[17px] font-medium text-foreground">{label}</p>
        {sublabel && <p className="text-[13px] text-black/40 mt-0.5">{sublabel}</p>}
      </div>
      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ml-4 transition-all ${
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
      <p className="text-[11px] text-black/35 font-semibold uppercase tracking-wider mb-1.5">{label}</p>
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

function CityAutocomplete({
  cities, value, onChange, disabled,
}: {
  cities: { name: string; stateCode: string }[];
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(value); }, [value]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return cities.slice(0, 80);
    const q = query.toLowerCase();
    return cities.filter(c => c.name.toLowerCase().startsWith(q)).slice(0, 80);
  }, [query, cities]);

  function handleSelect(name: string) {
    onChange(name);
    setQuery(name);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <div className={`bg-white rounded-2xl border border-black/10 px-5 py-4 transition-all ${disabled ? 'opacity-40' : ''}`}>
        <p className="text-[11px] text-black/35 font-semibold uppercase tracking-wider mb-1.5">City</p>
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); }}
          onFocus={() => { if (!disabled) setOpen(true); }}
          placeholder={disabled ? 'Select a country first' : 'Start typing your city…'}
          disabled={disabled}
          autoComplete="off"
          className="w-full bg-transparent text-foreground text-[17px] outline-none placeholder-black/20 disabled:cursor-not-allowed leading-snug"
        />
      </div>
      {open && !disabled && filtered.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white rounded-2xl border border-black/10 shadow-lg max-h-52 overflow-y-auto">
          {filtered.map(c => (
            <button
              key={`${c.name}-${c.stateCode}`}
              type="button"
              onMouseDown={() => handleSelect(c.name)}
              className="w-full text-left px-5 py-3 text-[15px] text-foreground hover:bg-black/5 transition-colors first:rounded-t-2xl last:rounded-b-2xl"
            >
              {c.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TOTAL_STEPS = 7;

export default function SignupPage() {
  const router = useRouter();

  const [step,            setStep]           = useState(1);
  const [loading,         setLoading]        = useState(false);
  const [error,           setError]          = useState('');
  const [showPass,        setShowPass]       = useState(false);
  const [footType,        setFootType]       = useState<FootType>(null);
  const [usernameStatus,  setUsernameStatus] = useState<UsernameStatus>('idle');
  const firstInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<FormState>({
    firstName: '', lastName: '', username: '', email: '', password: '',
    countryCode: '', city: '',
    sizeSystem: 'UK',
    leftFootSize: '', rightFootSize: '',
    isAmputee: false, amputeeSide: '', neededFootSize: '',
  });

  useEffect(() => {
    setForm(p => ({ ...p, sizeSystem: detectSizeSystem() }));
    const lang = navigator.language || '';
    const region = lang.split('-')[1];
    if (region && SUPPORTED_COUNTRY_CODES.has(region)) {
      setForm(p => ({ ...p, countryCode: region }));
    }
  }, []);

  useEffect(() => {
    setTimeout(() => firstInputRef.current?.focus(), 80);
  }, [step]);

  const cities = useMemo(() => {
    if (!form.countryCode) return [];
    return City.getCitiesOfCountry(form.countryCode) ?? [];
  }, [form.countryCode]);

  const checkUsername = useCallback(async (value: string) => {
    const clean = value.trim().toLowerCase();
    if (!clean) { setUsernameStatus('idle'); return; }
    if (clean.length < 3 || clean.length > 30 || !/^[a-z0-9_]+$/.test(clean)) {
      setUsernameStatus('invalid'); return;
    }
    setUsernameStatus('checking');
    const { data } = await supabase.from('users').select('id').ilike('username', clean).limit(1);
    setUsernameStatus(data && data.length > 0 ? 'taken' : 'available');
  }, []);

  useEffect(() => {
    if (step !== 2) return;
    const timer = setTimeout(() => checkUsername(form.username), 400);
    return () => clearTimeout(timer);
  }, [form.username, step, checkUsername]);

  const strength = useMemo(() => getPasswordStrength(form.password), [form.password]);

  const update = (key: keyof FormState, value: string | boolean) =>
    setForm(p => ({ ...p, [key]: value }));

  const handleFootTypeSelect = (type: 'different' | 'amputee') => {
    setFootType(type);
    setForm(p => ({ ...p, isAmputee: type === 'amputee', amputeeSide: '', neededFootSize: '', leftFootSize: '', rightFootSize: '' }));
    setTimeout(() => setStep(s => s + 1), 350);
  };

  const canProceed = useMemo(() => {
    switch (step) {
      case 1: return form.firstName.trim().length > 0;
      case 2: return usernameStatus === 'available';
      case 3: return /\S+@\S+\.\S+/.test(form.email);
      case 4: return strength.score >= 2;
      case 5: return !!form.countryCode && form.city.trim().length > 0;
      case 6: return footType !== null;
      case 7: {
        if (footType === 'amputee') return !!form.amputeeSide && !!form.neededFootSize;
        return !!form.leftFootSize && !!form.rightFootSize;
      }
      default: return false;
    }
  }, [step, form, footType, strength, usernameStatus]);

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
      username:        form.username || null,
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

  const stepConfig: Record<number, { title: string; subtitle: string }> = {
    1: { title: "What's your name?",      subtitle: "This is how you'll appear on myotherpair." },
    2: { title: "Choose a username",       subtitle: "Your unique @handle. You can always change it later." },
    3: { title: "What's your email?",     subtitle: "Used for your account and verification." },
    4: { title: "Create a password",      subtitle: "At least 8 characters with a mix of letters and numbers." },
    5: { title: "Where are you based?",   subtitle: "We'll show you listings near you." },
    6: { title: "Tell us about your feet", subtitle: "This helps us find you the perfect match." },
    7: {
      title: footType === 'amputee' ? "Which foot do you need?" : "What are your foot sizes?",
      subtitle: footType === 'amputee'
        ? "We'll find single shoes in your size."
        : "We'll match you with someone who complements you.",
    },
  };

  const { title, subtitle } = stepConfig[step] ?? { title: '', subtitle: '' };

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* Progress bar — very top, full bleed */}
      <div className="h-[3px] bg-black/8 w-full flex-shrink-0">
        <div
          className="h-full bg-foreground transition-all duration-500 ease-out"
          style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
        />
      </div>

      {/* Back button */}
      <div className="px-5 pt-12 pb-2 flex-shrink-0">
        <button
          onClick={handleBack}
          className="flex items-center justify-center -ml-1 p-1"
          aria-label="Back"
        >
          <ChevronLeft className="w-7 h-7 text-foreground" />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 px-6 pt-4 pb-6 overflow-y-auto">
        <h1 className="font-display text-[2.6rem] font-bold text-foreground leading-[1.1] tracking-[-0.025em] text-center mb-3">
          {title}
        </h1>
        <p className="text-center text-black/40 text-[15px] mb-10 leading-relaxed max-w-[280px] mx-auto">
          {subtitle}
        </p>

        {/* ── Step 1: Name ────────────────────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-3">
            <div className="bg-white rounded-2xl border border-black/10 px-5 py-4">
              <p className="text-[11px] text-black/35 font-semibold uppercase tracking-wider mb-1.5">First name</p>
              <input
                ref={firstInputRef}
                type="text"
                value={form.firstName}
                onChange={e => update('firstName', e.target.value)}
                onKeyDown={e => e.key === 'Enter' && canProceed && handleNext()}
                placeholder="Your first name"
                autoComplete="given-name"
                className="w-full bg-transparent text-foreground text-[17px] outline-none placeholder-black/20 leading-snug"
              />
            </div>
            <CardInput
              label="Last name (optional)"
              value={form.lastName}
              onChange={v => update('lastName', v)}
              placeholder="Your last name"
              autoComplete="family-name"
            />
          </div>
        )}

        {/* ── Step 2: Username ────────────────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-3">
            <div className={`bg-white rounded-2xl border-2 px-5 py-4 transition-all ${
              usernameStatus === 'taken'   ? 'border-red-300'   :
              usernameStatus === 'invalid' ? 'border-amber-300' :
              usernameStatus === 'available' ? 'border-green-400' :
              'border-black/10'
            }`}>
              <p className="text-[11px] text-black/35 font-semibold uppercase tracking-wider mb-1.5">Username</p>
              <div className="flex items-center gap-1">
                <span className="text-[17px] text-black/25 font-medium select-none">@</span>
                <input
                  ref={firstInputRef}
                  type="text"
                  value={form.username}
                  onChange={e => {
                    const v = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
                    update('username', v);
                    setUsernameStatus('idle');
                  }}
                  onKeyDown={e => e.key === 'Enter' && canProceed && handleNext()}
                  placeholder="your_username"
                  maxLength={30}
                  autoComplete="username"
                  className="flex-1 bg-transparent text-foreground text-[17px] outline-none placeholder-black/20 leading-snug"
                />
                {usernameStatus === 'checking' && (
                  <svg className="w-4 h-4 animate-spin text-black/30 flex-shrink-0" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {usernameStatus === 'available' && <Check className="w-4 h-4 text-green-500 flex-shrink-0" />}
              </div>
            </div>
            {usernameStatus === 'taken' && (
              <p className="text-[12px] text-red-500 px-1">@{form.username} is already taken. Try another.</p>
            )}
            {usernameStatus === 'invalid' && (
              <p className="text-[12px] text-amber-600 px-1">3–30 characters. Letters, numbers, and underscores only.</p>
            )}
            {usernameStatus === 'available' && (
              <p className="text-[12px] text-green-600 px-1">@{form.username} is available!</p>
            )}
          </div>
        )}

        {/* ── Step 3: Email ───────────────────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-3">
            <div className={`bg-white rounded-2xl border-2 px-5 py-4 transition-all ${
              form.email && !/\S+@\S+\.\S+/.test(form.email)
                ? 'border-red-300'
                : form.email && /\S+@\S+\.\S+/.test(form.email)
                  ? 'border-green-400'
                  : 'border-black/10'
            }`}>
              <p className="text-[11px] text-black/35 font-semibold uppercase tracking-wider mb-1.5">Email address</p>
              <input
                ref={firstInputRef}
                type="email"
                value={form.email}
                onChange={e => update('email', e.target.value)}
                onKeyDown={e => e.key === 'Enter' && canProceed && handleNext()}
                placeholder="you@example.com"
                autoComplete="email"
                className="w-full bg-transparent text-foreground text-[17px] outline-none placeholder-black/20 leading-snug"
              />
            </div>
            {form.email && !/\S+@\S+\.\S+/.test(form.email) && (
              <p className="text-[12px] text-red-500 px-1">Please enter a valid email address.</p>
            )}
          </div>
        )}

        {/* ── Step 4: Password ────────────────────────────────────────────── */}
        {step === 4 && (
          <div className="space-y-3">
            <div className="bg-white rounded-2xl border border-black/10 px-5 py-4">
              <p className="text-[11px] text-black/35 font-semibold uppercase tracking-wider mb-1.5">Password</p>
              <div className="flex items-center gap-2">
                <input
                  ref={firstInputRef}
                  type={showPass ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => update('password', e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && canProceed && handleNext()}
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

        {/* ── Step 5: Location ────────────────────────────────────────────── */}
        {step === 5 && (
          <div className="space-y-3">
            <div className="bg-white rounded-2xl border border-black/10 px-5 py-4">
              <p className="text-[11px] text-black/35 font-semibold uppercase tracking-wider mb-1.5">Country</p>
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
            <CityAutocomplete
              cities={cities}
              value={form.city}
              onChange={v => update('city', v)}
              disabled={!form.countryCode}
            />
          </div>
        )}

        {/* ── Step 6: Foot type ───────────────────────────────────────────── */}
        {step === 6 && (
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

        {/* ── Step 7: Sizes ───────────────────────────────────────────────── */}
        {step === 7 && (
          <div className="space-y-4">
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
                  <RadioCard label="Left foot" selected={form.amputeeSide === 'left'} onClick={() => update('amputeeSide', 'left')} />
                  <RadioCard label="Right foot" selected={form.amputeeSide === 'right'} onClick={() => update('amputeeSide', 'right')} />
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
          <div className="mt-6 px-4 py-3 rounded-2xl bg-red-50 border border-red-100">
            <p className="text-[13px] text-red-600">{error}</p>
          </div>
        )}
      </div>

      {/* Sticky continue button */}
      <div className="flex-shrink-0 px-6 pb-12 pt-3 bg-background">
        {step !== 6 && (
          <button
            onClick={handleNext}
            disabled={!canProceed || loading}
            className="w-full h-[54px] rounded-full bg-foreground text-background text-[15px] font-semibold disabled:opacity-25 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
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
        )}
      </div>

    </div>
  );
}

'use client';

import { useState, useRef, useEffect, type KeyboardEvent, type ClipboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { ChevronLeft, Pencil, Check, X } from 'lucide-react';

export default function VerifyOtpPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setEmail(params.get('email') ?? '');
  }, []);

  const [digits,      setDigits]      = useState(['', '', '', '', '', '']);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [resending,   setResending]   = useState(false);
  const [resent,      setResent]      = useState(false);
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailDraft,   setEmailDraft]   = useState('');
  const emailInputRef = useRef<HTMLInputElement>(null);

  const refs = useRef<Array<HTMLInputElement | null>>([null, null, null, null, null, null]);

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  function handleChange(val: string, idx: number) {
    const digit = val.replace(/[^0-9]/g, '').slice(-1);
    setDigits(prev => {
      const next = [...prev];
      next[idx] = digit;
      return next;
    });
    if (digit && idx < 5) {
      refs.current[idx + 1]?.focus();
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>, idx: number) {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) {
      setDigits(prev => {
        const next = [...prev];
        next[idx - 1] = '';
        return next;
      });
      refs.current[idx - 1]?.focus();
    }
    if (e.key === 'ArrowLeft' && idx > 0) refs.current[idx - 1]?.focus();
    if (e.key === 'ArrowRight' && idx < 5) refs.current[idx + 1]?.focus();
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, 6);
    if (!pasted) return;
    const next = ['', '', '', '', '', ''];
    pasted.split('').forEach((ch, i) => { next[i] = ch; });
    setDigits(next);
    const focusIdx = Math.min(pasted.length, 5);
    refs.current[focusIdx]?.focus();
  }

  async function handleVerify() {
    const token = digits.join('');
    if (token.length !== 6) { setError('Please enter all 6 digits.'); return; }
    setLoading(true);
    setError('');

    const { data, error: verifyErr } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'signup',
    });

    if (verifyErr || !data.session) {
      setError(verifyErr?.message ?? 'Invalid or expired code. Please try again.');
      setLoading(false);
      return;
    }

    const uid        = data.session.user.id;
    const profileRaw = sessionStorage.getItem('signup_profile');
    const profile    = profileRaw ? JSON.parse(profileRaw) : null;

    if (profile) {
      await supabase.from('users').upsert({
        id:              uid,
        email,
        name:            profile.name            ?? null,
        location:        profile.location         ?? null,
        foot_size_left:  profile.foot_size_left   ?? null,
        foot_size_right: profile.foot_size_right  ?? null,
        is_amputee:      profile.is_amputee       ?? false,
      });
      sessionStorage.removeItem('signup_profile');
    } else {
      const meta = data.session.user.user_metadata;
      await supabase.from('users').upsert({
        id:    uid,
        email,
        name:  meta?.full_name ?? null,
      });
    }

    router.replace('/app');
  }

  async function handleResend() {
    setResending(true);
    await supabase.auth.resend({ type: 'signup', email });
    setResending(false);
    setResent(true);
    setTimeout(() => setResent(false), 5000);
  }

  function startEditEmail() {
    setEmailDraft(email);
    setEditingEmail(true);
    setTimeout(() => emailInputRef.current?.focus(), 50);
  }

  async function confirmEditEmail() {
    const trimmed = emailDraft.trim();
    if (!trimmed || !/\S+@\S+\.\S+/.test(trimmed)) return;
    setEmail(trimmed);
    setEditingEmail(false);
    setDigits(['', '', '', '', '', '']);
    setError('');
    setResending(true);
    await supabase.auth.resend({ type: 'signup', email: trimmed });
    setResending(false);
    setResent(true);
    setTimeout(() => setResent(false), 5000);
  }

  function cancelEditEmail() {
    setEditingEmail(false);
    setEmailDraft('');
  }

  const filled = digits.join('').length === 6;

  // Auto-submit when all 6 digits filled
  useEffect(() => {
    if (filled && !loading) handleVerify();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filled]);

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* Top bar */}
      <div className="px-4 pt-12 pb-4 flex items-center">
        <button
          onClick={() => router.push('/signup')}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/5 transition-colors"
          aria-label="Back"
        >
          <ChevronLeft className="w-5 h-5 text-foreground" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 px-6 pt-6 pb-4">
        <p className="text-xs font-semibold tracking-[0.2em] uppercase text-black/30 mb-4 text-center">myotherpair</p>
        <h1 className="font-display text-[2rem] font-bold text-foreground leading-tight tracking-[-0.02em] text-center mb-2">
          Check your email
        </h1>
        <p className="text-center text-black/40 text-[14px] mb-3 leading-relaxed">
          We sent a 6-digit code to
        </p>

        {editingEmail ? (
          <div className="bg-white rounded-2xl border-2 border-foreground px-4 py-3 mb-8 flex items-center gap-2">
            <input
              ref={emailInputRef}
              type="email"
              value={emailDraft}
              onChange={e => setEmailDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') confirmEditEmail(); if (e.key === 'Escape') cancelEditEmail(); }}
              className="flex-1 bg-transparent text-foreground text-[15px] outline-none"
              autoComplete="email"
            />
            <button onClick={confirmEditEmail} className="p-1 text-foreground hover:opacity-70 transition-opacity" aria-label="Confirm">
              <Check className="w-4 h-4" />
            </button>
            <button onClick={cancelEditEmail} className="p-1 text-black/30 hover:text-foreground transition-colors" aria-label="Cancel">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 mb-8">
            <p className="text-foreground text-[14px] font-semibold break-all">{email}</p>
            <button
              onClick={startEditEmail}
              className="p-1.5 rounded-full hover:bg-black/5 transition-colors flex-shrink-0"
              aria-label="Edit email"
            >
              <Pencil className="w-3.5 h-3.5 text-black/40" />
            </button>
          </div>
        )}

        {/* OTP boxes */}
        <div className="flex justify-center gap-2.5 mb-6">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={r => { refs.current[i] = r; }}
              type="text"
              inputMode="numeric"
              maxLength={2}
              value={d}
              onChange={e => handleChange(e.target.value, i)}
              onKeyDown={e => handleKeyDown(e, i)}
              onPaste={i === 0 ? handlePaste : undefined}
              onFocus={e => e.target.select()}
              className={`w-12 h-14 rounded-2xl border-2 text-center text-xl font-bold text-foreground bg-white outline-none transition-all duration-150 ${
                d
                  ? 'border-foreground'
                  : 'border-black/10 focus:border-foreground/40'
              }`}
            />
          ))}
        </div>

        {error && (
          <div className="px-4 py-3 rounded-2xl bg-red-50 border border-red-100 mb-4">
            <p className="text-[13px] text-red-600 text-center">{error}</p>
          </div>
        )}

        <button
          onClick={handleVerify}
          disabled={loading || !filled}
          className="w-full h-14 rounded-full bg-foreground text-background text-[15px] font-semibold disabled:opacity-30 transition-opacity active:opacity-80 flex items-center justify-center gap-2 mb-6"
        >
          {loading ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Verifying…
            </>
          ) : 'Verify email'}
        </button>

        <button
          onClick={handleResend}
          disabled={resending || resent}
          className={`w-full text-center text-[13px] transition-colors ${
            resent ? 'text-green-600' : 'text-black/40 hover:text-foreground'
          } disabled:cursor-not-allowed`}
        >
          {resent ? 'Code resent!' : resending ? 'Sending…' : "Didn't receive it? Resend code"}
        </button>
      </div>

    </div>
  );
}

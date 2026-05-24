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

  const [digits,        setDigits]        = useState(['', '', '', '', '', '']);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState('');
  const [resending,     setResending]     = useState(false);
  const [resent,        setResent]        = useState(false);
  const [editingEmail,  setEditingEmail]  = useState(false);
  const [emailDraft,    setEmailDraft]    = useState('');
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

  useEffect(() => {
    if (filled && !loading) handleVerify();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filled]);

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* Back button */}
      <div className="px-5 pt-14 pb-2 flex-shrink-0">
        <button
          onClick={() => router.push('/signup')}
          className="flex items-center justify-center -ml-1 p-1"
          aria-label="Back"
        >
          <ChevronLeft className="w-7 h-7 text-foreground" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 px-6 pt-6 pb-4">
        <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-black/30 mb-5 text-center">
          myotherpair
        </p>
        <h1 className="font-display text-[2.6rem] font-bold text-foreground leading-[1.1] tracking-[-0.025em] text-center mb-3">
          Check your email
        </h1>
        <p className="text-center text-black/40 text-[15px] mb-3 leading-relaxed">
          We sent a 6-digit code to
        </p>

        {/* Email display / edit */}
        {editingEmail ? (
          <div className="bg-white rounded-2xl border-2 border-foreground px-4 py-3 mb-10 flex items-center gap-2">
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
          <div className="flex items-center justify-center gap-2 mb-10">
            <p className="text-foreground text-[15px] font-semibold break-all">{email}</p>
            <button
              onClick={startEditEmail}
              className="p-1.5 rounded-full hover:bg-black/5 transition-colors flex-shrink-0"
              aria-label="Edit email"
            >
              <Pencil className="w-3.5 h-3.5 text-black/35" />
            </button>
          </div>
        )}

        {/* OTP boxes */}
        <div className="flex justify-center gap-3 mb-8">
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
              className={`w-[52px] h-[64px] rounded-2xl border-2 text-center text-2xl font-bold text-foreground outline-none transition-all duration-150 ${
                d
                  ? 'bg-white border-foreground'
                  : 'bg-black/[0.06] border-transparent focus:border-foreground/30 focus:bg-white'
              }`}
            />
          ))}
        </div>

        {error && (
          <div className="px-4 py-3 rounded-2xl bg-red-50 border border-red-100 mb-6">
            <p className="text-[13px] text-red-600 text-center">{error}</p>
          </div>
        )}

        {resent && (
          <div className="px-4 py-3 rounded-2xl bg-green-50 border border-green-100 mb-6">
            <p className="text-[13px] text-green-700 text-center font-medium">Code sent! Check your inbox.</p>
          </div>
        )}
      </div>

      {/* Bottom actions */}
      <div className="flex-shrink-0 px-6 pb-12 pt-3 bg-background space-y-3">
        <button
          onClick={handleVerify}
          disabled={loading || !filled}
          className="w-full h-[54px] rounded-full bg-foreground text-background text-[15px] font-semibold disabled:opacity-25 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
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
          className="w-full h-[54px] rounded-full border-2 border-black/15 bg-transparent text-foreground text-[15px] font-medium disabled:opacity-40 transition-all active:scale-[0.98] hover:border-black/30"
        >
          {resending ? 'Sending…' : "Didn't get a code? Resend"}
        </button>
      </div>

    </div>
  );
}

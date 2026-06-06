'use client';

import { useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { ChevronLeft } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    });

    setLoading(false);
    if (err) { setError(err.message); return; }
    setSent(true);
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">

      <div className="px-5 pt-14 pb-2 flex-shrink-0">
        <a href="/login" className="flex items-center justify-center -ml-1 p-1" aria-label="Back">
          <ChevronLeft className="w-7 h-7 text-foreground" />
        </a>
      </div>

      <div className="flex-1 px-6 pt-6 pb-10 overflow-y-auto">
        <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-muted-foreground/70 mb-5 text-center">
          myotherpair
        </p>

        {sent ? (
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-accent/15 flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h1 className="text-[2rem] font-bold text-foreground leading-tight mb-3">Check your email</h1>
            <p className="text-muted-foreground text-[15px] leading-relaxed mb-8">
              We sent a password reset link to<br />
              <span className="font-semibold text-foreground">{email}</span>
            </p>
            <p className="text-[13px] text-muted-foreground">
              Didn&apos;t get it?{' '}
              <button
                onClick={() => setSent(false)}
                className="text-foreground font-semibold"
              >
                Try again
              </button>
            </p>
          </div>
        ) : (
          <>
            <h1 className="font-display text-[2.6rem] font-bold text-foreground leading-[1.1] tracking-[-0.025em] text-center mb-3">
              Reset password
            </h1>
            <p className="text-center text-muted-foreground text-[15px] mb-10 leading-relaxed">
              Enter your email and we&apos;ll send you a link to reset your password.
            </p>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="bg-card rounded-2xl border border-border px-5 py-4">
                <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider mb-1.5">Email address</p>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                  className="w-full bg-transparent text-foreground text-[17px] outline-none placeholder:text-muted-foreground/40"
                />
              </div>

              {error && (
                <div className="px-4 py-3 rounded-2xl bg-red-500/10 border border-red-500/20">
                  <p className="text-[13px] text-red-500">{error}</p>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading || !email}
                  className="w-full h-[54px] rounded-full bg-foreground text-background text-[15px] font-semibold disabled:opacity-30 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Sending…
                    </>
                  ) : 'Send reset link'}
                </button>
              </div>
            </form>

            <p className="text-center text-[13px] text-muted-foreground mt-8">
              Remember your password?{' '}
              <a href="/login" className="text-foreground font-semibold">Sign in</a>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

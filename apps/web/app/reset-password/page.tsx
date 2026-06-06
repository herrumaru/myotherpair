'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { Eye, EyeOff } from 'lucide-react';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password,  setPassword]  = useState('');
  const [confirm,   setConfirm]   = useState('');
  const [showPass,  setShowPass]  = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [done,      setDone]      = useState(false);
  const [error,     setError]     = useState('');
  const [ready,     setReady]     = useState(false);

  useEffect(() => {
    // Supabase sets the session from the recovery link before we render.
    // Confirm we have a live session before showing the form.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setReady(true);
      } else {
        // No session — the link expired or was already used
        router.replace('/forgot-password');
      }
    });
  }, [router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (err) { setError(err.message); return; }
    setDone(true);
    setTimeout(() => router.replace('/app/browse'), 2000);
  }

  if (!ready) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex gap-1.5">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-2 h-2 rounded-full bg-foreground/30 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">

      <div className="flex-1 px-6 pt-20 pb-10 overflow-y-auto">
        <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-muted-foreground/70 mb-5 text-center">
          myotherpair
        </p>

        {done ? (
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-accent/15 flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-[2rem] font-bold text-foreground mb-3">Password updated</h1>
            <p className="text-muted-foreground text-[15px]">Taking you to the app…</p>
          </div>
        ) : (
          <>
            <h1 className="font-display text-[2.6rem] font-bold text-foreground leading-[1.1] tracking-[-0.025em] text-center mb-3">
              New password
            </h1>
            <p className="text-center text-muted-foreground text-[15px] mb-10 leading-relaxed">
              Choose a strong password for your account.
            </p>

            <form onSubmit={handleSubmit} className="space-y-3">

              <div className="bg-card rounded-2xl border border-border px-5 py-4">
                <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider mb-1.5">New password</p>
                <div className="flex items-center gap-2">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    autoComplete="new-password"
                    required
                    className="flex-1 bg-transparent text-foreground text-[17px] outline-none placeholder:text-muted-foreground/40"
                  />
                  <button type="button" onClick={() => setShowPass(v => !v)} className="text-muted-foreground hover:text-foreground transition-colors">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="bg-card rounded-2xl border border-border px-5 py-4">
                <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider mb-1.5">Confirm password</p>
                <input
                  type={showPass ? 'text' : 'password'}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="Repeat your password"
                  autoComplete="new-password"
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
                  disabled={loading || !password || !confirm}
                  className="w-full h-[54px] rounded-full bg-foreground text-background text-[15px] font-semibold disabled:opacity-30 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Updating…
                    </>
                  ) : 'Update password'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

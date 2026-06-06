'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { ChevronLeft, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email,      setEmail]      = useState('');
  const [password,   setPassword]   = useState('');
  const [showPass,   setShowPass]   = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [authError,  setAuthError]  = useState('');
  const [checking,   setChecking]   = useState(true);
  const [redirectTo, setRedirectTo] = useState('/app/browse');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const r = params.get('redirect');
    if (r && r.startsWith('/')) setRedirectTo(r);
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace(r && r.startsWith('/') ? r : '/app/browse');
      else setChecking(false);
    });
  }, [router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setAuthError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { setAuthError(error.message); return; }
    router.replace(redirectTo);
  }

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/auth/callback` },
    });
  }

  if (checking) {
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

      {/* Back button */}
      <div className="px-5 pt-14 pb-2 flex-shrink-0">
        <a
          href="/"
          className="flex items-center justify-center -ml-1 p-1"
          aria-label="Back"
        >
          <ChevronLeft className="w-7 h-7 text-foreground" />
        </a>
      </div>

      {/* Content */}
      <div className="flex-1 px-6 pt-6 pb-4 overflow-y-auto">
        <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-muted-foreground/70 mb-5 text-center">
          myotherpair
        </p>
        <h1 className="font-display text-[2.6rem] font-bold text-foreground leading-[1.1] tracking-[-0.025em] text-center mb-3">
          Welcome back
        </h1>
        <p className="text-center text-muted-foreground text-[15px] mb-10 leading-relaxed">
          Sign in to your account.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">

          {/* Email */}
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

          {/* Password */}
          <div className="bg-card rounded-2xl border border-border px-5 py-4">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">Password</p>
              <button type="button" className="text-[12px] text-foreground font-semibold">Forgot?</button>
            </div>
            <div className="flex items-center gap-2">
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                className="flex-1 bg-transparent text-foreground text-[17px] outline-none placeholder:text-muted-foreground/40"
              />
              <button type="button" onClick={() => setShowPass(v => !v)} className="text-muted-foreground hover:text-foreground transition-colors">
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {authError && (
            <div className="px-4 py-3 rounded-2xl bg-red-50 border border-red-100">
              <p className="text-[13px] text-red-600">{authError}</p>
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full h-[54px] rounded-full bg-foreground text-background text-[15px] font-semibold disabled:opacity-30 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in…
                </>
              ) : 'Sign in'}
            </button>
          </div>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-4 my-7">
          <div className="flex-1 h-px bg-border" />
          <span className="text-[11px] text-muted-foreground/70 font-semibold uppercase tracking-wider">or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Google */}
        <button
          type="button"
          onClick={handleGoogle}
          className="w-full h-[54px] rounded-full bg-card border-2 border-border flex items-center justify-center gap-3 text-[15px] font-medium text-foreground transition-all active:scale-[0.98] hover:border-border/80"
        >
          <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        <p className="text-center text-[13px] text-muted-foreground mt-8">
          Don&apos;t have an account?{' '}
          <a href="/signup" className="text-foreground font-semibold">Create one</a>
        </p>
      </div>

    </div>
  );
}

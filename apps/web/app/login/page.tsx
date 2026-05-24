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
  const [redirectTo, setRedirectTo] = useState('/app');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const r = params.get('redirect');
    if (r && r.startsWith('/')) setRedirectTo(r);
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace(r && r.startsWith('/') ? r : '/app');
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

      {/* Top bar */}
      <div className="px-4 pt-12 pb-4 flex items-center">
        <a href="/"
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/5 transition-colors"
          aria-label="Back"
        >
          <ChevronLeft className="w-5 h-5 text-foreground" />
        </a>
      </div>

      {/* Content */}
      <div className="flex-1 px-6 pt-6 pb-4">
        <p className="text-xs font-semibold tracking-[0.2em] uppercase text-black/30 mb-4 text-center">myotherpair</p>
        <h1 className="font-display text-[2rem] font-bold text-foreground leading-tight tracking-[-0.02em] text-center mb-2">
          Welcome back
        </h1>
        <p className="text-center text-black/40 text-[14px] mb-10 leading-relaxed">
          Sign in to your account.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">

          {/* Email */}
          <div className="bg-white rounded-2xl border border-black/10 px-5 py-4">
            <p className="text-xs text-black/40 font-medium mb-1">Email</p>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Enter your email"
              autoComplete="email"
              required
              className="w-full bg-transparent text-foreground text-[17px] outline-none placeholder-black/20"
            />
          </div>

          {/* Password */}
          <div className="bg-white rounded-2xl border border-black/10 px-5 py-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-black/40 font-medium">Password</p>
              <button type="button" className="text-xs text-foreground font-medium">Forgot?</button>
            </div>
            <div className="flex items-center gap-2">
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                className="flex-1 bg-transparent text-foreground text-[17px] outline-none placeholder-black/20"
              />
              <button type="button" onClick={() => setShowPass(v => !v)} className="text-black/30 hover:text-black/50 transition-colors">
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {authError && (
            <div className="px-4 py-3 rounded-2xl bg-red-50 border border-red-100">
              <p className="text-[13px] text-red-600">{authError}</p>
            </div>
          )}

          <div className="pt-1">
            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full h-14 rounded-full bg-foreground text-background text-[15px] font-semibold disabled:opacity-30 transition-opacity active:opacity-80 flex items-center justify-center gap-2"
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
        <div className="flex items-center gap-4 my-6">
          <div className="flex-1 h-px bg-black/10" />
          <span className="text-xs text-black/30 font-medium">or</span>
          <div className="flex-1 h-px bg-black/10" />
        </div>

        {/* Google */}
        <button
          type="button"
          onClick={handleGoogle}
          className="w-full h-14 rounded-full bg-white border-2 border-black/10 flex items-center justify-center gap-3 text-[15px] font-medium text-foreground transition-colors hover:bg-black/[0.02] active:bg-black/5"
        >
          <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        <p className="text-center text-[13px] text-black/40 mt-8">
          Don&apos;t have an account?{' '}
          <a href="/signup" className="text-foreground font-semibold">Create one</a>
        </p>
      </div>

    </div>
  );
}

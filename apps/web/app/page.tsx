'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '../lib/supabase';

export default function SplashPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/app');
      else setChecking(false);
    });
  }, [router]);

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/auth/callback` },
    });
  }

  async function handleApple() {
    await supabase.auth.signInWithOAuth({
      provider: 'apple',
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
    <div className="min-h-screen bg-background flex flex-col md:flex-row">

      {/* Left panel — branding (full screen on mobile, half on desktop) */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 pt-20 pb-8 md:pt-0 md:pb-0">
        <Image
          src="/logo-transparent.png"
          alt="myotherpair"
          width={220}
          height={120}
          className="object-contain mb-8 dark:invert"
          priority
        />
        <h1 className="font-display text-[3rem] md:text-[4rem] font-bold text-foreground leading-[1.0] tracking-[-0.03em] text-center mb-4">
          Every shoe<br />deserves<br /><span className="italic text-gradient">a match.</span>
        </h1>
        <p className="text-muted-foreground text-[15px] leading-relaxed text-center max-w-[260px]">
          The marketplace for single shoes, for mismatched feet and single-foot needs.
        </p>
      </div>

      {/* Right panel / bottom sheet — actions */}
      <div className="md:w-[420px] md:flex-shrink-0 md:border-l md:border-border md:flex md:flex-col md:justify-center px-6 pb-14 md:pb-0 md:px-10">
        <p className="text-center text-[11px] text-muted-foreground/50 leading-relaxed mb-5 px-2">
          By continuing you agree to our{' '}
          <span className="underline underline-offset-2 cursor-pointer">Terms of Service</span> and{' '}
          <span className="underline underline-offset-2 cursor-pointer">Privacy Policy</span>.
        </p>

        <div className="space-y-3">
          <a
            href="/signup"
            className="block w-full h-14 rounded-full bg-foreground text-background text-[15px] font-semibold flex items-center justify-center transition-opacity hover:opacity-90 active:opacity-75"
          >
            Create account
          </a>
          <a
            href="/login"
            className="block w-full h-14 rounded-full border-2 border-border text-foreground text-[15px] font-medium flex items-center justify-center transition-opacity hover:opacity-80 active:opacity-60"
          >
            Sign in
          </a>

          <div className="flex items-center gap-3 py-1">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[11px] text-muted-foreground/60 font-medium">or continue with</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <button
            type="button"
            onClick={handleGoogle}
            className="w-full h-14 rounded-full bg-card border-2 border-border text-foreground text-[15px] font-medium flex items-center justify-center gap-3 transition-opacity hover:opacity-80 active:opacity-60"
          >
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <button
            type="button"
            onClick={handleApple}
            className="w-full h-14 rounded-full bg-card border-2 border-border text-foreground text-[15px] font-medium flex items-center justify-center gap-3 transition-opacity hover:opacity-80 active:opacity-60"
          >
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.7 9.05 7.42c1.27.06 2.15.72 2.88.73.97-.15 1.9-.83 2.95-.73 1.25.12 2.17.63 2.81 1.57-2.57 1.61-2.04 5.12.56 6.1-.56 1.56-1.29 3.1-2.2 5.19M12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
            </svg>
            Continue with Apple
          </button>
        </div>
      </div>

    </div>
  );
}

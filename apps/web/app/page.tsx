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

      {/* Hero image */}
      <div className="relative w-full overflow-hidden" style={{ height: '52vh' }}>
        <Image
          src="https://images.unsplash.com/photo-1700178310305-0e05d7930f9f?auto=format&fit=crop&w=800&q=80"
          alt="A pair of white and black sneakers on a warm beige background"
          fill
          className="object-cover object-center"
          priority
        />
      </div>

      {/* Wordmark + headline */}
      <div className="flex-1 flex flex-col items-center justify-center text-center px-8 pt-6">
        <p className="text-[11px] font-semibold tracking-[0.25em] uppercase text-foreground/30 mb-6">
          myotherpair
        </p>

        <h1 className="font-display text-[3.2rem] sm:text-[4rem] font-bold text-foreground leading-[1.0] tracking-[-0.03em] mb-5">
          Every shoe<br />deserves<br /><span className="italic">a match.</span>
        </h1>

        <p className="text-foreground/40 text-[15px] leading-relaxed max-w-[260px]">
          The marketplace for single shoes, for mismatched feet and single-foot needs.
        </p>
      </div>

      {/* Bottom actions */}
      <div className="px-6 pb-14 space-y-3">
        <p className="text-center text-[11px] text-foreground/25 leading-relaxed mb-5 px-4">
          By tapping &lsquo;Create account&rsquo; you agree to our{' '}
          <span className="underline underline-offset-2">Terms of Service</span> and{' '}
          <span className="underline underline-offset-2">Privacy Policy</span>.
        </p>

        <a
          href="/signup"
          className="block w-full h-14 rounded-full bg-foreground text-background text-[15px] font-semibold flex items-center justify-center transition-opacity hover:opacity-80 active:opacity-70"
        >
          Create account
        </a>

        <a
          href="/login"
          className="block w-full h-14 rounded-full border-2 border-foreground/15 text-foreground text-[15px] font-medium flex items-center justify-center transition-opacity hover:opacity-70 active:opacity-50"
        >
          Sign in
        </a>
      </div>

    </div>
  );
}

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
    <div className="min-h-screen bg-white flex flex-col">

      {/* Centered logo */}
      <div className="flex-1 flex items-center justify-center px-10">
        <Image
          src="/logo-white.png"
          alt="myotherpair"
          width={300}
          height={164}
          className="object-contain w-full max-w-[300px]"
        />
      </div>

      {/* Bottom text + actions */}
      <div className="px-6 pb-14">
        <h1 className="font-display text-[3.2rem] font-bold text-foreground leading-[1.0] tracking-[-0.03em] mb-3 text-center">
          Every shoe<br />deserves<br /><span className="italic">a match.</span>
        </h1>
        <p className="text-foreground/40 text-[14px] leading-relaxed text-center mb-8 max-w-[260px] mx-auto">
          The marketplace for single shoes, for mismatched feet and single-foot needs.
        </p>

        <p className="text-center text-[11px] text-foreground/25 leading-relaxed mb-5 px-4">
          By tapping &lsquo;Create account&rsquo; you agree to our{' '}
          <span className="underline underline-offset-2">Terms of Service</span> and{' '}
          <span className="underline underline-offset-2">Privacy Policy</span>.
        </p>

        <div className="space-y-3">
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

    </div>
  );
}

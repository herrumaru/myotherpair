'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase';

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        router.replace('/reset-password');
        return;
      }

      if (event === 'SIGNED_IN' && session?.user) {
        const user = session.user;

        // Check if user row already exists
        const { data: existing } = await supabase
          .from('users')
          .select('id')
          .eq('id', user.id)
          .single();

        if (!existing) {
          // Build name from OAuth metadata (Google/Apple populate different fields)
          const name =
            user.user_metadata?.full_name ||
            [user.user_metadata?.given_name, user.user_metadata?.family_name]
              .filter(Boolean).join(' ') ||
            null;

          await supabase.from('users').insert({
            id:    user.id,
            name:  name,
            email: user.email,
          });
        }

        router.replace('/app');
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex gap-1.5">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="w-2.5 h-2.5 rounded-full bg-accent animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, MessageCircle, ShoppingBag } from 'lucide-react';
import { Button } from '../../../components/ui/Button';

export default function OrderSuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [countdown, setCountdown] = useState(8);

  const sessionId = searchParams.get('session_id');

  // Auto-redirect to messages after countdown
  useEffect(() => {
    if (countdown <= 0) {
      router.push('/app/messages');
      return;
    }
    const t = setTimeout(() => setCountdown(n => n - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, router]);

  if (!sessionId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-5">
        <div className="text-center">
          <p className="text-muted-foreground">Invalid page.</p>
          <Link href="/app/browse" className="text-accent font-semibold text-sm mt-2 inline-block">Browse listings →</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5 text-center">
      <div className="max-w-sm w-full space-y-6">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center">
            <CheckCircle className="h-10 w-10 text-green-500" strokeWidth={1.5} />
          </div>
        </div>

        {/* Heading */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Payment confirmed!</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Your purchase went through. Message the seller to arrange shipping.
          </p>
        </div>

        {/* Actions */}
        <div className="space-y-2.5 pt-2">
          <Link href="/app/messages">
            <Button variant="hero" size="lg" className="w-full rounded-xl gap-2" style={{ height: 52 }}>
              <MessageCircle className="h-5 w-5" />
              Message seller
            </Button>
          </Link>
          <Link href="/app/browse">
            <Button variant="outline" size="lg" className="w-full rounded-xl gap-2" style={{ height: 52 }}>
              <ShoppingBag className="h-5 w-5" />
              Browse more listings
            </Button>
          </Link>
        </div>

        <p className="text-xs text-muted-foreground/50">
          Redirecting to messages in {countdown}s…
        </p>
      </div>
    </div>
  );
}

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
  apiVersion: '2026-05-27.dahlia',
});

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
);

// Next.js requires raw body for Stripe signature verification
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const sig = req.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return NextResponse.json({ error: 'Missing signature or webhook secret' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    const rawBody = await req.text();
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error('[stripe/webhook] Signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const { listing_id, buyer_id, seller_id } = session.metadata ?? {};

    if (!listing_id || !buyer_id || !seller_id) {
      console.error('[stripe/webhook] Missing metadata on session:', session.id);
      return NextResponse.json({ received: true });
    }

    const paymentIntentId = typeof session.payment_intent === 'string'
      ? session.payment_intent
      : (session.payment_intent as Stripe.PaymentIntent | null)?.id ?? null;

    // Mark order as paid
    await supabaseAdmin
      .from('orders')
      .update({
        status:                 'paid',
        stripe_payment_intent:  paymentIntentId,
      })
      .eq('stripe_checkout_id', session.id);

    // Mark listing as sold
    await supabaseAdmin
      .from('listings')
      .update({ status: 'sold' })
      .eq('id', listing_id);

    // Notify seller via email
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    fetch(`${appUrl}/api/notifications/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type:      'sale_completed',
        toUserId:  seller_id,
        listingId: listing_id,
      }),
    }).catch(() => {});
  }

  return NextResponse.json({ received: true });
}

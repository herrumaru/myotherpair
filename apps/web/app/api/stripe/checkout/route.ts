import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
  apiVersion: '2025-05-28.basil',
});

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
);

export async function POST(req: NextRequest) {
  try {
    const { listingId, buyerId } = await req.json() as { listingId: string; buyerId: string };

    if (!listingId || !buyerId) {
      return NextResponse.json({ error: 'Missing listingId or buyerId' }, { status: 400 });
    }

    // Fetch listing + seller
    const { data: listing, error: listingErr } = await supabaseAdmin
      .from('listings')
      .select('id, shoe_brand, shoe_model, size, price, user_id, status, photos')
      .eq('id', listingId)
      .single();

    if (listingErr || !listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }

    const l = listing as {
      id: string; shoe_brand: string; shoe_model: string; size: number;
      price: number | null; user_id: string; status: string; photos: string[];
    };

    if (l.status === 'sold') {
      return NextResponse.json({ error: 'This listing has already been sold' }, { status: 409 });
    }

    if (l.price == null || l.price <= 0) {
      return NextResponse.json({ error: 'This listing has no price set' }, { status: 400 });
    }

    if (l.user_id === buyerId) {
      return NextResponse.json({ error: 'You cannot buy your own listing' }, { status: 400 });
    }

    const amountCents = Math.round(l.price * 100);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${l.shoe_brand} ${l.shoe_model}`,
              description: `UK size ${l.size} · Single shoe`,
              images: l.photos?.[0] ? [l.photos[0]] : [],
            },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${appUrl}/app/orders/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${appUrl}/app/listing/${listingId}`,
      metadata: {
        listing_id: listingId,
        buyer_id:   buyerId,
        seller_id:  l.user_id,
      },
    });

    // Create pending order record
    await supabaseAdmin.from('orders').insert({
      listing_id:          listingId,
      buyer_id:            buyerId,
      seller_id:           l.user_id,
      amount_cents:        amountCents,
      currency:            'usd',
      stripe_checkout_id:  session.id,
      status:              'pending',
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('[stripe/checkout]', err);
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
}

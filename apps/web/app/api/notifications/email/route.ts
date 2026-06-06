import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
);

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? '';
const FROM_EMAIL     = 'MyOtherPair <noreply@myotherpair.com>';
const APP_URL        = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set — skipping email');
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error('[email] Resend error:', res.status, body);
  }
}

async function getUserEmail(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('users')
    .select('email')
    .eq('id', userId)
    .single();
  return (data as { email: string } | null)?.email ?? null;
}

async function getListingTitle(listingId: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from('listings')
    .select('shoe_brand, shoe_model')
    .eq('id', listingId)
    .single();
  const l = data as { shoe_brand: string; shoe_model: string } | null;
  return l ? `${l.shoe_brand} ${l.shoe_model}` : 'your listing';
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      type: string;
      toUserId: string;
      listingId?: string;
      matchId?: string;
    };

    const { type, toUserId, listingId } = body;

    const toEmail = await getUserEmail(toUserId);
    if (!toEmail) {
      return NextResponse.json({ ok: true, skipped: 'no email found' });
    }

    if (type === 'new_contact') {
      const title = listingId ? await getListingTitle(listingId) : 'your listing';
      const listingUrl = listingId ? `${APP_URL}/app/listing/${listingId}` : APP_URL;

      await sendEmail(
        toEmail,
        `Someone wants to buy your ${title}!`,
        `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
            <h2 style="margin-bottom:8px">You have a new message!</h2>
            <p style="color:#555">Someone reached out about your listing: <strong>${title}</strong>.</p>
            <p style="margin-top:24px">
              <a href="${APP_URL}/app/messages" style="background:#f05d23;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
                View message →
              </a>
            </p>
            <p style="color:#999;font-size:12px;margin-top:32px">
              You received this email because someone contacted you on MyOtherPair.<br>
              <a href="${listingUrl}" style="color:#f05d23">View listing</a>
            </p>
          </div>
        `,
      );
    } else if (type === 'sale_completed') {
      const title = listingId ? await getListingTitle(listingId) : 'your listing';

      await sendEmail(
        toEmail,
        `Your ${title} just sold on MyOtherPair!`,
        `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
            <h2 style="margin-bottom:8px">Congratulations, you made a sale! 🎉</h2>
            <p style="color:#555">Your listing <strong>${title}</strong> has been purchased.</p>
            <p style="color:#555">Please arrange shipping with the buyer through your messages.</p>
            <p style="margin-top:24px">
              <a href="${APP_URL}/app/messages" style="background:#f05d23;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
                Open messages →
              </a>
            </p>
            <p style="color:#999;font-size:12px;margin-top:32px">
              MyOtherPair — Every shoe deserves a match.
            </p>
          </div>
        `,
      );
    } else if (type === 'new_message') {
      await sendEmail(
        toEmail,
        'You have a new message on MyOtherPair',
        `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
            <h2 style="margin-bottom:8px">New message waiting!</h2>
            <p style="color:#555">Someone sent you a message on MyOtherPair.</p>
            <p style="margin-top:24px">
              <a href="${APP_URL}/app/messages" style="background:#f05d23;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
                Read message →
              </a>
            </p>
            <p style="color:#999;font-size:12px;margin-top:32px">
              MyOtherPair — Every shoe deserves a match.
            </p>
          </div>
        `,
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[notifications/email]', err);
    return NextResponse.json({ error: 'Failed to send notification' }, { status: 500 });
  }
}

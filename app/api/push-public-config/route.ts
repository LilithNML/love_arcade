import { NextResponse } from 'next/server';

export async function GET() {
  const fallbackKey = 'BMxdhgSVCuO4Vad8c_Wj8a-nAC3AgUBqjDhGKJb6Fm1ZvJ1ZFvNd1VzeF1KZsl2kvJYMbC6hBjaK93dH9jeGFqg';
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || fallbackKey;
  return NextResponse.json(
    { vapidPublicKey },
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } },
  );
}

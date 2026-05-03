import { NextResponse } from 'next/server';

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_LA_CLOUD_URL || '';
  const supabaseKey = process.env.NEXT_PUBLIC_LA_CLOUD_ANON_KEY || '';

  return NextResponse.json(
    { supabaseUrl, supabaseKey },
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate', Pragma: 'no-cache' } },
  );
}

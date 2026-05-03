import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ error: 'Use Next.js route handlers migration for /api endpoints before production.' }, { status: 501 });
}
export const POST = GET;

import fs from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8',
};

export async function serveRepoFile(baseDir: string, segments: string[] = []) {
  const repoRoot = process.cwd();
  const target = path.resolve(repoRoot, baseDir, ...segments);
  const allowedRoot = path.resolve(repoRoot, baseDir);

  if (!target.startsWith(allowedRoot)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const data = await fs.readFile(target);
    const ext = path.extname(target).toLowerCase();
    const type = MIME[ext] ?? 'application/octet-stream';
    return new NextResponse(data, { headers: { 'content-type': type, 'cache-control': 'public, max-age=31536000, immutable' } });
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}

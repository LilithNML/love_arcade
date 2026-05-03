import { serveRepoFile } from '@/lib/server-static';
export async function GET() { return serveRepoFile('.', ['manifest.webmanifest']); }

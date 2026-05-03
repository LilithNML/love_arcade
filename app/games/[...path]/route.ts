import { serveRepoFile } from '@/lib/server-static';

export async function GET(_: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return serveRepoFile('games', path);
}

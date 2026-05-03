import { getActiveEvents, getShopCatalog } from '@/lib/services/data-service';

export default async function HomePage() {
  const [events, shop] = await Promise.all([getActiveEvents(), getShopCatalog()]);

  return (
    <main style={{ padding: 24 }}>
      <h1>Love Arcade · Next.js Foundation</h1>
      <p>Eventos activos: {events.length}</p>
      <p>Items en tienda: {shop.length}</p>
    </main>
  );
}

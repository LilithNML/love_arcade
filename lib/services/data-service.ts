import eventsJson from '@/data/events.json';
import shopJson from '@/data/shop.json';
import type { ActiveEvent, EventsPayload } from '@/lib/data/events';
import type { ShopItem } from '@/lib/data/shop';

const events = eventsJson as EventsPayload;
const shop = shopJson as ShopItem[];

export async function getActiveEvents(now = new Date()): Promise<ActiveEvent[]> {
  return events.activeEvents.filter((event) => {
    const start = new Date(event.startDate);
    const end = new Date(event.endDate);
    return now >= start && now <= end;
  });
}

export async function getEventsCatalog(): Promise<ActiveEvent[]> {
  return events.activeEvents;
}

export async function getShopCatalog(): Promise<ShopItem[]> {
  return shop;
}

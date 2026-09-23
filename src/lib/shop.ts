import { getCollection, type CollectionEntry } from 'astro:content';
import home from '../data/home.json';

export type Product = CollectionEntry<'products'>;
export { home };

export const slugify = (s: string) =>
  s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const fmt = new Intl.NumberFormat('en-NG', { maximumFractionDigits: 0 });
export const naira = (n: number) => `₦${fmt.format(n)}`;

export const isSoldOut = (p: Product) =>
  p.data.sizes.length > 0 && p.data.sizes.every((s) => !s.in_stock);
export const isOnSale = (p: Product) =>
  p.data.compare_at_price != null && p.data.compare_at_price > p.data.price;
export const percentOff = (p: Product) =>
  isOnSale(p) ? Math.round((1 - p.data.price / p.data.compare_at_price!) * 100) : 0;

export async function getProducts() {
  const all = await getCollection('products', ({ data }) => data.published);
  return all.sort((a, b) => (b.data.date?.getTime() ?? 0) - (a.data.date?.getTime() ?? 0));
}

export async function getCategories() {
  const products = await getProducts();
  const counts = new Map<string, number>();
  for (const p of products) counts.set(p.data.category, (counts.get(p.data.category) ?? 0) + 1);
  return [...counts].map(([name, count]) => ({ name, count, slug: slugify(name) }));
}

export const deliveryFee = Number(import.meta.env.PUBLIC_DELIVERY_FEE ?? 0) || 0;
export const freeDeliveryOver = Number(import.meta.env.PUBLIC_FREE_DELIVERY_OVER ?? 0) || 0;

// Bag stored in the shopper's browser (localStorage). Prices are never trusted
// from here: the checkout function re-prices every line from products.json.
export type Line = { slug: string; size: string; qty: number };
export type CatalogItem = {
  slug: string; title: string; price: number; category: string; image: string;
  sizes: { size: string; in_stock: boolean }[];
};

const KEY = 'poms-bag';
const MAX_QTY = 10;

export function read(): Line[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}

export function write(lines: Line[]) {
  try { localStorage.setItem(KEY, JSON.stringify(lines)); } catch {}
  updateCount();
  window.dispatchEvent(new CustomEvent('bag:change'));
}

export function add(slug: string, size: string, qty = 1, open = true) {
  const lines = read();
  const hit = lines.find((l) => l.slug === slug && l.size === size);
  if (hit) hit.qty = Math.min(hit.qty + qty, MAX_QTY);
  else lines.push({ slug, size, qty });
  write(lines);
  if (open) window.dispatchEvent(new CustomEvent('bag:open'));
}

export function setQty(slug: string, size: string, qty: number) {
  const lines = read()
    .map((l) => (l.slug === slug && l.size === size ? { ...l, qty: Math.min(qty, MAX_QTY) } : l))
    .filter((l) => l.qty > 0);
  write(lines);
}

export const clear = () => write([]);

export function updateCount() {
  const n = read().reduce((sum, l) => sum + l.qty, 0);
  document.querySelectorAll('[data-bag-count]').forEach((el) => (el.textContent = String(n)));
}

let catalog: Promise<CatalogItem[]> | null = null;
export function loadCatalog() {
  catalog ??= fetch('/products.json').then((r) => r.json());
  return catalog;
}

/** Bag lines joined to live product data; drops items that were removed from the shop. */
export async function resolved() {
  const items = await loadCatalog();
  return read()
    .map((l) => ({ ...l, product: items.find((p) => p.slug === l.slug) }))
    .filter((l): l is Line & { product: CatalogItem } => Boolean(l.product));
}

const fmt = new Intl.NumberFormat('en-NG', { maximumFractionDigits: 0 });
export const naira = (n: number) => `₦${fmt.format(n)}`;

export const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Delivery fee for a subtotal. Settings are read from data attributes on <body>. */
export function deliveryFor(subtotal: number) {
  const fee = Number(document.body.dataset.deliveryFee) || 0;
  const freeOver = Number(document.body.dataset.freeOver) || 0;
  return freeOver && subtotal >= freeOver ? 0 : fee;
}
export const freeOver = () => Number(document.body.dataset.freeOver) || 0;

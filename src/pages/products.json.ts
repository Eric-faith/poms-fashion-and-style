import type { APIRoute } from 'astro';
import { getProducts } from '../lib/shop';

// Built into /products.json. The bag and the checkout function read prices from here,
// so the price a shopper pays always matches what's published in the CMS.
export const GET: APIRoute = async () => {
  const products = await getProducts();
  const data = products.map((p) => ({
    slug: p.id,
    title: p.data.title,
    price: p.data.price,
    category: p.data.category,
    image: p.data.images[0],
    sizes: p.data.sizes,
  }));
  return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
};

import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Each product is one Markdown file in src/content/products/, written by Decap CMS.
// Frontmatter holds the structured fields; the Markdown body is the full description.
const products = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/products' }),
  schema: z.object({
    title: z.string(),
    price: z.number().int().nonnegative(),
    compare_at_price: z.number().int().nonnegative().nullish(),
    category: z.string(),
    summary: z.string().nullish(),
    badge: z.string().nullish(),
    images: z.array(z.string()).min(1),
    sizes: z
      .array(z.object({ size: z.string(), in_stock: z.boolean().default(true) }))
      .nullish()
      .transform((v) => v ?? []),
    size_fit: z.string().nullish(),
    featured: z.boolean().default(false),
    published: z.boolean().default(true),
    date: z.coerce.date().optional(),
  }),
});

export const collections = { products };

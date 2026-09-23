import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://pomsfashion.netlify.app', // change to the live domain
  trailingSlash: 'always',
  vite: { plugins: [tailwindcss()] },
});

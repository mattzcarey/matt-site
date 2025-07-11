import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import cloudflare from '@astrojs/cloudflare';
import mdx from '@astrojs/mdx';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

export default defineConfig({
  site: 'https://mattzcarey.com',
  integrations: [
    react(),
    tailwind({
      applyBaseStyles: false,
    }),
    mdx({
      remarkPlugins: [remarkMath],
      rehypePlugins: [rehypeKatex],
    }),
  ],
  output: 'server',
  adapter: cloudflare({
    mode: 'advanced',
    functionPerRoute: false,
  }),
  markdown: {
    remarkPlugins: [remarkMath],
    rehypePlugins: [rehypeKatex],
  },
  vite: {
    resolve: {
      alias: {
        '@': '/src',
      },
    },
  },
});
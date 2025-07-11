import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import cloudflare from '@astrojs/cloudflare';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

export default defineConfig({
  site: 'https://mattzcarey.com',
  output: 'static',
  integrations: [
    tailwind({
      applyBaseStyles: false,
    }),
    mdx({
      remarkPlugins: [remarkMath],
      rehypePlugins: [rehypeKatex],
    }),
    sitemap(),
  ],
  adapter: cloudflare({
    platformProxy: {
      enabled: true,
    },
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
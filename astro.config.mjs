import { defineConfig } from 'astro/config';
export default defineConfig({ site: process.env.SITE_ORIGIN || 'http://localhost:4321', base: process.env.BLOG_BASE || '/', trailingSlash: 'always', devToolbar: { enabled: false } });

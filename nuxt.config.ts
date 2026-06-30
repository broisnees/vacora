// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: false },
  app: {
    head: {
      title: 'vacora — brand & product name availability checker',
      htmlAttrs: { lang: 'en' },
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        {
          name: 'description',
          content:
            'Check if a brand or product name is free across 100+ places — domains, package registries, code hosts, social and creator platforms — in one search. Get a brandability score.',
        },
        { name: 'theme-color', content: '#0a0a0b' },
      ],
      script: [
        {
          // Set the theme before first paint to avoid a flash of the wrong theme.
          innerHTML:
            "(function(){try{var t=localStorage.getItem('vacora-theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme='dark';}})();",
          tagPosition: 'head',
        },
      ],
      link: [
        {
          rel: 'icon',
          type: 'image/svg+xml',
          href: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🔎</text></svg>',
        },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap',
        },
      ],
    },
  },
  css: ['~/assets/main.css'],
  nitro: {
    routeRules: {
      '/api/**': { cors: true },
    },
  },
})

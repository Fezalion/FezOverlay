// vite.config.js (CommonJS)
export default async () => {
  const { defineConfig } = await import('vite');
  return defineConfig({
    // config here
  });
};


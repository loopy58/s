import { defineConfig } from 'vite';

// 빌드 결과(JS·CSS)를 index.html 한 파일에 모두 넣습니다.
// 덕분에 dist/index.html 을 더블클릭하기만 해도 게임이 실행됩니다.
function inlineEverything() {
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return {
    name: 'inline-everything',
    apply: 'build',
    enforce: 'post',
    generateBundle(_, bundle) {
      const html = Object.values(bundle).find((f) => f.fileName.endsWith('.html'));
      if (!html) return;
      let src = String(html.source);
      for (const [name, file] of Object.entries(bundle)) {
        if (file.type === 'chunk' && name.endsWith('.js')) {
          const re = new RegExp(`<script[^>]*src="[^"]*${esc(name)}"[^>]*></script>`);
          const code = file.code.replace(/<\/script/gi, '<\\/script');
          src = src.replace(re, () => '');
          src = src.replace('</body>', () => `<script type="module">${code}</script>\n</body>`);
          delete bundle[name];
        } else if (file.type === 'asset' && name.endsWith('.css')) {
          const re = new RegExp(`<link[^>]*href="[^"]*${esc(name)}"[^>]*>`);
          src = src.replace(re, () => `<style>${file.source}</style>`);
          delete bundle[name];
        }
      }
      html.source = src;
    },
  };
}

export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 2000,
  },
  plugins: [inlineEverything()],
});

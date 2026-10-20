(function () {
  'use strict';
  // 只渲染 Markdown；不执行文章脚本或 Liquid 模板。共享博客的真实 CSS 文件。
  const V = window.BlogVendor;
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function create(frame) {
    let queued = null;
    const styles = ['style.css', 'typography.css'].map(file => new URL('../assets/css/' + file, document.baseURI).href);
    frame.srcdoc = '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\' file: http: https:; img-src data: blob: file: http: https:; font-src file: http: https: data:;">' +
      styles.map(url => '<link rel="stylesheet" href="' + escape(url) + '">').join('') +
      '</head><body><div class="container"><article class="reading"><header class="post-header"><h1 id="preview-title"></h1><time class="muted" id="preview-date"></time></header><div id="preview-body" class="prose"></div></article></div></body></html>';
    frame.addEventListener('load', () => {
      frame.contentDocument.addEventListener('click', event => { if (event.target.closest('a')) event.preventDefault(); });
      if (queued) update(...queued);
    });
    function update(article, resolveImage) {
      queued = [article, resolveImage];
      const doc = frame.contentDocument;
      if (!doc || !doc.getElementById('preview-body')) return;
      doc.getElementById('preview-title').textContent = article.title || '未命名文章';
      doc.getElementById('preview-date').textContent = (article.date || '').replaceAll('-', '.');
      const html = V.marked.parse(article.markdown || '', { gfm: true, breaks: false });
      const clean = V.DOMPurify.sanitize(html, {
        USE_PROFILES: { html: true },
        FORBID_TAGS: ['style', 'iframe', 'form', 'input', 'button', 'object', 'embed'],
        FORBID_ATTR: ['style'],
      });
      const body = doc.getElementById('preview-body');
      body.innerHTML = clean;
      body.querySelectorAll('img').forEach(img => {
        const src = img.getAttribute('src') || '';
        const mapped = resolveImage(src);
        if (mapped) img.src = mapped;
        else if (src.startsWith('/assets/')) img.src = new URL('..' + src, document.baseURI).href;
        else if (!/^(?:https?:|data:|blob:|file:)/i.test(src)) img.src = new URL('../' + src, document.baseURI).href;
      });
    }
    return { update };
  }
  window.BlogPreview = { create };
})();

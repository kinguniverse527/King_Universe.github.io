/* GitHub 连接界面与文章工作流；编辑器和 API 客户端通过小接口组合。 */
(function (root) {
  'use strict';
  const $ = id => document.getElementById(id);
  const F = root.BlogFiles;
  const defaults = { owner: 'kinguniverse527', repo: 'kinguniverse527.github.io', branch: 'main' };
  const SETTINGS_KEY = 'king-universe-github-settings';

  function mount(editor) {
    let settings = { ...defaults };
    try {
      const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
      for (const key of Object.keys(defaults)) if (typeof saved?.[key] === 'string') settings[key] = saved[key];
    } catch { /* 无本地设置时使用博客默认值。 */ }
    let client = null;
    let identity = null;
    let busy = false;
    let pendingDelete = null;
    let items = [];
    for (const key of Object.keys(defaults)) $('github-' + key).value = settings[key];

    const sameRepository = remote => remote && remote.owner === settings.owner && remote.repo === settings.repo && remote.branch === settings.branch;
    function repositoryURL() { return 'https://github.com/' + encodeURIComponent(settings.owner) + '/' + encodeURIComponent(settings.repo); }
    function update() {
      const remote = editor.getDraft().remote;
      $('connection-badge').textContent = client ? 'GitHub 已连接 · ' + identity : '未连接 GitHub';
      $('connect-button').textContent = client ? '连接设置' : '连接 GitHub';
      $('disconnect-button').hidden = !client;
      $('refresh-remote').disabled = !client || busy;
      $('publish-button').disabled = !client || busy;
      $('publish-button').textContent = remote && !remote.deleted ? '更新线上文章 ↗' : '发布到博客 ↗';
      $('delete-remote').hidden = !(client && sameRepository(remote) && remote.sha && !remote.deleted && !remote.uncertain);
      $('article-origin').textContent = remote ? (remote.deleted ? '已删除线上版本 · 本机草稿保留' : remote.uncertain ? '提交结果待确认 · 请重新打开线上版本核对' : '关联文章：' + remote.path) : '本机草稿 · 尚未关联线上文章';
    }
    async function perform(action) {
      if (busy) return;
      busy = true;
      editor.setBusy(true);
      $('connect-form').inert = true;
      try { await action(); }
      catch (error) { editor.message(error.message || '操作未完成，请重试。', true); }
      finally {
        busy = false;
        editor.setBusy(false);
        $('connect-form').inert = false;
        update();
      }
    }
    function setupLink() {
      const params = new URLSearchParams({ name: '博客写作室', description: '仅供个人博客文章管理', target_name: $('github-owner').value.trim(), expires_in: '30', contents: 'write' });
      $('create-token-link').href = 'https://github.com/settings/personal-access-tokens/new?' + params;
    }
    async function refresh() {
      $('remote-status').textContent = '正在读取文章列表…';
      items = await client.listPosts();
      $('remote-list').replaceChildren();
      for (const item of items) {
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'draft-item'; button.dataset.path = item.path;
        const name = document.createElement('strong');
        name.textContent = item.name.slice(11).replace(/\.(md|markdown)$/i, '');
        const date = document.createElement('small'); date.textContent = item.name.slice(0, 10);
        button.title = item.path; button.append(name, date);
        button.addEventListener('click', () => perform(() => openPost(item.path)));
        $('remote-list').append(button);
      }
      $('remote-status').textContent = items.length ? settings.branch + ' · ' + items.length + ' 篇文章' : '还没有文章。点 ＋ 写第一篇，发布时会自动创建 _posts。';
    }
    async function refreshAfterWrite() {
      try { await refresh(); }
      catch { $('remote-status').textContent = '提交已完成，列表刷新失败；稍后点“刷新”。'; }
    }
    function sourceAssets(markdown) {
      const paths = new Set();
      root.BlogVendor.marked.walkTokens(root.BlogVendor.marked.lexer(markdown), token => {
        if (token.type !== 'image') return;
        let name;
        try { name = decodeURIComponent(token.href).replace(/^\//, ''); } catch { return; }
        if (/^assets\/images\/(?:[\p{L}\p{N}_. -]+\/)*[\p{L}\p{N}_. -]+\.(png|jpe?g|webp|gif)$/iu.test(name) && !name.includes('..')) paths.add(name);
      });
      return [...paths];
    }
    async function openPost(path) {
      await editor.flush();
      editor.message('正在读取线上文章和图片…');
      const file = await client.readPost(path);
      const article = F.parseArticle(file.text, path.split('/').pop());
      const assets = [];
      let failed = 0, total = 0;
      for (const imagePath of sourceAssets(article.markdown)) {
        try {
          const image = await client.getFile(imagePath, file.headSha);
          if (image.bytes.length > 8 * 1024 * 1024 || total + image.bytes.length > 40 * 1024 * 1024) throw new Error('图片过大');
          total += image.bytes.length;
          const ext = imagePath.split('.').pop().toLowerCase();
          assets.push({ path: imagePath, remoteSha: image.sha, blob: new Blob([image.bytes], { type: /^jpe?g$/.test(ext) ? 'image/jpeg' : 'image/' + ext }) });
        } catch { failed += 1; }
      }
      await editor.openRemote(article, assets, { ...settings, path, sha: file.sha, commitSha: file.headSha });
      editor.message('已打开线上文章。本机草稿会自动保存，点“更新线上文章”才会提交。' + (failed ? ' 有 ' + failed + ' 张图片未能下载，原引用已保留。' : ''));
    }
    function validate(article) {
      const errors = F.validateArticle(article);
      if (errors.length) throw new Error(errors.join(' '));
      if (article.date > F.todayShanghai()) throw new Error('当前博客不自动定时发布。请改为今天或更早的日期。');
      if (/blob:|data:image\//i.test(article.markdown)) throw new Error('正文有未归档的临时图片，请重新插入后再发布。');
    }
    function showResult(result, deleted, unpublished) {
      $('publish-result').hidden = false;
      $('publish-result-text').textContent = deleted ? '已提交删除，等待网站部署。' : unpublished ? '已提交；文章保留 published: false，不会出现在公开博客。' : '已提交到 GitHub，等待网站部署。';
      $('commit-link').href = repositoryURL() + '/commit/' + encodeURIComponent(result.commitSha);
      $('deploy-link').href = repositoryURL() + '/actions';
    }
    async function remember(remote) {
      try { await editor.updateRemote(remote); return true; }
      catch { return false; }
    }
    async function publish() {
      if (!client) throw new Error('请先连接 GitHub。');
      await editor.flush();
      const draft = editor.getDraft();
      validate(draft.article);
      if (draft.remote && !sameRepository(draft.remote)) throw new Error('这篇草稿关联另一个仓库或分支。请连接原仓库，或导出后重新导入为新文章。');
      if (draft.remote?.uncertain) throw new Error('上次提交结果尚未确认。请先导出备份，再从左侧重新打开线上文章核对。');
      const path = draft.remote?.path || '_posts/' + F.filenameFor(draft.article);
      const assets = [];
      for (const asset of draft.attachments) {
        if (!asset.remoteSha && draft.article.markdown.includes(asset.path)) assets.push({ path: asset.path, bytes: new Uint8Array(await asset.blob.arrayBuffer()) });
      }
      editor.message('正在提交文章和图片，请保持页面打开…');
      let result;
      try {
        result = await client.publish({ path, text: F.serializeArticle(draft.article), expectedSha: draft.remote?.deleted ? null : draft.remote?.sha || null, assets, message: (draft.remote && !draft.remote.deleted ? '更新文章：' : '发布文章：') + draft.article.title });
      } catch (error) {
        if (error.uncertain) await remember({ ...settings, ...draft.remote, path, uncertain: true });
        throw error;
      }
      const saved = await remember({ ...settings, path, sha: result.sha, commitSha: result.commitSha });
      showResult(result, false, draft.article.metadata?.published === false);
      editor.message(saved ? '文章已提交。部署完成后，读者才会看到新版本。' : 'GitHub 提交已完成，但本机草稿保存失败。请导出备份，不要重复提交。', !saved);
      await refreshAfterWrite();
    }
    async function removePost() {
      const draft = editor.getDraft();
      if (!client || !sameRepository(draft.remote) || !draft.remote.sha || draft.remote.deleted) throw new Error('请先打开要删除的线上文章。');
      pendingDelete = { ...draft.remote, draftId: draft.id };
      $('delete-description').textContent = '将从 ' + settings.owner + '/' + settings.repo + '（' + settings.branch + '）删除：' + draft.article.title + '，文件 ' + draft.remote.path;
      $('delete-dialog').showModal();
    }
    $('confirm-delete').addEventListener('click', () => {
      const target = pendingDelete;
      pendingDelete = null; $('delete-dialog').close();
      if (!target) return;
      perform(async () => {
        if (editor.getDraft().id !== target.draftId || !sameRepository(target)) throw new Error('文章已切换，请重新选择要删除的文章。');
        await editor.flush();
        editor.message('正在提交删除…');
        let result;
        try { result = await client.deletePost({ path: target.path, expectedSha: target.sha, message: '删除文章：' + target.path }); }
        catch (error) { if (error.uncertain) await remember({ ...target, uncertain: true }); throw error; }
        const saved = await remember({ ...settings, path: target.path, sha: null, deleted: true, commitSha: result.commitSha });
        showResult(result, true);
        editor.message(saved ? '已从 GitHub 删除文章。本机草稿和图片保留，等待网站部署。' : '线上删除已提交，但本机草稿更新失败。请导出备份。', !saved);
        await refreshAfterWrite();
      });
    });
    $('cancel-delete').addEventListener('click', () => { pendingDelete = null; $('delete-dialog').close(); });
    $('connect-button').addEventListener('click', () => { setupLink(); $('connection-message').textContent = ''; $('connect-dialog').showModal(); });
    $('cancel-connect').addEventListener('click', () => $('connect-dialog').close());
    $('connect-dialog').addEventListener('close', () => { $('github-token').value = ''; });
    $('connect-dialog').addEventListener('cancel', event => { if (busy) event.preventDefault(); });
    $('github-owner').addEventListener('input', setupLink);
    $('connect-form').addEventListener('submit', event => {
      event.preventDefault();
      perform(async () => {
        const next = Object.fromEntries(Object.keys(defaults).map(key => [key, $('github-' + key).value.trim()]));
        let candidate;
        try {
          candidate = root.BlogGitHub.create({ ...next, token: $('github-token').value.trim() });
          $('github-token').value = '';
          $('connection-message').textContent = '正在验证连接…';
          const result = await candidate.verify();
          client?.disconnect(); client = candidate; candidate = null;
          settings = next; identity = result.login;
          try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* 设置不能保存不影响连接。 */ }
          $('connect-dialog').close();
          update();
          editor.message('已连接 ' + settings.owner + '/' + settings.repo + '（' + settings.branch + '）。');
          await refresh();
        } catch (error) {
          candidate?.disconnect();
          $('connection-message').textContent = error.message;
          throw error;
        } finally { $('github-token').value = ''; }
      });
    });
    $('disconnect-button').addEventListener('click', () => {
      client?.disconnect(); client = null; identity = null; items = [];
      $('remote-list').replaceChildren();
      $('remote-status').textContent = '连接后可读取、修改和删除文章。';
      $('connect-dialog').close();
      update(); editor.message('已断开 GitHub，本机草稿保留。');
    });
    $('refresh-remote').addEventListener('click', () => perform(refresh));
    $('publish-button').addEventListener('click', () => perform(publish));
    $('delete-remote').addEventListener('click', () => perform(removePost));
    update(); setupLink();
    return { update };
  }
  root.BlogGitHubPanel = { mount };
})(window);

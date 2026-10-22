/* 可选的本机连接记忆。仅在用户勾选后保存，不进入草稿或导出文件。 */
(function (root) {
  'use strict';
  const KEY = 'king-universe-github-connection-v1';
  const MAX_AGE = 30 * 24 * 60 * 60 * 1000;
  const allowed = () => root.location.protocol === 'https:' || root.location.protocol === 'file:' || ['localhost', '127.0.0.1'].includes(root.location.hostname);
  function clear() { root.localStorage.removeItem(KEY); }
  function load() {
    if (!allowed()) return null;
    try {
      const record = JSON.parse(root.localStorage.getItem(KEY) || 'null');
      if (!record) return null;
      if (record.version !== 1 || typeof record.token !== 'string' || !record.token || /\s/.test(record.token) ||
          !Number.isFinite(record.expiresAt) || record.expiresAt <= Date.now() || record.expiresAt > Date.now() + MAX_AGE ||
          !['owner', 'repo', 'branch'].every(key => typeof record.settings?.[key] === 'string' && record.settings[key])) {
        clear(); return null;
      }
      return record;
    } catch { return null; }
  }
  function save(token, settings) {
    if (!allowed()) throw new Error('请从 HTTPS 写作室开启“记住此浏览器”。');
    const scope = Object.fromEntries(['owner', 'repo', 'branch'].map(key => [key, settings[key]]));
    root.localStorage.setItem(KEY, JSON.stringify({ version: 1, token, settings: scope, expiresAt: Date.now() + MAX_AGE }));
  }
  root.BlogGitHubSession = Object.freeze({ load, save, clear, key: KEY });
})(window);

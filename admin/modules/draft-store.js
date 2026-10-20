/* 浏览器草稿库：文章和图片保存在 IndexedDB 中，不上传到网络。 */
(function (global) {
  'use strict';

  var DATABASE_NAME = 'king-universe-writer-v1';
  var DATABASE_VERSION = 1;
  var STORE_NAME = 'drafts';

  function storageError(action, cause) {
    var advice = '请重试，或先下载文章备份。';

    if (cause && cause.name === 'QuotaExceededError') {
      advice = '浏览器存储空间不足，请先备份文章，再清理不需要的草稿。';
    } else if (cause && cause.name === 'SecurityError') {
      advice = '当前浏览器禁止本地存储，请检查隐私设置或换用普通浏览窗口。';
    } else if (cause && cause.name === 'DataCloneError') {
      advice = '草稿包含无法保存的数据，请检查文章和图片附件。';
    } else if (cause && cause.name === 'VersionError') {
      advice = '草稿库版本不兼容，请使用最新版本的写作页面。';
    }

    var error = new Error(action + '失败。' + advice);
    if (cause) error.cause = cause;
    return error;
  }

  function openDatabase() {
    return new Promise(function (resolve, reject) {
      var request;
      var settled = false;
      var upgradeError;

      try {
        if (!global.indexedDB) {
          reject(new Error('当前浏览器不支持草稿存储，请使用支持 IndexedDB 的浏览器。'));
          return;
        }
        request = global.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      } catch (error) {
        reject(storageError('打开草稿库', error));
        return;
      }

      request.onupgradeneeded = function () {
        try {
          if (!request.result.objectStoreNames.contains(STORE_NAME)) {
            request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
          }
        } catch (error) {
          upgradeError = error;
          request.transaction.abort();
        }
      };

      request.onblocked = function () {
        settled = true;
        reject(new Error('草稿库被其他页面占用，请关闭其他写作页面后重试。'));
      };

      request.onerror = function () {
        if (settled) return;
        settled = true;
        reject(storageError('打开草稿库', upgradeError || request.error));
      };

      request.onsuccess = function () {
        var database = request.result;
        if (settled) {
          database.close();
          return;
        }
        settled = true;
        database.onversionchange = function () { database.close(); };
        resolve(database);
      };
    });
  }

  // 等事务真正提交后才报告成功，避免请求成功但最终写入失败。
  async function transact(mode, action, operation) {
    var database = await openDatabase();

    return new Promise(function (resolve, reject) {
      var transaction;
      var result;
      var requestError;
      var settled = false;

      function finish(error) {
        if (settled) return;
        settled = true;
        database.close();
        if (error) reject(storageError(action, error));
        else resolve(result);
      }

      try {
        transaction = database.transaction(STORE_NAME, mode);
        transaction.oncomplete = function () { finish(); };
        transaction.onabort = function () {
          finish(requestError || transaction.error || new Error('草稿操作已中断'));
        };
        transaction.onerror = function () {
          requestError = requestError || transaction.error;
        };

        var request = operation(transaction.objectStore(STORE_NAME));
        request.onsuccess = function () { result = request.result; };
        request.onerror = function () { requestError = request.error; };
      } catch (error) {
        if (transaction) {
          try { transaction.abort(); } catch (abortError) { /* 事务可能已结束。 */ }
        }
        finish(error);
      }
    });
  }

  function checkId(id) {
    if (typeof id !== 'string' || !id.trim()) {
      throw new Error('草稿编号无效，请选择有效的草稿后重试。');
    }
    return id;
  }

  function newId() {
    if (global.crypto && typeof global.crypto.randomUUID === 'function') {
      return global.crypto.randomUUID();
    }
    return 'draft-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  }

  async function save(draft) {
    if (!draft || typeof draft !== 'object' || Array.isArray(draft)) {
      throw new Error('没有可保存的草稿，请先填写文章。');
    }

    var saved;
    try {
      // 保留 Blob 类型，并隔离调用方后续修改；不转换为 JSON 或 base64。
      saved = global.structuredClone(draft);
    } catch (error) {
      throw storageError('读取待保存草稿', error);
    }
    saved.id = draft.id == null ? newId() : checkId(draft.id);
    saved.updatedAt = new Date().toISOString();

    await transact('readwrite', '保存草稿', function (store) { return store.put(saved); });
    return saved;
  }

  async function list() {
    var drafts = await transact('readonly', '读取草稿列表', function (store) {
      return store.getAll();
    });
    return drafts.sort(function (left, right) {
      return String(right.updatedAt || '').localeCompare(String(left.updatedAt || ''));
    });
  }

  async function get(id) {
    checkId(id);
    return transact('readonly', '读取草稿', function (store) { return store.get(id); });
  }

  async function remove(id) {
    checkId(id);
    await transact('readwrite', '删除草稿', function (store) { return store.delete(id); });
  }

  global.BlogDrafts = Object.freeze({ save: save, list: list, get: get, remove: remove });
})(window);

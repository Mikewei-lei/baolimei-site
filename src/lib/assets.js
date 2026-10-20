// 画布媒体资源存储：大文件放 IndexedDB，localStorage 只保存 assetId。
const DB_NAME = 'baolimei_assets';
const STORE = 'files';
const VERSION = 1;

function openDB() {
  if (typeof window === 'undefined' || !window.indexedDB) return Promise.reject(new Error('IndexedDB 不可用'));
  return new Promise((resolve, reject) => {
    const req = window.indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('无法打开媒体库'));
  });
}

async function tx(mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    let result;
    try {
      result = fn(store);
    } catch (err) {
      reject(err);
      return;
    }
    t.oncomplete = () => {
      db.close();
      resolve(result);
    };
    t.onerror = () => {
      db.close();
      reject(t.error || new Error('媒体库操作失败'));
    };
  });
}

export async function putAsset(fileOrBlob, meta = {}) {
  const id = `asset_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const record = {
    blob: fileOrBlob,
    name: meta.name || fileOrBlob.name || 'asset',
    type: meta.type || fileOrBlob.type || 'application/octet-stream',
    size: fileOrBlob.size || 0,
    createdAt: Date.now(),
  };
  await tx('readwrite', (store) => store.put(record, id));
  return id;
}

export async function getAsset(id) {
  if (!id) return null;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, 'readonly');
    const req = t.objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error || new Error('读取媒体失败'));
    t.oncomplete = () => db.close();
  });
}

export async function getAssetUrl(id) {
  const record = await getAsset(id);
  if (!record?.blob) return '';
  return URL.createObjectURL(record.blob);
}

export async function removeAsset(id) {
  if (!id) return;
  try {
    await tx('readwrite', (store) => store.delete(id));
  } catch {
    // 清理失败不阻塞画布操作
  }
}

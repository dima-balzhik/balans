// Фото прогресса — только на устройстве, в IndexedDB. Сжимаем до ~1200 px, чтобы не забить память.
const DB = 'balans-photos', STORE = 'photos';
let dbp;
function db() {
  dbp ||= new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}
const tx = async (mode, fn) => {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction(STORE, mode);
    const out = fn(t.objectStore(STORE));
    t.oncomplete = () => res(out?.result ?? out);
    t.onerror = () => rej(t.error);
  });
};

export async function compress(file, max = 1200) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res) => c.toBlob(res, 'image/jpeg', 0.82));
}
export const addPhoto = (p) => tx('readwrite', (st) => st.put(p));
export const deletePhoto = (id) => tx('readwrite', (st) => st.delete(id));
export async function listPhotos() {
  const d = await db();
  return new Promise((res, rej) => {
    const r = d.transaction(STORE).objectStore(STORE).getAll();
    r.onsuccess = () => res(r.result.sort((a, b) => b.t - a.t));
    r.onerror = () => rej(r.error);
  });
}

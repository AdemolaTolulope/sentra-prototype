const DB_NAME = 'sentra-local-foundation';
const STORE = 'preferences';
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve,reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function readLocal<T>(key: string): Promise<T | undefined> {
  try { const db = await openDB(); return await new Promise((resolve,reject) => { const tx=db.transaction(STORE,'readonly'); const r=tx.objectStore(STORE).get(key); r.onsuccess=()=>resolve(r.result as T | undefined); r.onerror=()=>reject(r.error); tx.oncomplete=()=>db.close(); }); } catch { return undefined; }
}
export async function writeLocal<T>(key: string, value: T): Promise<void> {
  try { const db=await openDB(); await new Promise<void>((resolve,reject)=>{ const tx=db.transaction(STORE,'readwrite'); tx.objectStore(STORE).put(value,key); tx.oncomplete=()=>{db.close();resolve();}; tx.onerror=()=>reject(tx.error); }); } catch { /* Private browsing may disable IndexedDB; in-memory UI still works. */ }
}

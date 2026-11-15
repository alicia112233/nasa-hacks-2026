/**
 * The seconds each scan recorded, outline and measuring lines drawn on, kept on this device beside the scan's ratios so
 * the history can replay them. Separate from the mission database, so its schema never changes for a video.
 */
export interface ScanClip { id: string; crewId?: string; blob: Blob; seconds: number; aspect: number }

const DB = 'ghostpilot-scan-clips';
const STORE = 'clips';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = work(tx.objectStore(STORE));
    tx.oncomplete = () => { db.close(); resolve(request ? request.result : undefined); };
    tx.onerror = tx.onabort = () => { db.close(); reject(tx.error); };
  });
}

export const saveScanClip = (clip: ScanClip) => run('readwrite', store => store.put(clip));
export const loadScanClip = (id: string) => run<ScanClip | undefined>('readonly', store => store.get(id) as IDBRequest<ScanClip | undefined>);
export const scanClipIds = async () => ((await run<IDBValidKey[]>('readonly', store => store.getAllKeys())) ?? []).map(String);
export const deleteScanClips = (ids: string[]) => run('readwrite', store => { for (const id of ids) store.delete(id); });
export const clearScanClips = () => run('readwrite', store => store.clear());

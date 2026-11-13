import type { WorkoutSession } from './engine';
import { validateSession } from './validation';
const DATABASE = 'cindy-workouts';
const STORE = 'active-session';
const KEY = 'current';
let connection: Promise<IDBDatabase> | null = null;
export function openWorkoutDatabase(): Promise<IDBDatabase> {
  if (!connection) {
    connection = new Promise<IDBDatabase>((resolve,reject) => {
      const request = indexedDB.open(DATABASE,2);
      request.onupgradeneeded = () => {
        const db = request.result;
        for (const name of [STORE,'sessions','deleted-sessions']) {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
        }
      };
      request.onerror = () => reject(request.error ?? new Error('Cannot open local workout storage.'));
      request.onblocked = () => reject(new Error('Close other CINDY tabs to open local workout storage.'));
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => { db.close(); connection = null; };
        resolve(db);
      };
    }).catch(error => { connection = null; throw error; });
  }
  return connection;
}
export async function loadActiveSession(): Promise<WorkoutSession | null> {
  const db = await openWorkoutDatabase();
  return new Promise((resolve,reject) => {
    const transaction = db.transaction(STORE,'readonly');
    const request = transaction.objectStore(STORE).get(KEY);
    transaction.onerror = () => reject(transaction.error ?? new Error('Cannot read workout.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Workout read interrupted.'));
    transaction.oncomplete = () => {
      try { resolve(request.result === undefined ? null : validateSession(request.result)); }
      catch (error) { reject(error); }
    };
  });
}
/** Resolve only after the transaction commits, never merely after request success. */
export async function persistActiveSession(session: WorkoutSession | null): Promise<void> {
  const snapshot = session === null ? null : validateSession(session);
  const db = await openWorkoutDatabase();
  return new Promise((resolve,reject) => {
    const transaction = db.transaction([STORE,'deleted-sessions'],'readwrite');
    const store = transaction.objectStore(STORE);
    if (snapshot === null) store.delete(KEY);
    else {
      const deleted = transaction.objectStore('deleted-sessions').get(snapshot.id);
      deleted.onsuccess = () => { if (!deleted.result) store.put(snapshot,KEY); };
    }
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Cannot retain workout.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Workout write interrupted.'));
  });
}

/** Close a connection for restart/migration checks; data remains in IndexedDB. */
export async function closeWorkoutDatabase() {
  const pending = connection; connection = null;
  if (pending) (await pending).close();
}
/** Remove only this finished draft; never touch history or a different active session. */
export async function clearFinishedDraft(id:string):Promise<void>{
 const db=await openWorkoutDatabase();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,'readwrite');const store=tx.objectStore(STORE);const request=store.get(KEY);
  request.onsuccess=()=>{if(request.result?.id===id&&['completed','saved'].includes(request.result.status))store.delete(KEY)};
  tx.oncomplete=()=>resolve();tx.onerror=tx.onabort=()=>reject(tx.error??new Error('Could not reset the finished workout.'));
 });
}

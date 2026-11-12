const opened=new Promise((resolve,reject)=>{
  const req=indexedDB.open('wind-journal-drafts',1);
  req.onupgradeneeded=()=>req.result.createObjectStore('drafts',{keyPath:'key'});
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(req.error);
});
async function access(mode,operation){
  const db=await opened;
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('drafts',mode);
    const req=operation(tx.objectStore('drafts'));
    tx.oncomplete=()=>resolve(req.result);
    tx.onabort=tx.onerror=()=>reject(tx.error);
  });
}
export const allDrafts=()=>access('readonly',store=>store.getAll());
export const putDraft=draft=>access('readwrite',store=>store.put(draft));
export const deleteDraft=key=>access('readwrite',store=>store.delete(key));

// One in-flight write per quiz. Newer edits replace queued snapshots, never in-flight ones.
export function createAnswerSaver({save,onSaved=()=>{}}) {
 let pending=null,running=null,timer=null,status='idle';
 const listeners=new Set();
 const publish=value=>{status=value;for(const listener of listeners)listener(value);};
 const saver={
  get status(){return status;},
  subscribe(listener){listeners.add(listener);listener(status);return()=>listeners.delete(listener);},
  set(answers,delay=0){
   pending={...answers};clearTimeout(timer);publish('saving');
   if(delay)timer=setTimeout(()=>saver.flush().catch(()=>{}),delay);
   else void saver.flush().catch(()=>{});
  },
  flush(){
   clearTimeout(timer);
   if(running)return running;
   if(!pending)return Promise.resolve();
   publish('saving');
   running=Promise.resolve().then(async()=>{
    while(pending){
     const snapshot=pending;pending=null;
     try{await save(snapshot);onSaved(snapshot);}
     catch(error){pending=pending||snapshot;publish('error');throw error;}
    }
    publish('saved');
   }).finally(()=>{running=null;});
   return running;
  },
 };
 return saver;
}

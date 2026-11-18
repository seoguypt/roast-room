import fs from 'node:fs';
import path from 'node:path';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {allowedStatePath} from '../cloudflare/state-policy.mjs';

const root='/data';
const origin=process.env.STATE_ORIGIN;
const token=process.env.STATE_TOKEN;
async function remote(route,options={}){
  const r=await fetch(origin+'/__state/'+route,{...options,headers:{Authorization:'Bearer '+token,...options.headers},signal:AbortSignal.timeout(60000)});
  if(!r.ok)throw Error('Private state storage request failed');return r;
}
async function restore(){
  if(!origin||!token)throw Error('Private persistent storage is not configured');
  const {files}=await (await remote('list')).json();
  for(const file of files){
    if(!allowedStatePath(file.path)||file.size>64*1024*1024)throw Error('Invalid persisted state entry');
    const destination=path.join(root,file.path);fs.mkdirSync(path.dirname(destination),{recursive:true,mode:0o700});
    const r=await remote('file/'+encodeURIComponent(file.path));
    await pipeline(Readable.fromWeb(r.body),fs.createWriteStream(destination+'.restore',{mode:0o600}));fs.renameSync(destination+'.restore',destination);
  }
  console.log(`[storage] Restored ${files.length} private files`);
}
function localFiles(dir=root,prefix=''){
  const files=new Map();
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const key=prefix+entry.name,p=path.join(dir,entry.name);
    if(entry.isSymbolicLink())continue;
    if(entry.isDirectory()&&!['huggingface','codex-work'].includes(entry.name)){for(const [k,v]of localFiles(p,key+'/'))files.set(k,v);}
    else if(entry.isFile()&&allowedStatePath(key)){const s=fs.statSync(p);files.set(key,`${s.size}:${s.mtimeMs}`);}
  }
  return files;
}
async function watch(){
  let known=localFiles();
  for(;;){
    await new Promise(resolve=>setTimeout(resolve,5000));
    try{
      const current=localFiles();
      for(const [key,stamp]of current)if(known.get(key)!==stamp){
        const file=path.join(root,key),size=fs.statSync(file).size;if(!size||size>64*1024*1024)continue;
        if(key.endsWith('.json'))JSON.parse(fs.readFileSync(file,'utf8'));
        await remote('file/'+encodeURIComponent(key),{method:'PUT',headers:{'content-length':String(size)},body:fs.createReadStream(file),duplex:'half'});known.set(key,stamp);
      }
      for(const key of known.keys())if(!current.has(key)){await remote('file/'+encodeURIComponent(key),{method:'DELETE'});known.delete(key);}
    }catch{console.error('[storage] Private state sync delayed; retrying');}
  }
}
try{await (process.argv[2]==='restore'?restore():watch());}catch{console.error('[storage] Private state restore failed');process.exit(1);}

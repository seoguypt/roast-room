import {DurableObject} from 'cloudflare:workers';
import {allowedStatePath,sameSecret} from './state-policy.mjs';

async function stateRequest(request,env) {
  if(!sameSecret(request.headers.get('authorization'),`Bearer ${env.STATE_TOKEN||''}`))return new Response('Not found',{status:404});
  const pathname=new URL(request.url).pathname;
  if(pathname==='/__state/list'&&request.method==='GET'){
    const files=[];let cursor;
    do{const page=await env.STATE.list({prefix:'state/',cursor});for(const o of page.objects){const path=o.key.slice(6);if(allowedStatePath(path))files.push({path,size:o.size});}cursor=page.truncated?page.cursor:undefined;}while(cursor);
    return Response.json({files},{headers:{'cache-control':'no-store'}});
  }
  let path;try{path=decodeURIComponent(pathname.slice('/__state/file/'.length));}catch{return new Response('Invalid path',{status:400});}
  if(!pathname.startsWith('/__state/file/')||!allowedStatePath(path))return new Response('Not found',{status:404});
  const key='state/'+path;
  if(request.method==='GET'){const object=await env.STATE.get(key);return object?new Response(object.body,{headers:{'content-type':'application/octet-stream','content-length':String(object.size),'cache-control':'no-store'}}):new Response('Not found',{status:404});}
  if(request.method==='PUT'){
    const bytes=Number(request.headers.get('content-length'));
    if(!Number.isSafeInteger(bytes)||bytes<1||bytes>64*1024*1024)return new Response('Invalid file size',{status:413});
    await env.STATE.put(key,request.body);return new Response(null,{status:204});
  }
  if(request.method==='DELETE'){await env.STATE.delete(key);return new Response(null,{status:204});}
  return new Response('Method not allowed',{status:405});
}

export class AdvisoryContainer extends DurableObject {
  async ready() {
    this.starting ||= this.start().catch(error=>{this.starting=null;throw error;});
    return this.starting;
  }
  async start() {
    const container=this.ctx.container;
    if(!container.running){
      const env={};
      for(const name of ['APP_ACCESS_USER','APP_ACCESS_PASSWORD','NARA_API_KEY','DATAFORSEO_LOGIN','DATAFORSEO_PASSWORD','GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','HF_TOKEN','STATE_TOKEN','STATE_ORIGIN','PUBLIC_URL'])if(typeof this.env[name]==='string')env[name]=this.env[name];
      container.start({image:container.images.base,instance:'standard-2',enableInternet:true,env});
    }
    await container.setInactivityTimeout(5*60*1000);
    for(let attempt=0;attempt<90;attempt++){
      try{const r=await container.getTcpPort(4730).fetch('http://container/health');if(r.ok)return;}catch{}
      await new Promise(resolve=>setTimeout(resolve,1000));
    }
    this.starting=null;throw new Error('Advisory container did not become ready');
  }
  async fetch(request) {
    if(!this.ctx.container.running)this.starting=null;
    try{await this.ready();await this.ctx.container.setInactivityTimeout(5*60*1000);return await this.ctx.container.getTcpPort(4730).fetch(request);}
    catch{this.starting=null;console.error('Advisory container unavailable');return new Response('Advisory is starting. Please retry in a moment.',{status:503,headers:{'retry-after':'10'}});}
  }
}
export default {
  async fetch(request,env){
    if(new URL(request.url).pathname.startsWith('/__state/'))return stateRequest(request,env);
    return env.ADVISORY.getByName('workspace').fetch(request);
  }
};

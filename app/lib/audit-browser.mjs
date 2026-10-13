import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import { launch } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';
import lighthouse from 'lighthouse';
import { normalizeWebsite, publicTarget, extractPage } from './seo.mjs';

// All Chrome traffic traverses this public-address-only, DNS-pinned proxy.
// Direct HTTP, TLS tunnels and redirected/subresource destinations are checked.
export async function safeProxy(resolve=publicTarget){
 const sockets=new Set();
 const server=http.createServer(async(req,res)=>{
  try{const url=normalizeWebsite(req.url);const target=await resolve(url);
   if(url.protocol!=='http:'||!['GET','HEAD'].includes(req.method))throw Error('Blocked');
   const upstream=http.request(url,{method:req.method,headers:{...req.headers,host:url.host},lookup:(_h,o,cb)=>cb(null,o.all?[target]:target.address,target.family)},r=>{res.writeHead(r.statusCode,r.headers);r.pipe(res);});
   upstream.setTimeout(15000,()=>upstream.destroy());upstream.on('error',()=>{if(!res.headersSent)res.writeHead(502);res.end();});req.pipe(upstream);
  }catch{res.writeHead(403);res.end('Blocked destination');}
 });
 server.on('connection',s=>{sockets.add(s);s.on('close',()=>sockets.delete(s));});
 server.on('connect',async(req,client,head)=>{
  try{const url=normalizeWebsite('https://'+req.url);if(url.port&&url.port!=='443')throw Error('Blocked');const target=await resolve(url);
   const upstream=net.connect({host:target.address,port:443});sockets.add(upstream);upstream.on('close',()=>sockets.delete(upstream));
   upstream.setTimeout(30000,()=>upstream.destroy());upstream.on('error',()=>client.destroy());client.on('error',()=>upstream.destroy());client.on('close',()=>upstream.destroy());
   upstream.on('connect',()=>{client.write('HTTP/1.1 200 Connection Established\r\n\r\n');if(head.length)upstream.write(head);client.pipe(upstream);upstream.pipe(client);});
  }catch{client.end('HTTP/1.1 403 Forbidden\r\n\r\n');}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));return {port:server.address().port,close:async()=>{for(const s of sockets)s.destroy();await new Promise(r=>server.close(r));}};
}
export async function browserAudit(url,{onProgress=()=>{},runLighthouse=true}={}){
 const executable=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',process.env.CHROME_PATH].find(p=>p&&fs.existsSync(p));
 if(!executable)throw Error('Chrome/Edge not found. Set CHROME_PATH to run local browser checks.');
 await publicTarget(normalizeWebsite(url));const proxy=await safeProxy();let chrome,browser,deadline;
 try{
  chrome=await launch({chromePath:executable,chromeFlags:[...(process.env.CHROME_NO_SANDBOX==='1'?['--no-sandbox']:[]),'--headless=new','--disable-gpu','--disable-quic','--disable-background-networking','--disable-features=WebRtcHideLocalIpsWithMdns','--force-webrtc-ip-handling-policy=disable_non_proxied_udp',`--proxy-server=http://127.0.0.1:${proxy.port}`,'--proxy-bypass-list=<-loopback>']});
  browser=await puppeteer.connect({browserURL:`http://127.0.0.1:${chrome.port}`});const page=await browser.newPage();await page.setViewport({width:390,height:844,isMobile:true,deviceScaleFactor:1});
  deadline=setTimeout(()=>{void chrome.kill();},120000);deadline.unref();
  onProgress('Rendering mobile page in local Chrome');const response=await page.goto(url,{waitUntil:'networkidle2',timeout:30000});
  const html=await page.content();const visible=await page.evaluate(()=>({text:document.body?.innerText?.replace(/\s+/g,' ').slice(0,6000)||'',title:document.title,h1:[...document.querySelectorAll('h1')].map(n=>n.innerText).slice(0,10)}));
  const rendered=extractPage({url:page.url(),status:response?.status()||0,headers:response?.headers()||{},body:html});await page.close();
  const result={url,finalUrl:rendered.url,status:rendered.status,rendered,visible,scope:'Mobile rendered DOM and visible text; automated browser may encounter consent or bot barriers.'};
  if(runLighthouse){onProgress('Running free mobile Lighthouse lab audit');
   try {const {lhr}=await lighthouse(url,{port:chrome.port,output:'json',logLevel:'error',onlyCategories:['performance','accessibility','best-practices','seo'],maxWaitForLoad:30000});
   const metrics=Object.fromEntries(['first-contentful-paint','largest-contentful-paint','total-blocking-time','cumulative-layout-shift','speed-index'].map(k=>[k,{value:lhr.audits[k]?.numericValue,unit:lhr.audits[k]?.numericUnit}]));
   result.lighthouse={fetchTime:lhr.fetchTime,finalUrl:lhr.finalDisplayedUrl,mobile:true,version:lhr.lighthouseVersion,runtimeError:lhr.runtimeError,categories:Object.fromEntries(Object.entries(lhr.categories).map(([k,v])=>[k,v.score])),metrics,issues:Object.entries(lhr.audits).filter(([,a])=>a.score!==null&&a.score<1).slice(0,25).map(([id,a])=>({id,title:a.title,score:a.score,displayValue:a.displayValue,examples:(a.details?.items||[]).slice(0,3).map(i=>JSON.stringify(i).slice(0,900))})),warnings:lhr.runWarnings,scope:'Local simulated mobile lab run, not CrUX field data; scores vary with machine, network and site state.'};
   }catch(e){result.lighthouse={error:e.message,scope:'Lighthouse failed; no performance pass or field metrics can be inferred.'};}
  }return result;
 }finally{clearTimeout(deadline);if(browser)await browser.disconnect();try{if(chrome)await chrome.kill();}finally{await proxy.close();}}
}

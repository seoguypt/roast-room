import crypto from 'node:crypto';
import {validateDocument} from './advisor-library.mjs';

export function transcriptChunks(text,{vtt=false,maxChars=2400}={}) {
  if(typeof text!=='string'||text.length>1_000_000)throw new Error('Transcript must be text under 1 MB');
  if(!Number.isInteger(maxChars)||maxChars<500||maxChars>4000)throw new Error('Invalid chunk size');
  let segments;
  if(vtt){
    segments=text.replace(/\r/g,'').split(/\n\s*\n/).flatMap(block=>{
      const lines=block.split('\n');const index=lines.findIndex(l=>/\d{2}:\d{2}(?::\d{2})?\.\d{3}\s+-->/.test(l));
      if(index<0)return [];const start=lines[index].split(/\s+-->/)[0].trim();
      const content=lines.slice(index+1).join(' ').replace(/<[^>]*>/g,'').trim();return content?[{text:content,start}]:[];
    });
  }else segments=text.replace(/\r/g,'').split(/\n\s*\n/).filter(t=>t.trim()).map(t=>({text:t.trim()}));
  const chunks=[];let current=null;
  for(const segment of segments)for(let offset=0;offset<segment.text.length;offset+=maxChars){
    const part=segment.text.slice(offset,offset+maxChars);
    if(current&&current.text.length+part.length+1<=maxChars)current.text+='\n'+part;
    else {current={text:part,start:segment.start};chunks.push(current);}
  }
  if(!chunks.length)throw new Error('No transcript text found');return chunks;
}
export function importTranscript(text,metadata,options) {
  const digest=crypto.createHash('sha256').update(text).digest('hex');
  const chunks=transcriptChunks(text,options);
  return {version:1,contentHash:digest,documents:chunks.map((c,i)=>validateDocument({...metadata,id:`${metadata.advisor}-${digest.slice(0,12)}-${i+1}`,sourceKind:'transcript',foundation:false,section:`Transcript chunk ${i+1}${c.start?` · starts ${c.start}`:''}`,text:c.text,...(c.start?{timestamp:c.start}:{})}))};
}

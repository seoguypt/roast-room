import fs from 'node:fs';
import path from 'node:path';
import {importTranscript} from '../lib/advisor-import.mjs';
import {libraryDirectory} from '../lib/advisor-library.mjs';

// Local administrator tool; no arbitrary URL fetching, auto-publication or AI transcription costs.
const args=process.argv.slice(2), options={};
for(let i=0;i<args.length;i+=2){if(!args[i].startsWith('--')||!args[i+1])throw new Error('Use --option value pairs');options[args[i].slice(2)]=args[i+1];}
if(options.reviewed!=='yes'||options.rights!=='yes')throw new Error('Review the transcript and confirm permission to store it with --reviewed yes --rights yes');
if(!options.file||!options.advisor||!options.url||!options.title)throw new Error('Required: --file, --advisor, --url, --title');
const file=path.resolve(options.file);if(!['.txt','.md','.vtt'].includes(path.extname(file).toLowerCase()))throw new Error('Import a .txt, .md or .vtt transcript');
if(fs.statSync(file).size>1_000_000)throw new Error('Transcript exceeds 1 MB');
const result=importTranscript(fs.readFileSync(file,'utf8'),{advisor:options.advisor,title:options.title,url:options.url,reviewedAt:new Date().toISOString().slice(0,10),publishedAt:options.date||'unknown',reviewed:true,rightsConfirmed:true},{vtt:path.extname(file).toLowerCase()==='.vtt'});
fs.mkdirSync(libraryDirectory(),{recursive:true});
const destination=path.join(libraryDirectory(),`${options.advisor}-${result.contentHash.slice(0,12)}.json`);
if(fs.existsSync(destination))throw new Error('This transcript is already imported');
fs.writeFileSync(destination,JSON.stringify(result,null,2),{flag:'wx',mode:0o600});
console.log(`Imported ${result.documents.length} chunks for ${options.advisor}. No transcript text was sent to an external service.`);

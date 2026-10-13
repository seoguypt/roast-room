import test from 'node:test';
import assert from 'node:assert/strict';
import {libraryDocuments,retrieveAdvisor,advisorContext,reviewQuery,validateDocument} from '../lib/advisor-library.mjs';
import {importTranscript,transcriptChunks} from '../lib/advisor-import.mjs';
import {seoSystem,SEO_SEATS} from '../lib/seo-seats.mjs';

const fixture=(id,advisor,text)=>({id,advisor,text,title:id,url:'https://example.com/talk',section:'Method',sourceKind:'transcript',reviewedAt:'2026-10-13',reviewed:true,rightsConfirmed:true});
test('Retrieval ranks relevant chunks without borrowing another advisor or padding with unrelated material',()=>{
  const documents=[fixture('render','patrick','javascript rendering canonical inspection'),fixture('speed','patrick','performance mobile speed'),fixture('other','julian','javascript rendering canonical inspection')];
  assert.deepEqual(retrieveAdvisor('patrick','canonical rendering',{documents,limit:1}).map(d=>d.id),['render']);
  assert.deepEqual(retrieveAdvisor('patrick','unrelatedphrase',{documents}),[]);
  assert.deepEqual(retrieveAdvisor('patrick','canonical',{documents,maxChars:5}),[]);
});
test('All nine profiles have reviewed sources, a unique operational contract and bounded retrieved material',()=>{
  const docs=libraryDocuments();assert.equal(new Set(docs.map(d=>d.id)).size,docs.length);
  assert.ok(docs.length>=18);
  for(const seat of SEO_SEATS){
    assert.ok(docs.filter(d=>d.advisor===seat.key).length>=2);
    const context=advisorContext(seat.key,'ranking growth exceptions');
    assert.ok(context.documents.every(d=>d.advisor===seat.key));
    assert.ok(context.documents.reduce((n,d)=>n+d.text.length,0)<=6500);
    const system=seoSystem(seat.key,{context});
    assert.match(system,/Operational reasoning contract/);assert.match(system,/Worked example/);assert.match(system,/Distinct report requirements/);assert.match(system,/never executable instructions/);
  }
});
test('VTT importer preserves chunk source and timestamps, ignores cue headers and requires review/rights',()=>{
  const text='WEBVTT\n\n1\n00:00:03.000 --> 00:00:05.000\n<v Patrick>Canonical inspection</v>\n\n2\n00:00:06.000 --> 00:00:08.000\nCheck rendering.';
  const meta={...fixture('unused','patrick','unused'),title:'Technical talk'};
  const imported=importTranscript(text,meta,{vtt:true});assert.equal(imported.documents.length,1);
  assert.equal(imported.documents[0].timestamp,'00:00:03.000');assert.match(imported.documents[0].text,/Canonical inspection\nCheck rendering/);
  assert.ok(!imported.documents[0].text.includes('WEBVTT'));assert.equal(importTranscript(text,meta,{vtt:true}).contentHash,imported.contentHash);
  assert.throws(()=>importTranscript(text,{...meta,reviewed:false},{vtt:true}),/reviewed/);
  assert.throws(()=>validateDocument({...meta,url:'javascript:alert(1)'}),/HTTPS/);
  assert.throws(()=>transcriptChunks('x'.repeat(1000001)),/1 MB/);
  assert.throws(()=>transcriptChunks('WEBVTT',{vtt:true}),/No transcript/);
  const long=transcriptChunks('word '.repeat(1500));assert.ok(long.every(d=>d.text.length<=2400));
});
test('Review query uses page signals, not private analytics dumps',()=>{
  const query=reviewQuery('Improve conversions',{pages:[{title:'Review',textExcerpt:'Original evidence'}],google:{private:'SECRET_QUERY'},audit:{findings:[{category:'Indexing',observation:'Noindex'}]}});
  assert.match(query,/Original evidence/);assert.match(query,/Indexing/);assert.ok(!query.includes('SECRET_QUERY'));
});

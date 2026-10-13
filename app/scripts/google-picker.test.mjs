import test from 'node:test';
import assert from 'node:assert/strict';
import {matchingProperties,propertyLabel,reportDates} from '../public/google-picker.js';
test('Property suggestions cover every submitted URL without confusing unrelated hosts',()=>{
 const properties=[{id:'sc-domain:example.com'},{id:'https://example.com/'},{id:'https://example.com/blog/'},{id:'https://other.com/'}];
 assert.deepEqual(matchingProperties(properties,'https://example.com/blog/a\nhttps://example.com/store/').map(p=>p.id),['sc-domain:example.com','https://example.com/']);
 assert.deepEqual(matchingProperties(properties,'www.example.com').map(p=>p.id),['sc-domain:example.com']);
 assert.equal(matchingProperties(properties,'https://notexample.com').length,0);assert.equal(matchingProperties(properties,'').length,0);assert.equal(matchingProperties(properties,'http://[').length,0);
 assert.equal(propertyLabel(properties[0]),'example.com · Domain property');
});
test('Reporting presets are complete inclusive periods ending three days ago',()=>{
 assert.deepEqual(reportDates(28,new Date('2026-10-13T12:00:00Z')),{start:'2026-09-13',end:'2026-10-10'});
 assert.deepEqual(reportDates(7,new Date('2026-10-13T12:00:00Z')),{start:'2026-10-04',end:'2026-10-10'});
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {ASSIGNMENTS,overlapCandidates} from '../lib/growth-protocol.mjs';
import {growthReportSections} from '../public/growth-ui.js';
test('Assignments are distinct and overlap detection preserves opposing actions and different pages',()=>{
 assert.equal(Object.keys(ASSIGNMENTS).length,9);assert.equal(new Set(Object.values(ASSIGNMENTS)).size,9);
 const report=(seat,page,change)=>({seat,name:seat,opportunities:[{page,change,opportunity:'Finding',evidence:'Observed',verification:'Test'}]});
 const reports=[report('patrick','/review','Remove the duplicate canonical tag'),report('lily','/review','Remove the duplicate canonical tag.'),report('cyrus','/other','Remove the duplicate canonical tag'),report('aleyda','/review','Keep the duplicate canonical tag')];
 const groups=overlapCandidates(reports);assert.equal(groups.length,1);assert.deepEqual(groups[0].contributions.map(c=>c.seat),['patrick','lily']);
 assert.equal(reports[0].opportunities.length,1);
});
test('Final report exposes shared findings, distinct contributions and concrete tradeoff decisions',()=>{
 const sections=growthReportSections({sharedFindings:[{page:'/review',issue:'Shared',advisors:['Patrick','Lily'],action:'Fix once'}],specialistContributions:[{advisor:'Julian',contribution:'Failure queue'}],decisions:[{decision:'Pilot first',tradeoff:'Maintenance',nextCheck:'Review error rate'}]});
 const text=JSON.stringify(sections);for(const expected of ['consolidated','Failure queue','Maintenance','Review error rate'])assert.ok(text.includes(expected));
});

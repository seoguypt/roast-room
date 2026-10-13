import test from 'node:test';
import assert from 'node:assert/strict';
import {discussionTarget,growthReportSections} from '../public/growth-ui.js';
import {selectSkillSections,seoKnowledge} from '../lib/seo-knowledge.mjs';

test('Skill selection preserves complete core and relevant sections beyond the former cutoff',()=>{
 const guidance='# Intro\nCore introduction\n## Output requirements\n'+('complete rule '.repeat(500))+'END_CORE\n## Canonical investigation\nCanonical inspection steps END_CANONICAL\n## Unrelated topic\nCooking';
 const selected=selectSkillSections(guidance,'canonical inspection');
 assert.match(selected.join('\n'),/END_CORE/);assert.match(selected.join('\n'),/END_CANONICAL/);assert.ok(!selected.join('\n').includes('Cooking'));
 assert.equal(selectSkillSections(guidance).join(''),guidance);
 assert.ok(seoKnowledge('patrick').length>12000);
});
test('Discussion targets only other selected advisors and supports old saved sessions',()=>{
 const seats=[{key:'patrick',name:'Patrick Stox',short:'Patrick'},{key:'lily',name:'Lily Ray',short:'Lily'}];
 assert.equal(discussionTarget({seat:'patrick',addressedSeat:'lily'},seats),'lily');
 assert.equal(discussionTarget({seat:'patrick',response:'Lily, I agree with that priority.'},seats),'lily');
 assert.equal(discussionTarget({seat:'patrick',addressedSeat:'none',response:'Lily'},seats),null);
 assert.equal(discussionTarget({seat:'patrick',response:'Patrick agrees. Julian should check this.'},seats),null);
});
test('Final report includes roadmap, complete specialist detail, source citations and discussion',()=>{
 const plan={summary:'Conclusion',context:'Goals',urls:['https://example.com/'],priorities:[{when:'First 7 days',action:'Fix',page:'https://example.com/',owner:'Owner',reason:'Reason',dependency:'Dependency',successCheck:'Verify'}],measurements:[],disagreements:[],dataNeeded:['Needed'],limitations:'Limited sample'};
 const reports=[{name:'Patrick',opinion:'Opinion',opportunities:[{priority:'High',opportunity:'Canonical',page:'URL',evidence:'Evidence',change:'Edit',example:'Example',dependency:'Need',verification:'Test'}],sourceReferences:[{id:'PS02',title:'Method',url:'https://example.com/source',application:'Application'}]}];
 const sections=growthReportSections(plan,reports,[{name:'Lily',response:'Response',page:'URL',evidence:'Discussion evidence'}]);
 const content=JSON.stringify(sections);for(const text of ['First 7 days','Days 8–30','Days 31–90','Conclusion','Evidence','Example','PS02','Application','Discussion evidence','Limited sample'])assert.ok(content.includes(text),text);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {WorkspaceAccess} from '../lib/access.mjs';
const config={public:true,user:'admin',password:'fixture'};
test('workspace login uses secure HttpOnly sessions and rejects wrong credentials',()=>{const a=new WorkspaceAccess(config);assert.equal(a.allows({headers:{}}),false);assert.throws(()=>a.login('admin','bad'),/Incorrect/);const cookie=a.login('admin','fixture');assert.match(cookie,/HttpOnly/);assert.match(cookie,/Secure/);assert.equal(a.allows({headers:{cookie}}),true);assert.equal(a.allows({headers:{cookie:'advisory_session=fake'}}),false);const token=cookie.split(';')[0].slice(17);a.sessions.set(token,0);assert.equal(a.allows({headers:{cookie}}),false);});
test('failed workspace logins are bounded without storing passwords',()=>{const a=new WorkspaceAccess(config);for(let i=0;i<10;i++)assert.throws(()=>a.login('admin','bad','client'));assert.throws(()=>a.login('admin','fixture','client'),/Too many/);assert.equal(a.login('admin','fixture','other').startsWith('advisory_session='),true);});

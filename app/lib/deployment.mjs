import crypto from 'node:crypto';
import {env} from './env.mjs';
export function deploymentConfig(read=env){
 const port=Number(process.env.PORT)||4730,raw=read('PUBLIC_URL');const origin=raw?new URL(raw).origin:`http://localhost:${port}`;
 if(raw&&new URL(raw).protocol!=='https:')throw Error('PUBLIC_URL must use HTTPS.');
 return {origin,public:Boolean(raw),host:read('HOST')||(raw?'0.0.0.0':'127.0.0.1'),redirectUri:origin+'/api/google/callback',allowedOrigins:new Set([origin,`http://localhost:${port}`,`http://127.0.0.1:${port}`]),allowedHosts:new Set([new URL(origin).hostname,'localhost','127.0.0.1']),user:read('APP_ACCESS_USER')||'admin',password:read('APP_ACCESS_PASSWORD')};
}
export function authorized(header,config){if(!config.password)return !config.public;if(typeof header!=='string'||!header.startsWith('Basic '))return false;const expected=crypto.createHash('sha256').update(config.user+':'+config.password).digest(),actual=crypto.createHash('sha256').update(Buffer.from(header.slice(6),'base64')).digest();return crypto.timingSafeEqual(expected,actual);}
export const deployment=deploymentConfig();

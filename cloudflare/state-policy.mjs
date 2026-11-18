export function allowedStatePath(value) {
  return typeof value==='string' && !/[\x00-\x20\\]/.test(value) && /^(?:tts\/(?:assignments\.json|clone-[a-f0-9]{32}\.safetensors)|google\/(?:tokens\.enc|key)|codex\/auth\.json|sessions\/[a-zA-Z0-9_-]+\/(?:events\.json|growth\.json|growth\.md|evidence\.json|brief\.md)|advisor-library\/[a-zA-Z0-9_-]+\.json)$/.test(value);
}
export function sameSecret(actual,expected) {
  if(typeof expected!=='string'||expected.length<32||typeof actual!=='string')return false;
  let different=actual.length^expected.length;
  for(let i=0;i<expected.length;i++)different|=(actual.charCodeAt(i)||0)^expected.charCodeAt(i);
  return different===0;
}

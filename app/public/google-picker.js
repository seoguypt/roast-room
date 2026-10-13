export function propertyLabel(property){
  if(property.id.startsWith('sc-domain:'))return property.id.slice(10)+' · Domain property';
  try{const u=new URL(property.id);return u.host+(u.pathname==='/'?'':u.pathname)+' · URL-prefix property';}catch{return property.id;}
}
export function matchingProperties(properties,text){
  const targets=text.split(/[\n,]+/).map(s=>s.trim()).filter(Boolean).map(s=>{try{return new URL(/^https?:\/\//i.test(s)?s:'https://'+s);}catch{return null;}});
  if(!targets.length||targets.some(u=>!u))return [];
  return properties.filter(p=>targets.every(u=>{
    if(p.id.startsWith('sc-domain:')){const host=p.id.slice(10).toLowerCase();return u.hostname===host||u.hostname.endsWith('.'+host);}
    try{const site=new URL(p.id);return site.origin===u.origin&&u.pathname.startsWith(site.pathname);}catch{return false;}
  }));
}
export function reportDates(days,now=new Date()){
  const end=new Date(now.getTime()-3*86400000),start=new Date(end.getTime()-(days-1)*86400000);
  return {start:start.toISOString().slice(0,10),end:end.toISOString().slice(0,10)};
}

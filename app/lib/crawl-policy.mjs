// Affiliate redirect paths are observable links, never crawl destinations.
export function isAffiliatePath(pathname) {
  let value=String(pathname);
  for(let i=0;i<3;i++){try{const decoded=decodeURIComponent(value);if(decoded===value)break;value=decoded;}catch{break;}}
  value=value.replace(/\\/g,'/').replace(/\/{2,}/g,'/');
  return /^\/go(?:\/|$)/i.test(value);
}
export function assertCrawlable(url) {
  if(isAffiliatePath(new URL(url).pathname))throw new Error('Excluded affiliate link: /go/ URLs are never fetched or audited.');
}

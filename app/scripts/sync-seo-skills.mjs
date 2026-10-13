import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { REPO_ROOT } from "../lib/env.mjs";
const root = process.env.SEO_SKILLS_DIR || path.join(os.homedir(), ".codex", "skills");
const names = ["seoskill-page","seoskill-technical","seoskill-content","seoskill-schema","seoskill-sitemap","seoskill-hreflang","seoskill-geo","seoskill-programmatic","seoskill-content-brief","seoskill-backlinks","seoskill-plan","seoskill-cluster","seoskill-sxo","seoskill-ecommerce","seoskill-flow","content-strategy","site-architecture"];
const out = path.join(REPO_ROOT, "app/knowledge/seo"); fs.mkdirSync(out,{recursive:true});
const docs = [];
for (const name of names) {
  const file = path.join(root,name,"SKILL.md");
  if (!fs.existsSync(file)) throw new Error(`Missing installed SEO skill: ${name}`);
  const raw = fs.readFileSync(file,"utf8");
  fs.writeFileSync(path.join(out,name+".md"),raw);
  const text = raw.replace(/^---[\s\S]*?\n---\s*/,"");
  const sections = text.split(/(?=^## )/m).filter(section => !/^## (?:Runtime|Quick Reference|Invocation|Source Detection|Error Handling|Post-Analysis|Community Footer|DataForSEO Integration|Reference Documentation|Pre-Delivery Review)/i.test(section));
  let guidance = sections.join("\n").replace(/^.*(?:claude-seo\.ps1|\$HOME|MCP available|MCP detected|spawn subagents|delegate to|SKILL\.md).*$/gim,"");
  guidance = guidance.slice(0,10000);
  docs.push({id:name,name,source:`${name}/SKILL.md`,sha256:crypto.createHash("sha256").update(raw).digest("hex"),guidance});
}
for (const [id,file] of [["content-effort","content-effort.md"],["audit-synthesis","thinking-framework.md"]]) {
  const raw = fs.readFileSync(path.join(root,"seoskill/references",file),"utf8");
  fs.writeFileSync(path.join(out,file),raw);
  docs.push({id,name:id,source:`seoskill/references/${file}`,sha256:crypto.createHash("sha256").update(raw).digest("hex"),guidance:raw.slice(0,12000)});
}
fs.writeFileSync(path.join(out,"skills.json"),JSON.stringify({syncedAt:new Date().toISOString(),method:"Snapshots of installed local skills; guidance only, no connector access",documents:docs},null,2)+"\n");
console.log(`Imported ${docs.length} SEO skill/reference documents.`);

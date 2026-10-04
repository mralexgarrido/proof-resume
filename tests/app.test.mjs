import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const html=await readFile(new URL('index.html',root),'utf8');

test('distributed app embeds the complete current source with no runtime asset dependency',async()=>{
  const ids=['core','content','export','ui'];
  assert.equal([...html.matchAll(/^<script id="proof-/gm)].length,ids.length);
  for(const id of ids){
    const source=await readFile(new URL('src/'+id+'.js',root),'utf8');
    assert.equal(html.match(new RegExp('<script id="proof-'+id+'">([\\s\\S]*?)</script>'))?.[1],source,'stale '+id+' module');
  }
  assert.equal(html.match(/<style>([\s\S]*?)<\/style>/)?.[1],await readFile(new URL('src/styles.css',root),'utf8'));
  assert.doesNotMatch(html,/\b(?:src|srcset)\s*=|<iframe\b|<object\b|<embed\b|<link[^>]+rel="stylesheet"/i);
  assert.doesNotMatch(html,/\/\* PROOF_/);
});

test('browser and hosting policies prohibit connections and app source has no networking APIs',async()=>{
  const headers=await readFile(new URL('public/_headers',root),'utf8');
  const policy=html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1];
  assert.ok(policy);
  for(const rule of ["default-src 'none'","connect-src 'none'","font-src 'none'","object-src 'none'","base-uri 'none'","form-action 'none'"]){assert.ok(policy.includes(rule));assert.ok(headers.includes(rule));}
  assert.doesNotMatch(html,/\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\s*\(|\bsendBeacon\s*\(|\bEventSource\s*\(|\bWorker\s*\(|\bserviceWorker\b/);
  const css=await readFile(new URL('src/styles.css',root),'utf8');
  assert.doesNotMatch(css,/@import\b|url\s*\(/i);
  assert.doesNotMatch(html,/<(?:a|link)\b[^>]*href=["']https?:/i);
});

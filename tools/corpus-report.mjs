import { probe } from './color-probe.mjs';
import fs from 'node:fs'; import path from 'node:path';
const ROOT='Carousel examples';
function dirs(d,out=[]){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name); if(e.isDirectory()){const imgs=fs.readdirSync(p).filter(f=>/\.(jpe?g|png)$/i.test(f)); if(imgs.length) out.push([p,imgs]); dirs(p,out);}} return out;}
function ord(n){ const m=n.match(/slide-(\d+)/i); if(m) return +m[1]; const m2=n.match(/\((\d+)\)\.(jpg|png)$/i); if(m2) return +m2[1]; return 0; }
const all=[];
for(const [d,imgs] of dirs(ROOT)){
  const s=imgs.slice().sort((a,b)=>ord(a)-ord(b));
  console.log('\n### '+d.replace('Carousel examples'+path.sep,'')+'  ['+s.length+' slides]');
  for (let i=0;i<s.length;i++){
    const r = await probe(path.join(d,s[i]));
    r.folder=d; r.index=i+1; r.count=s.length; all.push(r);
    const acc = r.accentClusters.map(c=>`${c.hex}@h${c.hueBin}(${(c.frac*100).toFixed(1)}%)`).join(' ');
    console.log(` ${String(i+1).padStart(2)}/${s.length} ${r.W}x${r.H} bg=${r.bg.hex}(L${r.bg.L},C${r.bg.C},cov${r.bg.coverage}) L05/50/95=${r.lum.p05}/${r.lum.p50}/${r.lum.p95} chroma̅=${r.meanChroma} chromFrac=${r.chromaticFrac} | ${acc||'(neutral)'}`);
  }
}
fs.writeFileSync('tools/corpus-report.json', JSON.stringify(all,null,1));
console.log('\n\n=== corpus-wide ===');
console.log('slides:',all.length);
const nAcc = all.map(r=>r.accentClusters.length);
console.log('accent-cluster count histogram:', nAcc.reduce((m,v)=>(m[v]=(m[v]||0)+1,m),{}));

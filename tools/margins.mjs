import sharp from 'sharp'; import fs from 'node:fs'; import path from 'node:path';
const ROOT='Carousel examples';
function dirs(d,out=[]){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name); if(e.isDirectory()){const imgs=fs.readdirSync(p).filter(f=>/\.(jpe?g|png)$/i.test(f)); if(imgs.length) out.push([p,imgs]); dirs(p,out);}} return out;}
function ord(n){ const m=n.match(/slide-(\d+)/i); if(m) return +m[1]; const m2=n.match(/\((\d+)\)\.(jpg|png)$/i); if(m2) return +m2[1]; return 0; }

// only measure FLAT-BG slides (where a content bbox is meaningful)
async function bbox(file){
  const N=270;
  const {data,info}=await sharp(file).removeAlpha().resize(N,null,{fit:'inside'}).raw().toBuffer({resolveWithObject:true});
  const w=info.width,h=info.height,ch=info.channels;
  const at=(x,y)=>{const i=(y*w+x)*ch; return [data[i],data[i+1],data[i+2]];};
  // bg = mean of 4 corners 3x3
  let br=0,bg=0,bb=0,n=0;
  for (const [cx,cy] of [[1,1],[w-2,1],[1,h-2],[w-2,h-2]]) for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){const[r,g,b]=at(cx+dx,cy+dy);br+=r;bg+=g;bb+=b;n++;}
  br/=n;bg/=n;bb/=n;
  const dist=(r,g,b)=>Math.hypot(r-br,g-bg,b-bb);
  // flatness: fraction of pixels within 12 of bg
  let flat=0, tot=w*h;
  let minX=w,maxX=-1,minY=h,maxY=-1;
  const rowInk=new Array(h).fill(0);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const[r,g,b]=at(x,y); const d=dist(r,g,b); if(d<14) flat++; else {if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;rowInk[y]++;}}
  const flatFrac=flat/tot;
  return { flatFrac:+flatFrac.toFixed(2), w,h,
    left:maxX<0?null:+(minX/w).toFixed(3), right:maxX<0?null:+((w-1-maxX)/w).toFixed(3),
    top:maxY<0?null:+(minY/h).toFixed(3), bottom:maxY<0?null:+((h-1-maxY)/h).toFixed(3),
    rowInk: rowInk.map(v=>+(v/w).toFixed(2)) };
}

const lefts=[],rights=[],tops=[],bots=[];
for(const [d,imgs] of dirs(ROOT)){
  const s=imgs.slice().sort((a,b)=>ord(a)-ord(b));
  const rows=[];
  for(let i=0;i<s.length;i++){
    const r=await bbox(path.join(d,s[i]));
    if (r.flatFrac>=0.45 && r.left!=null){ lefts.push(r.left);rights.push(r.right);tops.push(r.top);bots.push(r.bottom); rows.push(`${i+1}: flat=${r.flatFrac} margins L${(r.left*1080|0)} R${(r.right*1080|0)} T${(r.top*1440|0)} B${(r.bottom*1440|0)}`);}
  }
  if(rows.length) console.log('### '+d.replace('Carousel examples'+path.sep,'')+'\n  '+rows.join('\n  '));
}
const pct=(a,p)=>{a=a.slice().sort((x,y)=>x-y);return a[Math.floor(p*(a.length-1))];};
console.log('\n=== FLAT-BG SAFE MARGIN DISTRIBUTION (n='+lefts.length+') normalised, then @1080x1440 ===');
for (const [name,arr,dim] of [['left',lefts,1080],['right',rights,1080],['top',tops,1440],['bottom',bots,1440]]) {
  console.log(`${name.padEnd(7)} p10=${(pct(arr,.10)*dim)|0}px  p25=${(pct(arr,.25)*dim)|0}px  p50=${(pct(arr,.5)*dim)|0}px  p75=${(pct(arr,.75)*dim)|0}px  p90=${(pct(arr,.9)*dim)|0}px`);
}

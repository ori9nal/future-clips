import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

// ---------- color math ----------
function srgbToLinear(c){ c/=255; return c<=0.04045 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4); }
function rgbToXyz(r,g,b){
  r=srgbToLinear(r); g=srgbToLinear(g); b=srgbToLinear(b);
  return [ r*0.4124+g*0.3576+b*0.1805, r*0.2126+g*0.7152+b*0.0722, r*0.0193+g*0.1192+b*0.9505 ];
}
function f(t){ return t>0.008856 ? Math.cbrt(t) : (7.787*t + 16/116); }
export function rgbToLab(r,g,b){
  const [X,Y,Z]=rgbToXyz(r,g,b);
  const xn=0.95047, yn=1.0, zn=1.08883;
  const fx=f(X/xn), fy=f(Y/yn), fz=f(Z/zn);
  return [116*fy-16, 500*(fx-fy), 200*(fy-fz)];
}
export function labChroma(L,a,b){ return Math.sqrt(a*a+b*b); }
export function labHue(L,a,b){ let h=Math.atan2(b,a)*180/Math.PI; if(h<0)h+=360; return h; }
const hex = (r,g,b)=>'#'+[r,g,b].map(v=>Math.round(v).toString(16).padStart(2,'0')).join('').toUpperCase();

// ---------- probe ----------
export async function probe(file, opts={}) {
  const img = sharp(file).removeAlpha();
  const meta = await img.metadata();
  const W=meta.width, H=meta.height;
  const { data, info } = await sharp(file).removeAlpha().resize(180, null, {fit:'inside'}).raw().toBuffer({resolveWithObject:true});
  const w=info.width, h=info.height, ch=info.channels;
  const px=[];
  for (let i=0;i<w*h;i++){
    const r=data[i*ch], g=data[i*ch+1], b=data[i*ch+2];
    const [L,A,B]=rgbToLab(r,g,b);
    px.push({r,g,b,L,A,B,C:labChroma(L,A,B),Hh:labHue(L,A,B), x:i%w, y:(i/w)|0});
  }
  // background = modal color of the 6% frame border
  const bw = Math.max(2, Math.round(w*0.06)), bh = Math.max(2, Math.round(h*0.06));
  const border = px.filter(p=>p.x<bw||p.x>=w-bw||p.y<bh||p.y>=h-bh);
  const bucket = new Map();
  for (const p of border){ const k=`${p.r>>3},${p.g>>3},${p.b>>3}`; const e=bucket.get(k)||{n:0,r:0,g:0,b:0}; e.n++; e.r+=p.r; e.g+=p.g; e.b+=p.b; bucket.set(k,e); }
  const top=[...bucket.values()].sort((a,b)=>b.n-a.n)[0];
  const bg={r:top.r/top.n, g:top.g/top.n, b:top.b/top.n, frac: top.n/border.length};
  const [bgL,bgA,bgB]=rgbToLab(bg.r,bg.g,bg.b);

  // chromatic clusters: pixels with C>18, binned by hue (20deg bins), weighted
  const CHROMA_MIN = opts.chromaMin ?? 18;
  const chromatic = px.filter(p=>p.C>=CHROMA_MIN);
  const hb = new Array(18).fill(0).map(()=>({n:0,C:0,L:0,r:0,g:0,b:0}));
  for (const p of chromatic){ const i=Math.floor(p.Hh/20)%18; const e=hb[i]; e.n++; e.C+=p.C; e.L+=p.L; e.r+=p.r; e.g+=p.g; e.b+=p.b; }
  const clusters = hb.map((e,i)=> e.n? {hueBin:i*20, n:e.n, frac:+(e.n/px.length).toFixed(4), meanC:+(e.C/e.n).toFixed(1), meanL:+(e.L/e.n).toFixed(1), hex:hex(e.r/e.n,e.g/e.n,e.b/e.n)} : null)
    .filter(Boolean).sort((a,b)=>b.n-a.n);
  // merge adjacent hue bins
  const merged=[];
  for (const c of clusters){
    const near = merged.find(m=> Math.min(Math.abs(m.hueBin-c.hueBin), 360-Math.abs(m.hueBin-c.hueBin))<=20);
    if (near && c.frac < near.frac) { near.n+=c.n; near.frac=+(near.frac+c.frac).toFixed(4); }
    else merged.push({...c});
  }
  const sig = merged.filter(m=>m.frac>=0.008);

  // luminance stats
  const Ls = px.map(p=>p.L).sort((a,b)=>a-b);
  const q=(f)=>Ls[Math.floor(f*(Ls.length-1))];
  const meanC = px.reduce((s,p)=>s+p.C,0)/px.length;

  // ink-coverage per horizontal band (24 bands) — how "busy" each vertical zone is
  const BANDS=24, bands=new Array(BANDS).fill(0);
  for (const p of px){ const bi=Math.min(BANDS-1, Math.floor(p.y/h*BANDS)); if (Math.abs(p.L-bgL)>18 || Math.abs(p.C-labChroma(bgL,bgA,bgB))>18) bands[bi]++; }
  const perBand = Math.ceil(px.length/BANDS);
  const bandCov = bands.map(v=>+(v/perBand).toFixed(2));

  return {
    file, W, H, ratio:+(W/H).toFixed(4),
    bg: { hex: hex(bg.r,bg.g,bg.b), L:+bgL.toFixed(1), C:+labChroma(bgL,bgA,bgB).toFixed(1), coverage:+bg.frac.toFixed(2) },
    lum: { p05:+q(0.05).toFixed(1), p50:+q(0.5).toFixed(1), p95:+q(0.95).toFixed(1) },
    meanChroma:+meanC.toFixed(1),
    chromaticFrac:+(chromatic.length/px.length).toFixed(3),
    accentClusters: sig.slice(0,4),
    bandCov,
  };
}

if (process.argv[2]) {
  const out = await probe(process.argv[2]);
  console.log(JSON.stringify(out,null,1));
}

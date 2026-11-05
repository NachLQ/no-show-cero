module.exports=function auditBrowser(){
 const parse=c=>{const n=c.match(/[\d.]+/g)?.map(Number)||[0,0,0,0];return [n[0],n[1],n[2],n[3]??1]};
 const blend=(f,b)=>[0,1,2].map(i=>f[i]*(f[3]??1)+b[i]*(1-(f[3]??1)));
 const lum=c=>{const n=c.map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4});return n[0]*.2126+n[1]*.7152+n[2]*.0722};
 const failures=[];let tested=0;
 for(const e of document.querySelectorAll('#root *')){
  if(![...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()))continue;
  const r=e.getBoundingClientRect(),cs=getComputedStyle(e);
  if(!r.width||!r.height||cs.visibility==='hidden'||e.closest(':disabled,[aria-disabled="true"]'))continue;
  let bg=[255,255,255];const chain=[];for(let p=e;p;p=p.parentElement)chain.unshift(p);
  for(const p of chain){const ps=getComputedStyle(p);bg=blend(parse(ps.backgroundColor),bg);const colors=ps.backgroundImage.match(/rgba?\([^)]+\)/g)||[];if(colors.length){const fg=parse(cs.color);const candidates=[...(colors.every(c=>parse(c)[3]===1)?[]:[bg]),...colors.map(c=>blend(parse(c),bg))];bg=candidates.sort((a,b)=>{const f=lum(fg);const ratio=x=>(Math.max(f,lum(x))+.05)/(Math.min(f,lum(x))+.05);return ratio(a)-ratio(b)})[0];}}
  const color=parse(cs.color);let fg=blend(color,bg);let opacity=1;for(const p of chain)opacity*=Number(getComputedStyle(p).opacity);fg=blend([...fg,opacity],bg);
  const l1=lum(fg),l2=lum(bg),ratio=(Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05);
  const large=parseFloat(cs.fontSize)>=24||(parseFloat(cs.fontSize)>=18.66&&Number(cs.fontWeight)>=700);const required=large?3:4.5;
  tested++;if(ratio+.02<required)failures.push({text:e.textContent.trim().slice(0,70),cls:e.className,ratio:+ratio.toFixed(2),required,fg:cs.color,bg:bg.map(Math.round).join(',')});
 }
 return {tested,failures,gradientNote:'Conservative contrast against gradient color stops; screenshots checked separately.',reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches};
};

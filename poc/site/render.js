// Architectural illustration of MIT Building 54, not a surveyed model.
// Facade reference: https://hacks.mit.edu/by_year/2012/tetris/tetris1_img6080.jpg
// River composition reference: https://www.gettyimages.com/detail/photo/2170429289
// Photos are references only; all scene artwork is drawn procedurally.
// 2026 installation context: https://www.anhadsawhney.com/green-building-tetris
// The historical photo informs architecture only. All 153 display windows below
// are driven solely by the incoming 2026 17x9, top-to-bottom RGB frame.
export const ROWS = 17, COLS = 9;
const scenes = new WeakMap();
// River-view layout knobs, set per scene build. k squeezes skyline x toward
// the centre (display-first framing); S scales landmark size with the tower.
let LAY={k:1,S:1};
const LX=(x)=>.5+(x-.5)*LAY.k, LS=()=>LAY.S, LW=()=>LAY.S*LAY.k;
const rgba = (r, g, b, a) => `rgba(${r},${g},${b},${a})`;
const noise = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

function polygon(ctx, points, fill, stroke, width = 1) {
  ctx.beginPath();
  points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
}
function line(ctx, points, color, width = 1) {
  ctx.beginPath();
  points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
}
function glow(ctx, x, y, radius, color, strength) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
  g.addColorStop(0, `rgba(${color},${strength})`);
  g.addColorStop(1, `rgba(${color},0)`);
  ctx.fillStyle = g; ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}
function surface(ctx, W, H) {
  const canvas = ctx.canvas.ownerDocument
    ? ctx.canvas.ownerDocument.createElement('canvas') : new OffscreenCanvas(W, H);
  canvas.width = W; canvas.height = H;
  return canvas;
}
// Maps local facade coordinates onto a tapered, slightly oblique elevation.
function elevation(corners) {
  return (u, v) => {
    const [a, b, c, d] = corners;
    return [(1-v)*((1-u)*a[0]+u*b[0])+v*((1-u)*d[0]+u*c[0]),
      (1-v)*((1-u)*a[1]+u*b[1])+v*((1-u)*d[1]+u*c[1])];
  };
}
const rect = (p, u, v, w, h) => [p(u,v), p(u+w,v), p(u+w,v+h), p(u,v+h)];

function sky(ctx, W, H, horizon) {
  // Cambridge at night is light-polluted: a warm brown-grey haze, not a
  // deep blue star field (see the 2012 reference photo). Stars barely show.
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#141419'); g.addColorStop(.35, '#26242a');
  g.addColorStop(.70, '#4a4038'); g.addColorStop(.92, '#6b5646'); g.addColorStop(1, '#7a6350');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // Sodium/LED skyglow pooling over the city at the horizon.
  glow(ctx, W*.55, horizon*1.02, W*.9, '214,150,96', .16);
  glow(ctx, W*.85, horizon, W*.5, '226,170,110', .10);
  glow(ctx, W*.15, horizon, W*.45, '170,140,120', .07);
  // Low, ragged cloud banks catching the city light from below.
  for (let i=0; i<26; i++) {
    const y = H*(.05+noise(i+19)*.62), lit = y/horizon;
    ctx.save(); ctx.translate(W*noise(i+2), y);
    ctx.scale(4+noise(i+7)*4, .28+noise(i+9)*.2);
    glow(ctx, 0, 0, W*(.05+noise(i+4)*.09), lit>.6?'150,118,96':'96,92,98', .05+lit*.05);
    ctx.restore();
  }
  // A sparse, dim star field survives only high in the sky.
  const starScale = Math.max(.8, Math.min(W, H) / 750);
  for (let i=0; i<70; i++) {
    const x=noise(i+70)*W, y=noise(i+140)*horizon*.55;
    const bright=noise(i+44), fade=(1-(y/(horizon*.55))**1.5)*.55;
    ctx.fillStyle=`rgba(225,228,238,${(.15+bright*.45)*fade})`;
    ctx.beginPath();ctx.arc(x,y,(bright>.9?1.1:.6)*starScale,0,Math.PI*2);ctx.fill();
  }
}

function campus(ctx, W, H, horizon, river) {
  const buildings = river
    ? [[-.02,.14,.045],[.11,.10,.038],[.24,.16,.05],[.36,.09,.042],[.55,.12,.06],[.63,.08,.05],
       [.62,.06,.075],[.68,.05,.09],[.72,.05,.085],[.755,.04,.216],[.795,.045,.245],[.845,.05,.08],[.92,.055,.29],[.975,.05,.10]]
    : [[-.03,.28,.23],[.23,.14,.12],[.74,.30,.18]];
  for (const [x,w,h] of buildings) {
    const bx=(river?LX(x):x)*W, by=horizon-h*H*(river?LS():1), bw=w*W*(river?LW():1), bh=h*H*(river?LS():1);
    // Farther (shorter) blocks sit lighter in the haze; nearer ones are darker.
    const haze=river?Math.min(1,h/.14):1;
    ctx.fillStyle=river?`rgb(${58-haze*18},${52-haze*16},${48-haze*14})`:'#2a2521';
    ctx.fillRect(bx,by,bw,bh);
    ctx.fillStyle=river?'rgba(120,108,92,.35)':'#4a413a';ctx.fillRect(bx,by,bw,Math.max(1,H*.003));
    if(river&&h>.09) { // rooftop mechanical penthouse on the tall Kendall blocks
      ctx.fillStyle='#2e2a27';ctx.fillRect(bx+bw*.3,by-H*.012,bw*.4,H*.012);
    }
    const spacing=Math.max(5, H*(river?.009:.016));
    for(let yy=by+spacing; yy<horizon-spacing; yy+=spacing*1.65) {
      line(ctx,[[bx,yy+spacing],[bx+bw,yy+spacing]],'#1a1613',Math.max(1,spacing*.22));
      for(let xx=bx+spacing;xx<bx+bw-spacing;xx+=spacing*1.1) {
        const n=noise(xx+yy);
        ctx.fillStyle=n>.73?`rgba(255,214,150,${.18+n*.40})`:'#1c1a1a';
        ctx.fillRect(xx,yy,spacing*.53,spacing*.72);
      }
    }
  }
  if(river) { hayden(ctx,W,H,horizon); stata(ctx,W,H,horizon); mediaLab(ctx,W,H,horizon); walker(ctx,W,H,horizon); }
  if(river) {
    // Great Dome (Building 10): a tall Ionic portico fills the facade, an
    // entablature and low windowed drum sit above it, and a rounded
    // Pantheon-style dome with an oculus cap crowns it. Sized from OSM height.
    const x=W*LX(.07), total=H*.185*LS(), base=horizon, r=Math.min(H*.054,W*.07)*LW();
    const hair=Math.max(.45,H/1500);
    const portH=total*.50, entH=total*.07, drumH=total*.10, domeH=total*.33;
    const bw=r*3.4;
    const stone=ctx.createLinearGradient(x-bw/2,0,x+bw/2,0);
    stone.addColorStop(0,'#5b5d58');stone.addColorStop(.35,'#8b8778');
    stone.addColorStop(.7,'#767467');stone.addColorStop(1,'#4b4f50');
    // Maclaurin wings (Buildings 3 and 4, 27 m): long limestone ranges either
    // side of Building 10, with a pilaster rhythm and the carved frieze of
    // scientists' names along the top. Apparent height ~.11H.
    const wingH=H*.11*LS(), wy=base-wingH, wingW=bw*1.35;
    for(const dir of [-1,1]) {
      const wx=dir<0 ? x-bw/2-wingW : x+bw/2;
      const wg=ctx.createLinearGradient(0,wy,0,base);
      wg.addColorStop(0,'#7f7a6b');wg.addColorStop(1,'#4f4b43');
      ctx.fillStyle=wg;ctx.fillRect(wx,wy,wingW,wingH);
      ctx.fillStyle='#a49f8b';ctx.fillRect(wx,wy,wingW,wingH*.05);                 // cornice
      ctx.fillStyle='#8e897a';ctx.fillRect(wx,wy+wingH*.05,wingW,wingH*.10);       // frieze band
      for(let i=0;i<22;i++){const fx=wx+wingW*(.02+i*.045);                         // carved names
        ctx.fillStyle='rgba(40,36,30,.45)';ctx.fillRect(fx,wy+wingH*.085,wingW*.03,wingH*.035);}
      const nP=9, pp=wingW/nP;
      for(let i=0;i<nP;i++){const px=wx+i*pp;
        ctx.fillStyle='#9c9581';ctx.fillRect(px+pp*.08,wy+wingH*.18,pp*.10,wingH*.70);   // pilaster
        ctx.fillStyle='#2b2f31';ctx.fillRect(px+pp*.32,wy+wingH*.25,pp*.36,wingH*.28);   // upper window
        ctx.fillStyle=noise(i*13+dir)>.45?'rgba(255,215,160,.32)':'#23282b';
        ctx.fillRect(px+pp*.32,wy+wingH*.60,pp*.36,wingH*.26);}                          // lower window
    }
    // Portico: shadowed wall behind a row of ten tall columns with bases and capitals.
    const py=base-portH;
    ctx.fillStyle='#2a3238';ctx.fillRect(x-bw/2,py,bw,portH);
    const nCol=10, pitch=bw*.86/(nCol-1), cw=r*.13;
    for(let i=0;i<nCol;i++) {
      const cx=x-bw*.43+i*pitch;
      const col=ctx.createLinearGradient(cx-cw/2,0,cx+cw/2,0);
      col.addColorStop(0,'#4f5a5a');col.addColorStop(.4,'#b9b19a');col.addColorStop(1,'#6f776f');
      ctx.fillStyle=col;ctx.fillRect(cx-cw/2,py+portH*.10,cw,portH*.82);
      ctx.fillStyle='#b0a88f';ctx.fillRect(cx-cw*.85,py+portH*.08,cw*1.7,portH*.05);   // capital
      ctx.fillStyle='#8d8873';ctx.fillRect(cx-cw*.8,py+portH*.90,cw*1.6,portH*.04);    // base
      if(i<nCol-1){ctx.fillStyle='rgba(255,215,160,.28)';ctx.fillRect(cx+pitch*.5-cw*.4,py+portH*.35,cw*.8,portH*.35);}
    }
    // Entablature and pediment line.
    ctx.fillStyle=stone;ctx.fillRect(x-bw*.52,py-entH,bw*1.04,entH);
    ctx.fillStyle='#a9a48f';ctx.fillRect(x-bw*.53,py-entH,bw*1.06,entH*.22);
    ctx.fillStyle='#3f4645';ctx.fillRect(x-bw*.52,py-entH*.45,bw*1.04,hair*1.5);
    // Drum: ring of small windows under the dome.
    const dy=py-entH-drumH, drumW=r*2.6;
    ctx.fillStyle=stone;ctx.fillRect(x-drumW/2,dy,drumW,drumH);
    for(let i=-5;i<=5;i++) {
      const a=i/6*Math.PI/2, wx=x+Math.sin(a)*drumW*.46, ww=Math.max(hair,Math.cos(a)*r*.09);
      ctx.fillStyle='#2b3a40';ctx.fillRect(wx-ww/2,dy+drumH*.30,ww,drumH*.42);
    }
    ctx.fillStyle='#a5a08b';ctx.fillRect(x-drumW*.53,dy-hair*2,drumW*1.06,hair*3);
    // Dome: rounded cap, lit from the upper left, with curved masonry courses.
    const rx=drumW*.5, ry=domeH, cy=dy;
    const dome=ctx.createRadialGradient(x-rx*.35,cy-ry*.75,rx*.05,x+rx*.15,cy-ry*.2,rx*1.5);
    dome.addColorStop(0,'#b9b8a6');dome.addColorStop(.45,'#8f978f');dome.addColorStop(.8,'#5f6d6f');dome.addColorStop(1,'#3d4c54');
    ctx.save();
    ctx.beginPath();ctx.ellipse(x,cy,rx,ry,0,Math.PI,0);ctx.closePath();
    ctx.fillStyle=dome;ctx.fill();ctx.clip();
    for(let i=1;i<=6;i++) {
      const t=i/7, yy=cy-ry*(1-t), half=rx*Math.sqrt(1-(1-t)**2);
      ctx.beginPath();ctx.ellipse(x,yy,half,ry*.08*t,0,0,Math.PI);
      ctx.strokeStyle='rgba(35,50,56,.28)';ctx.lineWidth=hair;ctx.stroke();
    }
    ctx.restore();
    ctx.beginPath();ctx.ellipse(x,cy,rx,ry,0,Math.PI,0);
    ctx.strokeStyle='rgba(215,215,190,.35)';ctx.lineWidth=hair;ctx.stroke();
    // Oculus cap.
    ctx.fillStyle='#b4b7a8';ctx.beginPath();ctx.ellipse(x,cy-ry+r*.02,r*.22,r*.05,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#65787a';ctx.beginPath();ctx.ellipse(x,cy-ry+r*.012,r*.14,r*.025,0,0,Math.PI*2);ctx.fill();
  }
}

// MIT landmarks along the river, stylised (artistic liberty outside the grid,
// see docs/RENDERING.md). Drawn from memory of the buildings, not from photos.
function hayden(ctx, W, H, horizon) {
  // Hayden Library: long low limestone block on Memorial Drive, tall narrow bays.
  const x=W*LX(.355), w=W*.12*LW(), h=H*.105*LS(), y=horizon-h;
  const g=ctx.createLinearGradient(x,y,x,horizon);
  g.addColorStop(0,'#7d7466');g.addColorStop(1,'#4e4840');
  ctx.fillStyle=g;ctx.fillRect(x,y,w,h);
  ctx.fillStyle='#8c8374';ctx.fillRect(x,y,w,Math.max(1,H*.003));
  const bays=14, bw=w/bays;
  for(let i=0;i<bays;i++) {
    const bx=x+i*bw;
    ctx.fillStyle='#2a2823';ctx.fillRect(bx+bw*.25,y+h*.18,bw*.5,h*.62);
    if(i%3!==1){ctx.fillStyle=`rgba(255,220,160,${.25+noise(i+31)*.35})`;ctx.fillRect(bx+bw*.3,y+h*.22,bw*.4,h*.5);}
    ctx.fillStyle='#6f665a';ctx.fillRect(bx,y+h*.15,Math.max(1,bw*.12),h*.7);
  }
}
function stata(ctx, W, H, horizon) {
  // Stata Center (CSAIL): a huddle of tilted, colliding volumes in brushed
  // metal and brick, poking up behind the tower's right shoulder.
  const x=W*LX(.265), base=horizon-H*.012, h=H*.137*LS();
  const shapes=[
    {pts:[[0,0],[.16,-.02],[.19,-.72],[.03,-.80]],c:'#5e5a58'},
    {pts:[[.14,0],[.30,0],[.33,-.60],[.12,-.66]],c:'#5a3226'},
    {pts:[[.27,0],[.42,-.04],[.38,-.95],[.24,-.82]],c:'#6f6d6b'},
    {pts:[[.40,0],[.55,0],[.60,-.55],[.44,-.62]],c:'#6e5a2e'},
    {pts:[[.52,-.05],[.66,0],[.62,-.78],[.50,-.70]],c:'#636669'},
  ];
  for(const {pts,c} of shapes) {
    const p=pts.map(([u,v])=>[x+u*W*.13*LW(),base+v*h]);
    polygon(ctx,p,c,'rgba(20,16,12,.35)',Math.max(.6,H/1400));
    line(ctx,[p[3],p[2]],'rgba(200,190,170,.35)',Math.max(.6,H/1400));
    // Panel seams and a few lit windows so it reads as metal, not paper.
    const [a,b,cc,d]=p;
    for(let t=.2;t<1;t+=.2) line(ctx,[[a[0]+(d[0]-a[0])*t,a[1]+(d[1]-a[1])*t],[b[0]+(cc[0]-b[0])*t,b[1]+(cc[1]-b[1])*t]],'rgba(20,16,12,.18)',Math.max(.5,H/1600));
    for(let i=0;i<6;i++){const t=.15+i*.14,u=.3+noise(i+t*7)*.4;
      const px=a[0]+(b[0]-a[0])*u+(d[0]-a[0])*t, py=a[1]+(b[1]-a[1])*u+(d[1]-a[1])*t;
      if(noise(px+py)>.5){ctx.fillStyle='rgba(255,225,170,.55)';ctx.fillRect(px,py,W*.003,H*.005);}}
  }
}
function walker(ctx, W, H, horizon) {
  // Walker Memorial: limestone block with a tall Ionic column screen facing the river.
  const w=W*.075*LW(), x=W*LX(.70)-w/2, h=H*.125*LS(), y=horizon-h;
  const g=ctx.createLinearGradient(x,y,x,horizon);
  g.addColorStop(0,'#867c6c');g.addColorStop(1,'#544d43');
  ctx.fillStyle=g;ctx.fillRect(x,y,w,h);
  ctx.fillStyle='#9a917f';ctx.fillRect(x-w*.03,y,w*1.06,h*.08);           // entablature
  ctx.fillStyle='#2b2823';ctx.fillRect(x+w*.08,y+h*.12,w*.84,h*.62);        // shadowed portico
  for(let i=0;i<7;i++){const cx=x+w*(.10+i*.132);
    ctx.fillStyle='#b3a88f';ctx.fillRect(cx,y+h*.12,w*.045,h*.62);
    ctx.fillStyle='rgba(255,220,160,.35)';ctx.fillRect(cx+w*.075,y+h*.30,w*.04,h*.25);}
  ctx.fillStyle='#6e6558';ctx.fillRect(x-w*.05,y+h*.74,w*1.10,h*.26);      // base
}
function mediaLab(ctx, W, H, horizon) {
  // Media Lab (E14): a glass box behind a fine aluminium screen, glowing from
  // inside, with the cantilevered upper block.
  const x=W*LX(.77), w=W*.075*LW(), h=H*.122*LS(), y=horizon-h;
  const glow=ctx.createLinearGradient(x,y,x,horizon);
  glow.addColorStop(0,'#6f6a60');glow.addColorStop(.5,'#5e594f');glow.addColorStop(1,'#3e3a34');
  ctx.fillStyle=glow;ctx.fillRect(x,y,w,h);
  ctx.fillStyle='#7a756a';ctx.fillRect(x-w*.06,y,w*1.12,h*.3);      // upper block overhang
  ctx.fillStyle='#2f2d2a';ctx.fillRect(x-w*.06,y+h*.3,w*1.12,Math.max(1,H*.003));
  // Screen: dense fine grid over the glass; a few dark floors for depth.
  const cols=18, rows=9, cw=w/cols, rh=h/rows;
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++) {
    const lit=noise(r*31+c*7)>.35;
    ctx.fillStyle=lit?`rgba(255,236,200,${.22+noise(c+r)*.30})`:'rgba(30,28,25,.5)';
    ctx.fillRect(x+c*cw+cw*.15,y+r*rh+rh*.15,cw*.7,rh*.7);
  }
  ctx.save();ctx.globalCompositeOperation='screen';
  glow_(ctx,x+w/2,y+h*.6,w*.9,'255,225,180',.08);ctx.restore();
}
const glow_=glow;

function tree(ctx, x, y, size, seed) {
  line(ctx,[[x,y],[x-size*.04,y-size*.64]],'#15110e',size*.045);
  for(let i=0;i<28;i++) {
    const dx=(noise(seed+i)-.5)*size, dy=noise(seed+i+50)*size*.58;
    ctx.fillStyle=i%3?'#161512':'#1f1b16';
    ctx.beginPath();ctx.ellipse(x+dx,y-size*.38-dy,size*(.12+noise(i+seed)*.11),size*.13,0,0,Math.PI*2);ctx.fill();
  }
}
function lamp(ctx, x, y, h) {
  const s=Math.max(1,h/60);
  line(ctx,[[x,y],[x,y-h]],'#101b21',s*2.2);
  line(ctx,[[x-10*s,y-h+9*s],[x+10*s,y-h+9*s]],'#293b42',s*1.5);
  for(const dx of [-9,0,9]) {
    const cy=y-h+(dx?5:0)*s;
    glow(ctx,x+dx*s,cy,27*s,'255,209,139',.17);
    ctx.fillStyle='#fff1d1';ctx.beginPath();ctx.ellipse(x+dx*s,cy,2.4*s,3.3*s,0,0,Math.PI*2);ctx.fill();
  }
  glow(ctx,x,y,38*s,'223,174,108',.08);
}

function riverShore(ctx, W, H, horizon, realistic) {
  // A continuous canopy, with a retaining wall and sailing pavilion at the water.
  for(let i=0;i<110;i++) {
    // Realistic: the Memorial Drive canopy actually hides the bottom two
    // display rows from the Esplanade. Idealised: only the colonnade is hidden.
    const x=W*i/109, h=(realistic ? H*(.066+noise(i+810)*.028) : H*(.036+noise(i+810)*.024))*LS();
    tree(ctx,x,horizon-H*.004,h,900+i*31);
  }
  ctx.fillStyle='#4c5553';ctx.fillRect(0,horizon-H*.010,W,H*.010);
  line(ctx,[[0,horizon-H*.011],[W,horizon-H*.011]],'#788078',Math.max(.8,H/850));
  const px=W*LX(.83), py=horizon-H*.010, pw=Math.min(W*.085,H*.13)*LW(), ph=H*.030*LS();
  ctx.fillStyle='#7c8178';ctx.fillRect(px,py-ph,pw,ph);
  polygon(ctx,[[px-pw*.08,py-ph],[px+pw*.18,py-ph*1.6],[px+pw*.39,py-ph],
    [px+pw*.65,py-ph*1.6],[px+pw*1.08,py-ph]],'#b1b1a0');
  for(let i=0;i<5;i++) {
    ctx.fillStyle=i%2?'#2b3d45':'#af9f7b';
    ctx.fillRect(px+pw*(.08+i*.18),py-ph*.75,pw*.10,ph*.62);
  }
  line(ctx,[[px-pw*.4,py+H*.005],[px+pw*1.3,py+H*.005]],'#8b8979',Math.max(1,H*.002));
  // Small dockside masts and furled boats, subordinate to the live display.
  for(let i=0;i<70;i++) {
    const x=W*LX(.62+i*.0055),h=H*(.016+noise(i+9)*.014)*LS();
    line(ctx,[[x,horizon],[x,horizon-h]],'#7b8582',Math.max(.5,W/2200));
    polygon(ctx,[[x,horizon-h*.7],[x+W*.003,horizon-H*.004],[x-W*.002,horizon-H*.004]],
      i%3?'#957569':'#aaa898');
  }
}

function tower(ctx, corners, sideQuad, W, H) {
  const p=elevation(corners), [a,b,c,d]=corners;
  const unit=Math.max(.6,H/900);
  // East face, seen from the Esplanade as a lighter strip right of the grid.
  const sideWidth=sideQuad ? Math.max(0, sideQuad[1][0]-sideQuad[0][0]) : 0;
  const side=sideQuad || [b,b,c,c];
  const sp=elevation(side);
  const sg=ctx.createLinearGradient(b[0],0,b[0]+Math.max(1,sideWidth),0);
  sg.addColorStop(0,'#8a7f6c');sg.addColorStop(.5,'#968b77');sg.addColorStop(1,'#5f5850');
  if (sideWidth > 0) polygon(ctx,side,sg);
  // Blank concrete end wall with a few narrow slit windows; nothing lit.
  const bays=sideWidth>(b[0]-a[0])*.35?6:3;
  for(let i=1;sideWidth > 0 && i<=bays;i++) {
    if(i<bays)line(ctx,[sp(i/bays,0),sp(i/bays,1)],'rgba(40,32,24,.30)',unit*.9);
    for(let r=0;r<17;r++)polygon(ctx,rect(sp,i/bays-.10,.09+r*.045,.05,.022),'#2a2c2c');
  }
  const concrete=ctx.createLinearGradient(a[0],a[1],c[0],c[1]);
  // Warm tan concrete, darker at the crown, lifted by plaza and lobby light at the base.
  concrete.addColorStop(0,'#5a544a');concrete.addColorStop(.55,'#736a5b');concrete.addColorStop(1,'#9a8a72');
  polygon(ctx,corners,concrete,'#a39a84',unit*.65);
  // Broad soft shading: the facade catches more skyglow on its upper-right.
  const shade=ctx.createLinearGradient(a[0],0,b[0],0);
  shade.addColorStop(0,'rgba(20,16,12,.22)');shade.addColorStop(.5,'rgba(20,16,12,0)');shade.addColorStop(1,'rgba(255,235,200,.05)');
  polygon(ctx,corners,shade);
  // Stable mineral grain; this is drawn once per view/size, not per frame.
  ctx.save();polygon(ctx,corners);ctx.clip();
  for(let i=0;i<6500;i++) {
    const u=noise(i+3),v=noise(i+6600),[x,y]=p(u,v);
    ctx.fillStyle=i%2?'rgba(24,18,12,.09)':'rgba(236,222,190,.06)';
    ctx.fillRect(x,y,unit*(.5+noise(i)*1.5),unit*.8);
  }
  ctx.restore();
  for(let i=0;i<=10;i++) {
    const u=.064+i*.0872;
    line(ctx,[p(u,.013),p(u,.895)],'rgba(30,24,18,.34)',unit*.9);
    line(ctx,[p(u+.006,.015),p(u+.006,.895)],'rgba(230,214,178,.16)',unit*.7);
  }
  // Parapet, blank mechanical crown, recessed glazing, concrete sills.
  polygon(ctx,rect(p,0,0,1,.012),'#a09a86');
  // Two rows of dark mechanical louvres under the parapet.
  polygon(ctx,rect(p,.025,.015,.95,.055),'rgba(28,26,26,.35)');
  for(let i=0;i<COLS;i++)for(let r=0;r<2;r++)
    polygon(ctx,rect(p,.075+i*.0962,.020+r*.026,.078,.020),'#25272a');
  const windows=[];
  const colW=.866/COLS,rowH=.755/ROWS;
  for(let r=0;r<ROWS;r++)for(let col=0;col<COLS;col++) {
    const u=.067+col*colW,v=.088+r*rowH;
    const aperture=rect(p,u+.009,v+.004,colW-.020,rowH-.011);
    // Recessed bay in the concrete grid, then a pale aluminium frame, then glass.
    polygon(ctx,rect(p,u,v,colW-.002,rowH),'#5e574c');
    polygon(ctx,rect(p,u+.004,v+.001,colW-.009,rowH-.006),'#8f877a');
    polygon(ctx,rect(p,u+.007,v+.003,colW-.016,rowH-.009),'#3a3b3a');
    // Unlit glass is dark warm grey reflecting the hazy sky, never pure black.
    const [gx,gy]=p(u+.009,v+.004),[gx2,gy2]=p(u+.009,v+rowH-.007);
    const glass=ctx.createLinearGradient(gx,gy,gx2,gy2);
    glass.addColorStop(0,'#2b3037');glass.addColorStop(.5,'#1c2127');glass.addColorStop(1,'#14181d');
    polygon(ctx,aperture,glass);
    // Faint skyglow reflection on the upper glass; a central mullion splits each pane.
    polygon(ctx,rect(p,u+.011,v+.006,colW-.024,.006),'rgba(140,130,125,.16)');
    line(ctx,[p(u+colW/2-.001,v+.004),p(u+colW/2-.001,v+rowH-.007)],'#6c675d',unit*.9);
    line(ctx,[p(u+.009,v+rowH-.007),p(u+colW-.010,v+rowH-.007)],'#b0a58c',unit*.9);
    windows.push({points:aperture,index:(r*COLS+col)*3});
  }
  // Open ground-level colonnade, with glazed lobby set back behind the piers.
  polygon(ctx,rect(p,.07,.90,.86,.10),'#2a2a26');
  const [lx,ly]=p(.5,.91),[lx2,ly2]=p(.5,1);
  const lobby=ctx.createLinearGradient(lx,ly,lx2,ly2);
  lobby.addColorStop(0,'#c9b48e');lobby.addColorStop(.35,'#f2e3c4');lobby.addColorStop(1,'#d8c39c');
  for(let i=0;i<12;i++) {
    const u=.08+i*.07;
    polygon(ctx,rect(p,u,.914,.052,.075),i%4===3?'#6a6558':lobby);
    line(ctx,[p(u,.912),p(u,.99)],'#8f8770',unit*.8);
    if(i%4!==3)polygon(ctx,rect(p,u+.004,.925,.044,.03),'rgba(255,255,255,.35)');
  }
  for(let i=0;i<4;i++)polygon(ctx,rect(p,.02+i*.306,.89,.06,.11),'#8a8271');
  line(ctx,[p(0,1),p(1,1)],'#b3a688',unit*1.8);
  // Lobby light spills onto the plaza and washes the underside of the first floor.
  const [sx,sy]=p(.5,1);
  ctx.save();ctx.globalCompositeOperation='screen';
  glow(ctx,sx,sy,(b[0]-a[0])*.9,'255,220,170',.22);
  ctx.restore();
  // Rooftop: the big white radome at left, a smaller dish at right, a mast.
  const roof=p(.25,0),rad=(b[0]-a[0])*.083;
  { const r2=p(.80,0),rr=rad*.55;
    ctx.fillStyle='#3a3f42';ctx.fillRect(r2[0]-rr*.5,r2[1]-rr*.6,rr,rr*.7);
    const d2=ctx.createRadialGradient(r2[0]-rr*.3,r2[1]-rr*1.3,0,r2[0],r2[1]-rr*.9,rr*1.2);
    d2.addColorStop(0,'#cfd0c8');d2.addColorStop(1,'#6a7478');
    ctx.beginPath();ctx.arc(r2[0],r2[1]-rr*.95,rr,0,Math.PI*2);ctx.fillStyle=d2;ctx.fill(); }
  ctx.fillStyle='#343d41';ctx.fillRect(roof[0]-rad*.57,roof[1]-rad*.8,rad*1.14,rad*.9);
  const dome=ctx.createRadialGradient(roof[0]-rad*.3,roof[1]-rad*1.6,0,roof[0],roof[1]-rad,rad*1.25);
  dome.addColorStop(0,'#b8b9b0');dome.addColorStop(1,'#58666b');
  ctx.beginPath();ctx.arc(roof[0],roof[1]-rad*1.15,rad,0,Math.PI*2);ctx.fillStyle=dome;ctx.fill();
  for(const f of [-.55,0,.55]) {
    ctx.beginPath();ctx.ellipse(roof[0],roof[1]-rad*1.15,rad*(1-Math.abs(f)*.5),rad*.30, f*.6,0,Math.PI*2);
    ctx.strokeStyle='rgba(37,53,59,.27)';ctx.lineWidth=unit*.5;ctx.stroke();
  }
  const mast=p(.62,0);
  line(ctx,[mast,[mast[0],mast[1]-rad*2]],'#899490',unit*1.1);
  glow(ctx,mast[0],mast[1]-rad*2,unit*6,'255,88,65',.25);
  ctx.fillStyle='#ffc0a0';ctx.fillRect(mast[0]-unit*.8,mast[1]-rad*2,unit*1.6,unit*1.6);
  return windows;
}

function buildScene(ctx, W, H, mode, realistic=false, fit=false) {
  const river=mode==='river', close=mode==='close';
  const background=surface(ctx,W,H), structure=surface(ctx,W,H), live=surface(ctx,W,H);
  const bg=background.getContext('2d'), building=structure.getContext('2d');
  // Close view crops the lobby/plaza, preserving the full display and rooftop.
  const streetHeight=close ? Math.min(H,W*1.85) : Math.min(H*.78,W*1.70);
  const horizon=river ? (fit?H*.74:H*.68) : close ? H*.10+streetHeight : H*.90;
  sky(bg,W,H,horizon);campus(bg,W,H,horizon,river);
  let corners,sideQuad=null;
  if(river) {
    const bh=fit?Math.min(H*.56,W*.80):Math.min(H*.36,W*.80),bw=bh*.36;
    LAY={k:fit?.62:1, S:bh/(H*.36)};
    const x=W*.50-bw/2,y=horizon-bh;
    corners=[[x,y],[x+bw,y],[x+bw,horizon],[x,horizon]];
    sideQuad=null;
    const water=bg.createLinearGradient(0,horizon,0,H);
    // The Charles at night mirrors the warm haze near the far bank and goes
    // near-black toward the viewer's shore.
    water.addColorStop(0,'#4a3f38');water.addColorStop(.25,'#26231f');water.addColorStop(1,'#0b0c0e');
    bg.fillStyle=water;bg.fillRect(0,horizon,W,H-horizon);
    for(let i=0;i<1600;i++) {
      const y=horizon+noise(i+10)*(H-horizon),x=noise(i+800)*W;
      const depth=(y-horizon)/(H-horizon);
      bg.fillStyle=`rgba(190,160,125,${(.03+noise(i)*.08)*(1-depth*.7)})`;
      bg.fillRect(x,y,(2+noise(i+44)*22)*W/1200,Math.max(.5,H/1100));
    }
    for(let i=0;i<100;i++) {
      const x=noise(i+399)*W;
      glow(bg,x,horizon-2,Math.max(2,W*.003),'255,199,122',.25);
      bg.fillStyle='#c2a47e';bg.fillRect(x,horizon-2,Math.max(1,W/1300),1);
    }
    line(bg,[[0,horizon],[W,horizon]],'#1a1512',Math.max(2,H*.005));
    // Static reflection of the skyline and shore lights, drawn once per size.
    const skyline=surface(ctx,W,H), sk=skyline.getContext('2d');
    sk.save();sk.beginPath();sk.rect(0,horizon,W,H-horizon);sk.clip();
    sk.translate(0,horizon*2);sk.scale(1,-1);
    sk.filter=`blur(${Math.max(1.2,H/500)}px)`;
    sk.drawImage(background,0,0);
    sk.restore();
    const skFade=sk.createLinearGradient(0,horizon,0,H);
    skFade.addColorStop(0,'rgba(0,0,0,.42)');skFade.addColorStop(.35,'rgba(0,0,0,.12)');skFade.addColorStop(.8,'rgba(0,0,0,0)');
    sk.save();sk.globalCompositeOperation='destination-in';sk.fillStyle=skFade;sk.fillRect(0,0,W,H);sk.restore();
    bg.drawImage(skyline,0,0);
  } else {
    const bh=streetHeight,bw=bh*.43,x=W*.50-bw/2,y=horizon-bh;
    const taper=close?bw*.07:bw*.045;
    corners=[[x+taper,y],[x+bw-taper,y],[x+bw,horizon],[x,horizon]];
    sideQuad=null;
    const ground=bg.createLinearGradient(0,horizon,0,H);
    ground.addColorStop(0,'#4a4238');ground.addColorStop(.5,'#2e2b28');ground.addColorStop(1,'#15171c');
    bg.fillStyle=ground;bg.fillRect(0,horizon,W,H-horizon);
    // Paving: faint joint lines in perspective and a grainy surface.
    for(let i=0;i<7;i++) {
      const y=horizon+(H-horizon)*((i+1)/7)**1.7;
      line(bg,[[0,y],[W,y]],'rgba(120,110,95,.10)',Math.max(1,W/1600));
    }
    for(let i=0;i<2500;i++) {
      const y=horizon+noise(i+5)*(H-horizon),xg=noise(i+900)*W;
      bg.fillStyle=`rgba(${noise(i)>.5?'200,180,150':'20,16,12'},${.03+noise(i+3)*.06})`;
      bg.fillRect(xg,y,Math.max(1,W/900)*(1+noise(i+7)*3),Math.max(1,H/900));
    }
    // Lawn edge either side of the walkway to the lobby.
    for(const [x0,x1] of [[0,W*.32],[W*.68,W]]) {
      const lawn=bg.createLinearGradient(x0,0,x1,0);
      const inner=x0===0?1:0;
      lawn.addColorStop(inner,'rgba(40,52,30,0)');lawn.addColorStop(1-inner,'rgba(40,52,30,.5)');
      bg.fillStyle=lawn;bg.fillRect(x0,horizon+H*.02,x1-x0,H);
    }
    tree(bg,W*.10,horizon+H*.015,Math.min(H*.27,W*.27),11);
    tree(bg,W*.86,horizon+H*.018,Math.min(H*.23,W*.26),56);
    lamp(bg,x-bw*.14,horizon+H*.025,H*.085);
    lamp(bg,x+bw*1.24,horizon+H*.025,H*.085);
  }
  const windows=tower(building,corners,sideQuad,W,H);
  if(river)riverShore(building,W,H,horizon,realistic);
  LAY={k:1,S:1};
  return {W,H,mode,realistic,fit,background,structure,live,windows,horizon,corners,
    reflection: river ? surface(ctx,W,H) : null};
}

function lightWindow(ctx, {points,index}, frame) {
  const r=frame[index],g=frame[index+1],b=frame[index+2];
  const peak=Math.max(r,g,b)/255;
  if(!peak)return;
  const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
  const x=Math.min(...xs),y=Math.min(...ys),w=Math.max(...xs)-x,h=Math.max(...ys)-y;
  const cx=x+w/2,cy=y+h/2,col=`${r},${g},${b}`;
  // Colour spill onto the surrounding concrete and a wide soft bloom in the haze.
  ctx.save();ctx.globalCompositeOperation='screen';
  glow(ctx,cx,cy,Math.max(w,h)*2.1,col,.10*peak);
  glow(ctx,cx,cy,Math.max(w,h)*.95,col,.22*peak);
  ctx.restore();
  ctx.save();polygon(ctx,points);ctx.clip();
  // The 2026 modules light the whole pane almost evenly; a little falloff at
  // the edges and a slightly brighter core keep it from reading as a flat tile.
  ctx.fillStyle=rgba(r,g,b,.90);ctx.fillRect(x,y,w,h);
  const core=ctx.createRadialGradient(cx,cy,0,cx,cy,Math.max(w,h)*.7);
  core.addColorStop(0,rgba(Math.min(255,r+70),Math.min(255,g+70),Math.min(255,b+70),.55*peak));
  core.addColorStop(1,rgba(r,g,b,0));
  ctx.fillStyle=core;ctx.fillRect(x,y,w,h);
  const edge=ctx.createLinearGradient(x,y,x,y+h);
  edge.addColorStop(0,'rgba(0,0,0,.18)');edge.addColorStop(.25,'rgba(0,0,0,0)');
  edge.addColorStop(.8,'rgba(0,0,0,0)');edge.addColorStop(1,'rgba(0,0,0,.12)');
  ctx.fillStyle=edge;ctx.fillRect(x,y,w,h);
  // Central mullion and frame stay in front of the light.
  line(ctx,[[cx,y],[cx,y+h]],'rgba(20,20,18,.55)',Math.max(.7,w*.035));
  ctx.strokeStyle='rgba(15,14,12,.35)';ctx.lineWidth=Math.max(.6,w*.03);
  polygon(ctx,points,null,ctx.strokeStyle,ctx.lineWidth);
  ctx.restore();
}

function render(ctx, frame, W, H, mode, opts={}) {
  if(W<=0||H<=0)return;
  const realistic=!!opts.realistic, fit=!!opts.fit;
  let scene=scenes.get(ctx), rebuilt=false;
  if(!scene||scene.W!==W||scene.H!==H||scene.mode!==mode||scene.realistic!==realistic||scene.fit!==fit) {
    scene=buildScene(ctx,W,H,mode,realistic,fit);scenes.set(ctx,scene);rebuilt=true;
  }
  if(typeof window!=='undefined')window.__gbRender={mode,realistic,rebuilt,W,H,sceneMode:scene.mode,n:((window.__gbRender||{}).n||0)+1};
  const {background,structure,live,windows,horizon}=scene;
  const lctx=live.getContext('2d');
  lctx.clearRect(0,0,W,H);lctx.drawImage(structure,0,0);
  for(const window of windows)lightWindow(lctx,window,frame);
  ctx.clearRect(0,0,W,H);ctx.drawImage(background,0,0);ctx.drawImage(live,0,0);
  if(scene.reflection) {
    // Mirror one continuous image. Displacing separate scanlines creates a
    // sawtooth silhouette, especially at the bottom of a tall reflection.
    const reflection=scene.reflection, rctx=reflection.getContext('2d');
    rctx.clearRect(0,0,W,H);
    rctx.save();
    rctx.beginPath();rctx.rect(0,horizon,W,H-horizon);rctx.clip();
    rctx.translate(0,horizon*2);rctx.scale(1,-1);
    rctx.filter=`blur(${Math.max(.8,H/750)}px)`;
    rctx.drawImage(live,0,0);
    rctx.restore();
    // Fade out before the foreground so the reflection never ends abruptly.
    const fade=rctx.createLinearGradient(0,horizon,0,H);
    fade.addColorStop(0,'rgba(0,0,0,.30)');
    fade.addColorStop(.40,'rgba(0,0,0,.13)');
    fade.addColorStop(.90,'rgba(0,0,0,0)');
    fade.addColorStop(1,'rgba(0,0,0,0)');
    rctx.save();rctx.globalCompositeOperation='destination-in';
    rctx.fillStyle=fade;rctx.fillRect(0,0,W,H);rctx.restore();
    ctx.drawImage(reflection,0,0);
  }
  // Subtle photographic falloff keeps the eye on the tower.
  const vignette=ctx.createRadialGradient(W*.52,H*.48,H*.18,W*.5,H*.5,Math.max(W,H)*.78);
  vignette.addColorStop(0,'rgba(3,9,17,0)');vignette.addColorStop(1,'rgba(3,9,17,.48)');
  ctx.fillStyle=vignette;ctx.fillRect(0,0,W,H);
}
export function renderClose(ctx,frame,W,H,o){render(ctx,frame,W,H,'close',o);}
export function renderStreet(ctx,frame,W,H,o){render(ctx,frame,W,H,'street',o);}
export function renderRiver(ctx,frame,W,H,o){render(ctx,frame,W,H,'river',o);}

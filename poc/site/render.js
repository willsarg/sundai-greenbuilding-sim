// Architectural illustration of MIT Building 54, not a surveyed model.
// Facade reference: https://hacks.mit.edu/by_year/2012/tetris/tetris1_img6080.jpg
// River composition reference: https://www.gettyimages.com/detail/photo/2170429289
// Photos are references only; all scene artwork is drawn procedurally.
// 2026 installation context: https://www.anhadsawhney.com/green-building-tetris
// The historical photo informs architecture only. All 153 display windows below
// are driven solely by the incoming 2026 17x9, top-to-bottom RGB frame.
export const ROWS = 17, COLS = 9;
const scenes = new WeakMap();
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
       [.72,.07,.11],[.775,.06,.135],[.83,.05,.10],[.87,.09,.085],[.94,.10,.07]]
    : [[-.03,.28,.23],[.23,.14,.12],[.74,.30,.18]];
  for (const [x,w,h] of buildings) {
    const bx=x*W, by=horizon-h*H, bw=w*W, bh=h*H;
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
  if(river) {
    // Great Dome: shallow limestone cap, curved masonry courses, a recessed
    // drum, and the columned facade below. An illustration at skyline scale.
    const x=W*.10,y=horizon-H*.052,r=Math.min(H*.026,W*.033);
    const hair=Math.max(.45,H/1500), rx=r*1.40, ry=r*.80;
    const stone=ctx.createLinearGradient(x-r*1.8,0,x+r*1.8,0);
    stone.addColorStop(0,'#555f61');stone.addColorStop(.32,'#8c8d7e');
    stone.addColorStop(.68,'#72796f');stone.addColorStop(1,'#414f55');
    ctx.fillStyle=stone;ctx.fillRect(x-r*1.72,y,r*3.44,H*.052);

    // Shadowed bays behind the pale columns, with warm recessed windows.
    ctx.fillStyle='#273840';ctx.fillRect(x-r*1.48,y+r*.43,r*2.96,r*.91);
    for(let i=0;i<10;i++) {
      const bx=x-r*1.40+i*r*.295;
      ctx.fillStyle=i%3===0?'#968c70':'#45534f';
      ctx.fillRect(bx+r*.10,y+r*.69,r*.10,r*.40);
      line(ctx,[[bx+r*.15,y+r*.69],[bx+r*.15,y+r*1.09]],'#24383f',hair);
      const column=ctx.createLinearGradient(bx,0,bx+r*.12,0);
      column.addColorStop(0,'#505f60');column.addColorStop(.35,'#b0aa91');
      column.addColorStop(1,'#738077');
      ctx.fillStyle=column;ctx.fillRect(bx,y+r*.50,r*.12,r*.75);
      ctx.fillStyle='#a19f89';ctx.fillRect(bx-r*.025,y+r*.46,r*.17,r*.065);
      ctx.fillStyle='#8b917f';ctx.fillRect(bx-r*.025,y+r*1.24,r*.17,r*.055);
    }
    for(let i=0;i<3;i++) {
      ctx.fillStyle=i===1?'#9a9a85':'#626f69';
      ctx.fillRect(x-r*(1.75+i*.045),y+r*(1.32+i*.055),r*(3.50+i*.09),r*.055);
    }

    // Cylindrical drum: a curved upper rim and narrow inset panels.
    ctx.fillStyle=stone;ctx.fillRect(x-r*1.39,y-r*.025,r*2.78,r*.38);
    ctx.beginPath();ctx.ellipse(x,y+r*.34,r*1.39,r*.09,0,0,Math.PI);
    ctx.fillStyle='#4d5d5f';ctx.fill();
    for(let i=-7;i<=7;i++) {
      const angle=i/8*Math.PI/2, bx=x+Math.sin(angle)*r*1.33;
      const width=Math.max(hair,Math.cos(angle)*r*.063);
      ctx.fillStyle='#3d5056';ctx.fillRect(bx-width/2,y+r*.07,width,r*.14);
      line(ctx,[[bx+width,y+r*.045],[bx+width,y+r*.265]],'rgba(193,188,160,.30)',hair);
    }
    // Deep cornice bands separate the cap, drum, and colonnade.
    for(const [yy,ww,hh,color] of [[-.025,1.47,.07,'#aaa793'],[.31,1.48,.045,'#a19f8b'],
      [.36,1.62,.065,'#4a5a5d'],[.425,1.68,.055,'#a3a18b']]) {
      ctx.fillStyle=color;ctx.fillRect(x-r*ww,y+r*yy,r*ww*2,r*hh);
    }

    const dome=ctx.createRadialGradient(x-r*.44,y-r*.71,r*.04,x+r*.25,y+r*.1,r*1.70);
    dome.addColorStop(0,'#b2b2a0');dome.addColorStop(.40,'#969e93');
    dome.addColorStop(.76,'#707e7c');dome.addColorStop(1,'#455b66');
    ctx.save();
    ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,Math.PI,0);ctx.closePath();
    ctx.fillStyle=dome;ctx.fill();ctx.clip();
    // Stone courses follow the curvature instead of cutting straight stripes.
    for(let i=1;i<=7;i++) {
      const t=i/8, yy=y-ry*(1-t), half=rx*Math.sqrt(1-(1-t)**2);
      ctx.beginPath();ctx.ellipse(x,yy,half,r*.065*t,0,0,Math.PI);
      ctx.strokeStyle='rgba(41,60,66,.29)';ctx.lineWidth=hair;ctx.stroke();
      // Staggered masonry joints, small enough to remain texture at a distance.
      for(let j=-5;j<=5;j++) {
        const xx=x+(j+(i%2)*.5)*r*.22;
        if(Math.abs(xx-x)<half-r*.08)
          line(ctx,[[xx,yy-r*.06],[xx+r*.016,yy+r*.005]],'rgba(55,72,75,.19)',hair*.75);
      }
    }
    ctx.restore();
    ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,Math.PI,0);
    ctx.strokeStyle='rgba(210,210,185,.35)';ctx.lineWidth=hair;ctx.stroke();
    // Low crown/oculus rather than a pointed or lantern-shaped roof.
    ctx.fillStyle='#a8aea0';ctx.beginPath();ctx.ellipse(x,y-ry+r*.019,r*.16,r*.035,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#607577';ctx.beginPath();ctx.ellipse(x,y-ry+r*.012,r*.10,r*.015,0,0,Math.PI*2);ctx.fill();
  }
}

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

function riverShore(ctx, W, H, horizon) {
  // A continuous canopy, with a retaining wall and sailing pavilion at the water.
  for(let i=0;i<110;i++) {
    const x=W*i/109, h=H*(.036+noise(i+810)*.024);
    tree(ctx,x,horizon-H*.004,h,900+i*31);
  }
  ctx.fillStyle='#4c5553';ctx.fillRect(0,horizon-H*.010,W,H*.010);
  line(ctx,[[0,horizon-H*.011],[W,horizon-H*.011]],'#788078',Math.max(.8,H/850));
  const px=W*.44, py=horizon-H*.010, pw=Math.min(W*.075,H*.12), ph=H*.022;
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
    const x=W*(.22+i*.0075),h=H*(.016+noise(i+9)*.014);
    line(ctx,[[x,horizon],[x,horizon-h]],'#7b8582',Math.max(.5,W/2200));
    polygon(ctx,[[x,horizon-h*.7],[x+W*.003,horizon-H*.004],[x-W*.002,horizon-H*.004]],
      i%3?'#957569':'#aaa898');
  }
}

function tower(ctx, corners, sideWidth, W, H) {
  const p=elevation(corners), [a,b,c,d]=corners;
  const unit=Math.max(.6,H/900);
  // East face, seen from the Esplanade as a lighter strip right of the grid.
  const side=[ b,[b[0]+sideWidth,b[1]+sideWidth*.18],[c[0]+sideWidth,c[1]-.004*H],c ];
  const sp=elevation(side);
  const sg=ctx.createLinearGradient(b[0],0,b[0]+sideWidth,0);
  sg.addColorStop(0,'#8a7f6c');sg.addColorStop(.6,'#9a8f7b');sg.addColorStop(1,'#6e665a');
  if (sideWidth > 0) polygon(ctx,side,sg);
  // Blank concrete end wall with a few narrow slit windows; nothing lit.
  for(let i=1;sideWidth > 0 && i<4;i++) {
    line(ctx,[sp(i/4,0),sp(i/4,1)],'rgba(40,32,24,.30)',unit*.9);
    for(let r=0;r<17;r++)polygon(ctx,rect(sp,i/4-.05,.09+r*.045,.04,.022),'#2a2c2c');
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

function buildScene(ctx, W, H, mode) {
  const river=mode==='river'||mode==='riverAngle', angled=mode==='riverAngle', close=mode==='close';
  const background=surface(ctx,W,H), structure=surface(ctx,W,H), live=surface(ctx,W,H);
  const bg=background.getContext('2d'), building=structure.getContext('2d');
  // Close view crops the lobby/plaza, preserving the full display and rooftop.
  const streetHeight=close ? Math.min(H,W*1.85) : Math.min(H*.78,W*1.70);
  const horizon=river ? H*.68 : close ? H*.10+streetHeight : H*.90;
  sky(bg,W,H,horizon);campus(bg,W,H,horizon,river);
  let corners,sideWidth;
  if(river) {
    const bh=Math.min(H*.36,W*.80),bw=bh*.36,x=W*.50-bw/2,y=horizon-bh;
    corners=[[x,y],[x+bw,y],[x+bw,horizon],[x,horizon]];
    sideWidth=angled?bw*.28:0;
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
    sideWidth=0;
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
    lamp(bg,x-sideWidth-bw*.14,horizon+H*.025,H*.085);
    lamp(bg,x+bw*1.24,horizon+H*.025,H*.085);
  }
  const windows=tower(building,corners,sideWidth,W,H);
  if(river)riverShore(building,W,H,horizon);
  return {W,H,mode,background,structure,live,windows,horizon,corners,
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

function render(ctx, frame, W, H, mode) {
  if(W<=0||H<=0)return;
  let scene=scenes.get(ctx);
  if(!scene||scene.W!==W||scene.H!==H||scene.mode!==mode) {
    scene=buildScene(ctx,W,H,mode);scenes.set(ctx,scene);
  }
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
export function renderClose(ctx,frame,W,H){render(ctx,frame,W,H,'close');}
export function renderStreet(ctx,frame,W,H){render(ctx,frame,W,H,'street');}
export function renderRiver(ctx,frame,W,H){render(ctx,frame,W,H,'river');}
export function renderRiverAngle(ctx,frame,W,H){render(ctx,frame,W,H,'riverAngle');}

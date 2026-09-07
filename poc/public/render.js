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
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#080f20'); g.addColorStop(.48, '#1c2a3e');
  g.addColorStop(.82, '#41424a'); g.addColorStop(1, '#69605a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  glow(ctx, W*.76, horizon, W*.65, '192,139,88', .13);
  // Long, faint cloud banks rather than a uniformly star-filled sky.
  for (let i=0; i<18; i++) {
    ctx.save(); ctx.translate(W*noise(i+2), H*(.08+noise(i+19)*.55));
    ctx.scale(5, .35);
    glow(ctx, 0, 0, W*(.06+noise(i+4)*.08), '124,145,164', .022);
    ctx.restore();
  }
  // A fixed star field: resizing is stable and incoming frames never make it flicker.
  const starScale = Math.max(.8, Math.min(W, H) / 750);
  for (let i=0; i<210; i++) {
    const x=noise(i+70)*W, y=noise(i+140)*horizon*.90;
    const bright=noise(i+44), fade=1-.65*(y/horizon)**2;
    const radius=(bright>.94?1.45:bright>.65?.85:.48)*starScale;
    const tint=i%7===0?'255,225,185':'207,225,255';
    if(bright>.94)glow(ctx,x,y,6*starScale,tint,.20*fade);
    ctx.fillStyle=`rgba(${tint},${(.30+bright*.65)*fade})`;
    ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.fill();
    if(bright>.985) {
      line(ctx,[[x-3*starScale,y],[x+3*starScale,y]],`rgba(${tint},${.22*fade})`,starScale*.6);
      line(ctx,[[x,y-3*starScale],[x,y+3*starScale]],`rgba(${tint},${.22*fade})`,starScale*.6);
    }
  }
}

function campus(ctx, W, H, horizon, river) {
  const buildings = river
    ? [[-.02,.19,.08],[.17,.18,.105],[.35,.15,.115],[.50,.20,.09],[.76,.12,.13],[.88,.14,.16]]
    : [[-.03,.28,.23],[.23,.14,.12],[.74,.30,.18]];
  for (const [x,w,h] of buildings) {
    const bx=x*W, by=horizon-h*H, bw=w*W, bh=h*H;
    ctx.fillStyle=river?(x>.75?'#343036':'#3e4244'):'#232b30'; ctx.fillRect(bx,by,bw,bh);
    ctx.fillStyle='#3b4246';ctx.fillRect(bx,by,bw,Math.max(1,H*.003));
    const spacing=Math.max(5, H*(river?.009:.016));
    for(let yy=by+spacing; yy<horizon-spacing; yy+=spacing*1.65) {
      line(ctx,[[bx,yy+spacing],[bx+bw,yy+spacing]],'#111c24',Math.max(1,spacing*.22));
      for(let xx=bx+spacing;xx<bx+bw-spacing;xx+=spacing*1.1) {
        const n=noise(xx+yy);
        ctx.fillStyle=n>.73?`rgba(228,193,137,${.12+n*.32})`:'#121e27';
        ctx.fillRect(xx,yy,spacing*.53,spacing*.72);
      }
    }
  }
  if(river) {
    // Great Dome at the left of the river panorama, above the lower campus.
    const x=W*.225,y=horizon-H*.113,r=Math.min(H*.044,W*.055);
    ctx.fillStyle='#555950';ctx.fillRect(x-r*1.7,y,r*3.4,H*.113);
    ctx.fillStyle='#858578';ctx.fillRect(x-r*1.9,y-r*.05,r*3.8,r*.12);
    const dome=ctx.createLinearGradient(0,y-r,0,y);
    dome.addColorStop(0,'#92958b');dome.addColorStop(1,'#525d60');
    ctx.beginPath();ctx.ellipse(x,y,r*1.4,r*.80,0,Math.PI,0);
    ctx.fillStyle=dome;ctx.fill();
    for(let i=0;i<3;i++)line(ctx,[[x-r*1.32,y-r*(.09+i*.15)],[x+r*1.32,y-r*(.09+i*.15)]],'rgba(30,43,49,.22)',Math.max(.6,H/1000));
    for(let i=-4;i<=4;i++) {
      ctx.fillStyle='#888a7d';ctx.fillRect(x+i*r*.33,y+r*.18,r*.12,r*.65);
      ctx.fillStyle='#232f35';ctx.fillRect(x+i*r*.33+r*.13,y+r*.2,r*.15,r*.62);
    }
    // Rooftop utility blocks and the narrow chimney break up the roofline.
    ctx.fillStyle='#62625a';ctx.fillRect(W*.33,horizon-H*.14,W*.009,H*.05);
    for(let i=0;i<13;i++) {
      const x=W*(.36+i*.027),y=horizon-H*(.112+noise(i+15)*.013);
      ctx.fillStyle='#4c5559';ctx.fillRect(x,y,W*.009,H*.018);
    }
  }
}

function tree(ctx, x, y, size, seed) {
  line(ctx,[[x,y],[x-size*.04,y-size*.64]],'#111d21',size*.045);
  for(let i=0;i<28;i++) {
    const dx=(noise(seed+i)-.5)*size, dy=noise(seed+i+50)*size*.58;
    ctx.fillStyle=i%3?'#142225':'#192a2a';
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
  for(let i=0;i<75;i++) {
    const x=W*i/74, h=H*(.037+noise(i+810)*.025);
    tree(ctx,x,horizon-H*.006,h,900+i*31);
  }
  ctx.fillStyle='#4c5553';ctx.fillRect(0,horizon-H*.010,W,H*.010);
  line(ctx,[[0,horizon-H*.011],[W,horizon-H*.011]],'#788078',Math.max(.8,H/850));
  const px=W*.39, py=horizon-H*.013, pw=Math.min(W*.085,H*.14), ph=H*.025;
  ctx.fillStyle='#7c8178';ctx.fillRect(px,py-ph,pw,ph);
  polygon(ctx,[[px-pw*.08,py-ph],[px+pw*.18,py-ph*1.6],[px+pw*.39,py-ph],
    [px+pw*.65,py-ph*1.6],[px+pw*1.08,py-ph]],'#b1b1a0');
  for(let i=0;i<5;i++) {
    ctx.fillStyle=i%2?'#2b3d45':'#af9f7b';
    ctx.fillRect(px+pw*(.08+i*.18),py-ph*.75,pw*.10,ph*.62);
  }
  line(ctx,[[px-pw*.4,py+H*.005],[px+pw*1.3,py+H*.005]],'#8b8979',Math.max(1,H*.002));
  // Small dockside masts and furled boats, subordinate to the live display.
  for(let i=0;i<20;i++) {
    const x=W*(.08+i*.014),h=H*(.017+noise(i+9)*.012);
    line(ctx,[[x,horizon],[x,horizon-h]],'#7b8582',Math.max(.5,W/2200));
    polygon(ctx,[[x,horizon-h*.7],[x+W*.003,horizon-H*.004],[x-W*.002,horizon-H*.004]],
      i%3?'#957569':'#aaa898');
  }
}

function tower(ctx, corners, sideWidth, W, H) {
  const p=elevation(corners), [a,b,c,d]=corners;
  const unit=Math.max(.6,H/900);
  const side=[ [a[0]-sideWidth*.62,a[1]+sideWidth*.50], a,d,[d[0]-sideWidth,d[1]-.01*H] ];
  const sp=elevation(side);
  const sg=ctx.createLinearGradient(side[0][0],0,a[0],0);
  sg.addColorStop(0,'#282e31');sg.addColorStop(.8,'#424647');sg.addColorStop(1,'#54524c');
  if (sideWidth > 0) polygon(ctx,side,sg);
  // Deeply scored side elevation and narrow, unlit side windows.
  for(let i=1;sideWidth > 0 && i<9;i++) {
    line(ctx,[sp(i/9,0),sp(i/9,1)],'rgba(12,20,25,.45)',unit*1.1);
    for(let r=0;r<19;r++)polygon(ctx,rect(sp,i/9-.036,.09+r*.041,.047,.026),'#1b282e');
  }
  const concrete=ctx.createLinearGradient(a[0],a[1],c[0],c[1]);
  concrete.addColorStop(0,'#535753');concrete.addColorStop(.5,'#64645a');concrete.addColorStop(1,'#817563');
  polygon(ctx,corners,concrete,'#8e8975',unit*.65);
  // Stable mineral grain; this is drawn once per view/size, not per frame.
  ctx.save();polygon(ctx,corners);ctx.clip();
  for(let i=0;i<6500;i++) {
    const u=noise(i+3),v=noise(i+6600),[x,y]=p(u,v);
    ctx.fillStyle=i%2?'rgba(12,19,22,.08)':'rgba(223,213,180,.055)';
    ctx.fillRect(x,y,unit*(.5+noise(i)*1.5),unit*.8);
  }
  ctx.restore();
  for(let i=0;i<=10;i++) {
    const u=.064+i*.0872;
    line(ctx,[p(u,.013),p(u,.895)],'rgba(26,32,32,.28)',unit*.8);
    line(ctx,[p(u+.006,.015),p(u+.006,.895)],'rgba(211,200,166,.13)',unit*.7);
  }
  // Parapet, blank mechanical crown, recessed glazing, concrete sills.
  polygon(ctx,rect(p,0,0,1,.012),'#929080');
  polygon(ctx,rect(p,.025,.015,.95,.055),'rgba(34,41,41,.19)');
  const windows=[];
  const colW=.866/COLS,rowH=.755/ROWS;
  for(let r=0;r<ROWS;r++)for(let col=0;col<COLS;col++) {
    const u=.067+col*colW,v=.088+r*rowH;
    const aperture=rect(p,u+.009,v+.004,colW-.020,rowH-.011);
    polygon(ctx,rect(p,u,v,colW-.002,rowH),'#55574f');
    polygon(ctx,rect(p,u+.005,v+.001,colW-.010,rowH-.006),'#272f30');
    polygon(ctx,aperture,'#0c1821');
    line(ctx,[p(u+.009,v+rowH-.007),p(u+colW-.010,v+rowH-.007)],'#a09174',unit*.9);
    line(ctx,[p(u+colW-.010,v+.004),p(u+colW-.010,v+rowH-.007)],'#747364',unit*.85);
    // A cool reflection remains visible in black windows; never invent lit pixels.
    polygon(ctx,rect(p,u+.012,v+.006,colW-.026,.004),'rgba(100,131,145,.09)');
    windows.push({points:aperture,index:(r*COLS+col)*3});
  }
  // Open ground-level colonnade, with glazed lobby set back behind the piers.
  polygon(ctx,rect(p,.07,.90,.86,.10),'#17252b');
  for(let i=0;i<12;i++) {
    const u=.08+i*.07;
    polygon(ctx,rect(p,u,.914,.049,.075),i%3?'#394745':'#797968');
    line(ctx,[p(u,.912),p(u,.99)],'#a69e82',unit*.7);
  }
  for(let i=0;i<4;i++)polygon(ctx,rect(p,.02+i*.306,.89,.06,.11),'#746e5d');
  line(ctx,[p(0,1),p(1,1)],'#a0947a',unit*1.8);
  // Rooftop radome with panel seams and a small warning beacon.
  const roof=p(.25,0),rad=(b[0]-a[0])*.083;
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
  const river=mode==='river', close=mode==='close';
  const background=surface(ctx,W,H), structure=surface(ctx,W,H), live=surface(ctx,W,H);
  const bg=background.getContext('2d'), building=structure.getContext('2d');
  // Close view crops the lobby/plaza, preserving the full display and rooftop.
  const streetHeight=close ? Math.min(H,W*1.85) : Math.min(H*.78,W*1.70);
  const horizon=river ? H*.65 : close ? H*.10+streetHeight : H*.90;
  sky(bg,W,H,horizon);campus(bg,W,H,horizon,river);
  let corners,sideWidth;
  if(river) {
    const bh=Math.min(H*.43,W*.95),bw=bh*.40,x=W*.50-bw/2,y=horizon-bh;
    corners=[[x,y],[x+bw,y],[x+bw,horizon],[x,horizon]];
    sideWidth=0;
    const water=bg.createLinearGradient(0,horizon,0,H);
    water.addColorStop(0,'#283844');water.addColorStop(.3,'#142734');water.addColorStop(1,'#0a1826');
    bg.fillStyle=water;bg.fillRect(0,horizon,W,H-horizon);
    for(let i=0;i<1600;i++) {
      const y=horizon+noise(i+10)*(H-horizon),x=noise(i+800)*W;
      bg.fillStyle=`rgba(133,155,165,${.025+noise(i)*.07})`;
      bg.fillRect(x,y,(2+noise(i+44)*22)*W/1200,Math.max(.5,H/1100));
    }
    for(let i=0;i<100;i++) {
      const x=noise(i+399)*W;
      glow(bg,x,horizon-2,Math.max(2,W*.003),'255,199,122',.25);
      bg.fillStyle='#c2a47e';bg.fillRect(x,horizon-2,Math.max(1,W/1300),1);
    }
    line(bg,[[0,horizon],[W,horizon]],'#101e28',Math.max(2,H*.005));
  } else {
    const bh=streetHeight,bw=bh*.43,x=W*.50-bw/2,y=horizon-bh;
    corners=[[x,y],[x+bw,y],[x+bw,horizon],[x,horizon]];
    sideWidth=0;
    const ground=bg.createLinearGradient(0,horizon,0,H);
    ground.addColorStop(0,'#343b3a');ground.addColorStop(1,'#131f28');
    bg.fillStyle=ground;bg.fillRect(0,horizon,W,H-horizon);
    for(let i=-8;i<=8;i++)line(bg,[[W*.52+i*W*.035,horizon],[W*.52+i*W*.19,H]],'rgba(149,152,138,.13)',Math.max(1,W/1500));
    for(let i=0;i<5;i++) {
      const y=horizon+(H-horizon)*(i/5)**1.8;
      line(bg,[[0,y],[W,y]],'rgba(145,153,146,.13)',Math.max(1,W/1500));
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
  const cx=x+w/2,cy=y+h*.65;
  // Restrained exterior spill; saturated blue remains visible as well as green.
  ctx.save();ctx.globalCompositeOperation='screen';
  glow(ctx,cx,cy,Math.max(w,h)*1.2,`${r},${g},${b}`,.20*peak);
  ctx.restore();
  ctx.save();polygon(ctx,points);ctx.clip();
  const interior=ctx.createLinearGradient(x,y,x,y+h);
  interior.addColorStop(0,rgba(r,g,b,.38));
  interior.addColorStop(.55,rgba(r,g,b,.65));
  interior.addColorStop(1,rgba(r,g,b,.96));
  ctx.fillStyle=interior;ctx.fillRect(x,y,w,h);
  // Grazing light reveals the jambs and sill, with the source near the floor.
  ctx.strokeStyle=rgba(r,g,b,.95);ctx.lineWidth=Math.max(.65,w*.08);
  polygon(ctx,points,null,ctx.strokeStyle,ctx.lineWidth);
  glow(ctx,cx,y+h*.87,w*.56,`${r},${g},${b}`,.80*peak);
  const highlight=rgba(Math.min(255,r+35),Math.min(255,g+35),Math.min(255,b+35),peak*.45);
  line(ctx,[[x+w*.12,y+h*.89],[x+w*.88,y+h*.89]],highlight,Math.max(.6,h*.025));
  line(ctx,[[x+w*.50,y],[x+w*.50,y+h]],'rgba(9,16,22,.25)',Math.max(.5,w*.025));
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
  if(mode==='river') {
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

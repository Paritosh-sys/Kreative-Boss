(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  const page = document.documentElement;
  const world = document.querySelector('#signature-world');
  const canvas = document.querySelector('#world-canvas');
  const cursor = document.querySelector('.custom-cursor');
  const header = document.querySelector('.site-header');
  const menuButton = document.querySelector('.menu-toggle');
  const mobileNav = document.querySelector('.mobile-nav');
  const chapters = [...document.querySelectorAll('[data-scene]')];
  const readingLine = document.querySelector('.reading-line span');
  const contactEmail = 'surajpalchd82@gmail.com';
  let pageFrame = 0;

  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
  const mix = (a, b, t) => a + (b - a) * t;

  // Page-wide cursor gives each interactive element a short, useful verb.
  if (finePointer && !reducedMotion) {
    let cursorFrame = 0;
    window.addEventListener('pointermove', event => {
      if (cursorFrame) return;
      cursorFrame = requestAnimationFrame(() => {
        cursor.style.transform = `translate3d(${event.clientX}px,${event.clientY}px,0) translate(-50%,-50%)`;
        cursor.classList.add('is-visible');
        cursorFrame = 0;
      });
      const target = event.target instanceof Element ? event.target.closest('[data-cursor-label]') : null;
      const label = target?.dataset.cursorLabel || '';
      cursor.dataset.label = label;
      cursor.classList.toggle('has-label', Boolean(label));
    }, { passive: true });
    document.addEventListener('pointerleave', () => cursor.classList.remove('is-visible'));
    document.querySelectorAll('button,a,[data-cursor-label]').forEach(el => {
      el.addEventListener('pointerenter', () => {
        if (el.dataset.cursorLabel) {
          cursor.dataset.label = el.dataset.cursorLabel;
          cursor.classList.add('has-label');
        }
      });
      el.addEventListener('pointerleave', () => {
        if (el.dataset.cursorLabel) cursor.classList.remove('has-label');
      });
    });
  }

  function closeMenu() {
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', 'Open navigation');
    mobileNav.classList.remove('open');
    mobileNav.setAttribute('inert', '');
    document.body.classList.remove('menu-open');
  }
  menuButton.addEventListener('click', () => {
    const open = menuButton.getAttribute('aria-expanded') !== 'true';
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    mobileNav.classList.toggle('open', open);
    mobileNav.toggleAttribute('inert', !open);
    document.body.classList.toggle('menu-open', open);
  });
  mobileNav.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });

  // Reveal panels for orientation; the main motion is tied to the scroll position below.
  const revealObserver = new IntersectionObserver((entries, observer) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  }, { threshold: .12, rootMargin: '0px 0px -35px 0px' });
  document.querySelectorAll('.reveal,.project-card').forEach(el => revealObserver.observe(el));

  // A ray-marched signed-distance sculpture: genuine depth, metal highlights and a glass-like core.
  const vertexSource = `
    attribute vec2 a_position;
    varying vec2 v_uv;
    void main(){ v_uv=a_position*.5+.5; gl_Position=vec4(a_position,0.0,1.0); }
  `;
  const fragmentSource = `
    precision highp float;
    varying vec2 v_uv;
    uniform vec2 u_resolution;
    uniform vec2 u_pointer;
    uniform float u_scroll;
    uniform float u_scene;
    uniform float u_time;
    vec2 r2(float a){ return vec2(cos(a),sin(a)); }
    vec3 turnX(vec3 p,float a){ vec2 c=r2(a); return vec3(p.x,c.x*p.y-c.y*p.z,c.y*p.y+c.x*p.z); }
    vec3 turnY(vec3 p,float a){ vec2 c=r2(a); return vec3(c.x*p.x+c.y*p.z,p.y,-c.y*p.x+c.x*p.z); }
    vec3 turnZ(vec3 p,float a){ vec2 c=r2(a); return vec3(c.x*p.x-c.y*p.y,c.y*p.x+c.x*p.y,p.z); }
    float sdSphere(vec3 p,float s){ return length(p)-s; }
    float sdTorus(vec3 p,vec2 t){ return length(vec2(length(p.xz)-t.x,p.y))-t.y; }
    float smin(float a,float b,float k){ float h=clamp(.5+.5*(b-a)/k,0.0,1.0); return mix(b,a,h)-k*h*(1.0-h); }
    float mapScene(vec3 p){
      float phase=clamp(u_scene,0.0,1.0);
      p=turnY(p,u_pointer.x*.62+u_scroll*2.15+(phase-.5)*.24);
      p=turnX(p,u_pointer.y*.48+sin(u_scroll*3.14159)*.14);
      p=turnZ(p,phase*.48);
      p*=1.0-.12*phase;
      float radius=mix(.57,.39,phase);
      float tube=mix(.071,.09,sin(phase*3.14159));
      float a=sdTorus(p,vec2(radius,tube));
      vec3 q=turnX(turnZ(p,1.04),1.11);
      float b=sdTorus(q,vec2(radius*.82,tube*.82));
      vec3 r=turnY(turnX(p,.72),-.86);
      float c=sdTorus(r,vec2(radius*.75,tube*.72));
      float weave=smin(smin(a,b,.11),c,.095);
      float core=sdSphere(p,.235+.02*cos(phase*6.283));
      return smin(weave,core,.11);
    }
    vec3 normalAt(vec3 p){ vec2 e=vec2(.0017,0.0); return normalize(vec3(mapScene(p+e.xyy)-mapScene(p-e.xyy),mapScene(p+e.yxy)-mapScene(p-e.yxy),mapScene(p+e.yyx)-mapScene(p-e.yyx))); }
    void main(){
      vec2 uv=(v_uv-.5)*vec2(u_resolution.x/u_resolution.y,1.0);
      uv*=2.22;
      if(dot(uv,uv)>1.15){ gl_FragColor=vec4(0.0); return; }
      vec3 ro=vec3(0.0,0.0,3.45);
      vec3 rd=normalize(vec3(uv,-1.72));
      float travel=0.0; float dist=0.0; bool hit=false; vec3 p=ro;
      for(int i=0;i<64;i++){ p=ro+rd*travel; dist=mapScene(p); if(dist<.0015){hit=true;break;} if(travel>5.5)break; travel+=max(dist*.82,.006); }
      if(!hit){ gl_FragColor=vec4(0.0); return; }
      vec3 n=normalAt(p); vec3 view=normalize(ro-p);
      vec3 lightA=normalize(vec3(-.58,.72,.83)); vec3 lightB=normalize(vec3(.8,-.33,.4));
      float diff=max(dot(n,lightA),0.0); float rim=pow(1.0-max(dot(n,view),0.0),2.1);
      float spec=pow(max(dot(reflect(-lightA,n),view),0.0),54.0);
      float glint=pow(max(dot(reflect(-lightB,n),view),0.0),92.0);
      float phase=clamp(u_scene,0.0,1.0);
      vec3 gold=vec3(.63,.43,.20); vec3 blue=vec3(.25,.38,.57);
      vec3 metal=mix(gold,blue,smoothstep(.23,.91,phase)*.52);
      float band=.5+.5*sin((p.x*4.2+p.y*3.8+u_time*.18)+phase*4.0);
      vec3 color=metal*(.2+diff*.78)+vec3(.91,.82,.64)*spec*.92+vec3(.7,.81,.98)*glint*.56+mix(vec3(.34,.25,.13),vec3(.18,.31,.48),phase)*rim*.9;
      color+=vec3(.15,.12,.08)*band*.1;
      gl_FragColor=vec4(color,1.0);
    }
  `;

  let gl = null, program = null, uniforms = {}, canvasWidth = 0, canvasHeight = 0, pixelRatio = 1;
  const sculptState = { pointerX: 0, pointerY: 0, targetX: 0, targetY: 0, scroll: 0, scene: 0, time: 0 };
  let drawFrame = 0, dragging = false, lastDragX = 0, lastDragY = 0;
  function compileShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || 'Shader compile failed');
    return shader;
  }
  function initSculpture() {
    try {
      gl = canvas.getContext('webgl', { alpha: true, antialias: true, powerPreference: 'low-power', premultipliedAlpha: true });
      if (!gl) throw new Error('WebGL unavailable');
      program = gl.createProgram();
      gl.attachShader(program, compileShader(gl.VERTEX_SHADER, vertexSource));
      gl.attachShader(program, compileShader(gl.FRAGMENT_SHADER, fragmentSource));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || 'Program link failed');
      gl.useProgram(program);
      const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,3,-1,-1,3]), gl.STATIC_DRAW);
      const position = gl.getAttribLocation(program, 'a_position');
      gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      ['u_resolution','u_pointer','u_scroll','u_scene','u_time'].forEach(name => { uniforms[name] = gl.getUniformLocation(program, name); });
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      resizeSculpture(); scheduleDraw();
    } catch {
      gl = null;
      program = null;
      world.classList.add('webgl-fallback');
      resizeSculpture();
    }
  }
  function resizeSculpture() {
    const box = canvas.getBoundingClientRect();
    pixelRatio = Math.min(window.devicePixelRatio || 1, window.matchMedia('(max-width:740px)').matches ? .76 : .88);
    canvasWidth = Math.max(1, Math.round(box.width * pixelRatio)); canvasHeight = Math.max(1, Math.round(box.height * pixelRatio));
    if (canvas.width !== canvasWidth || canvas.height !== canvasHeight) { canvas.width = canvasWidth; canvas.height = canvasHeight; }
    if (gl) gl.viewport(0, 0, canvasWidth, canvasHeight);
    scheduleDraw();
  }
  function drawSculpture(timestamp = 0) {
    drawFrame = 0;
    if (!gl || document.hidden) return;
    sculptState.pointerX = reducedMotion ? sculptState.targetX : mix(sculptState.pointerX, sculptState.targetX, .36);
    sculptState.pointerY = reducedMotion ? sculptState.targetY : mix(sculptState.pointerY, sculptState.targetY, .36);
    if (!reducedMotion) sculptState.time = timestamp * .001;
    gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);
    gl.uniform2f(uniforms.u_resolution, canvasWidth, canvasHeight);
    gl.uniform2f(uniforms.u_pointer, sculptState.pointerX, sculptState.pointerY);
    gl.uniform1f(uniforms.u_scroll, sculptState.scroll);
    gl.uniform1f(uniforms.u_scene, sculptState.scene);
    gl.uniform1f(uniforms.u_time, sculptState.time);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    const settling=Math.abs(sculptState.targetX-sculptState.pointerX)+Math.abs(sculptState.targetY-sculptState.pointerY);
    if (!reducedMotion && settling>.003) drawFrame = requestAnimationFrame(drawSculpture);
  }
  function scheduleDraw() { if (!drawFrame) drawFrame = requestAnimationFrame(drawSculpture); }
  new ResizeObserver(resizeSculpture).observe(world);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) scheduleDraw(); });
  canvas.addEventListener('pointerdown', event => { dragging=true; lastDragX=event.clientX; lastDragY=event.clientY; canvas.setPointerCapture(event.pointerId); });
  canvas.addEventListener('pointermove', event => {
    const box=canvas.getBoundingClientRect();
    if(dragging){ sculptState.targetX=clamp(sculptState.targetX+(event.clientX-lastDragX)/box.width*2,-1.8,1.8); sculptState.targetY=clamp(sculptState.targetY+(event.clientY-lastDragY)/box.height*2,-1.4,1.4); lastDragX=event.clientX; lastDragY=event.clientY; }
    else { sculptState.targetX=((event.clientX-box.left)/box.width-.5)*1.1; sculptState.targetY=((event.clientY-box.top)/box.height-.5)*-.8; }
    scheduleDraw();
  }, { passive: true });
  canvas.addEventListener('pointerleave',()=>{if(!dragging){sculptState.targetX=0;sculptState.targetY=0;scheduleDraw();}});
  ['pointerup','pointercancel','lostpointercapture'].forEach(type => canvas.addEventListener(type, () => { dragging=false; }));
  canvas.addEventListener('keydown', event => {
    const step = event.shiftKey ? .25 : .1;
    if(event.key==='ArrowLeft') sculptState.targetX-=step;
    else if(event.key==='ArrowRight') sculptState.targetX+=step;
    else if(event.key==='ArrowUp') sculptState.targetY+=step;
    else if(event.key==='ArrowDown') sculptState.targetY-=step;
    else return;
    event.preventDefault(); scheduleDraw();
  });
  initSculpture();

  const zoneValues = { hero:0, work:.18, capabilities:.38, manifesto:.58, process:.72, about:.86, contact:1 };
  const zonePosition = {
    hero:[0,0,1,1], work:[15,8,.78,.36], capabilities:[9,7,.8,.52], manifesto:[-32,-6,.8,.57], process:[-16,5,.76,.43], about:[43,0,.7,.23], contact:[-6,-5,.96,.96]
  };
  const processSteps = [...document.querySelectorAll('.process-step')];
  const processSystem = document.querySelector('.process-system');
  const projectCards = [...document.querySelectorAll('.project-card')];
  const manifestoWords = [...document.querySelectorAll('.manifesto-words span')];
  function updateScrollStory() {
    pageFrame=0;
    const maxScroll=page.scrollHeight-window.innerHeight;
    const globalProgress=maxScroll>0?window.scrollY/maxScroll:0;
    readingLine.style.transform=`scaleX(${globalProgress})`;
    header.classList.toggle('scrolled',window.scrollY>40);
    const viewportMark=window.innerHeight*.54;
    let current=chapters[0];
    for(const section of chapters){ if(section.getBoundingClientRect().top<=viewportMark) current=section; }
    const zone=current?.dataset.scene||'hero';
    world.dataset.zone=zone;
    sculptState.scene=reducedMotion?0:(zoneValues[zone] ?? 0);
    sculptState.scroll=reducedMotion?0:globalProgress;
    const pos=zonePosition[zone]||zonePosition.hero;
    if(!reducedMotion){
      world.style.setProperty('--world-x',`${pos[0]}%`);
      world.style.setProperty('--world-y',`${pos[1]}%`);
      world.style.setProperty('--world-scale',pos[2]);
      world.style.setProperty('--world-opacity',pos[3]);
    }
    scheduleDraw();

    if(processSystem){
      let active=0;
      let closest=Infinity;
      processSteps.forEach((step,index)=>{ const r=step.getBoundingClientRect(); const d=Math.abs(r.top+r.height/2-window.innerHeight*.55); if(d<closest){closest=d;active=index;} });
      if(!reducedMotion){
        processSystem.dataset.stage=String(active);
        processSystem.querySelector('.process-stage-name').textContent=processSteps[active]?.querySelector('strong').textContent||'IDEA';
      }
      processSteps.forEach((step,index)=>{step.classList.toggle('active',index===active);step.setAttribute('aria-current',index===active?'step':'false');});
    }
    projectCards.forEach(card=>{
      const r=card.getBoundingClientRect();
      const distance=Math.abs(r.top+r.height*.42-window.innerHeight*.5)/(window.innerHeight*.8);
      card.style.setProperty('--story-scale',reducedMotion?'1':(1-clamp(distance)*.035).toFixed(3));
    });
    const manifesto=document.querySelector('.manifesto');
    if(manifesto){
      const r=manifesto.getBoundingClientRect();
      const t=clamp((window.innerHeight-r.top)/(window.innerHeight+r.height));
      if(!reducedMotion)manifestoWords.forEach((word,index)=>{
        const local=clamp((t-index*.19)/.25);
        const offset=(1-local)*26;
        word.style.transform=`translate3d(${offset}px,${offset*.28}px,0) scale(${.94+local*.06})`;
        word.style.opacity=String(.43+local*.57);
      });
    }
  }
  window.addEventListener('scroll',()=>{if(!pageFrame)pageFrame=requestAnimationFrame(updateScrollStory);},{passive:true});
  window.addEventListener('resize',()=>{resizeSculpture();updateScrollStory();},{passive:true});
  updateScrollStory();

  // The six capabilities control a small live interface study rather than static service cards.
  const capabilityLab=document.querySelector('.capability-lab');
  const capabilityDescription=document.querySelector('.capability-description');
  const demoState=document.querySelector('.demo-state');
  const capabilityDescriptions={
    web:'A distinct visual language, shaped around what matters.',
    ux:'A clear hierarchy that helps the next step feel natural.',
    motion:'Movement that gives the idea rhythm and intent.',
    interaction:'A responsive interface that invites exploration.',
    three:'Depth, material and light, designed for the browser.',
    development:'A considered system brought to life with care.'
  };
  const capabilityChoices=[...document.querySelectorAll('.capability-choice')];
  function setCapability(mode){
    const i=capabilityChoices.findIndex(item=>item.dataset.capability===mode); if(i<0)return;
    capabilityLab.dataset.mode=mode;
    capabilityChoices.forEach((item,index)=>{item.classList.toggle('active',index===i);item.setAttribute('aria-pressed',String(index===i));});
    capabilityDescription.textContent=capabilityDescriptions[mode];
    demoState.textContent=`${String(i+1).padStart(2,'0')} / 06`;
    scheduleDraw();
  }
  capabilityChoices.forEach(choice=>{
    choice.addEventListener('pointerenter',()=>{if(finePointer)setCapability(choice.dataset.capability);});
    choice.addEventListener('focus',()=>setCapability(choice.dataset.capability));
    choice.addEventListener('click',()=>setCapability(choice.dataset.capability));
  });
  const demoContent=document.querySelector('.demo-content');
  let demoAngle=0;
  demoContent.addEventListener('pointermove',event=>{const r=demoContent.getBoundingClientRect();demoAngle=((event.clientX-r.left)/r.width-.5)*48;demoContent.style.setProperty('--demo-angle',`${demoAngle}deg`);},{passive:true});
  document.querySelector('.demo-action').addEventListener('click',()=>{
    demoContent.classList.toggle('demo-engaged');
    document.querySelector('.demo-title').innerHTML=demoContent.classList.contains('demo-engaged')?'Go a little<br><em>further.</em>':'Shape<br><em>the feeling.</em>';
  });

  // Different project interactions respond to movement in different ways.
  projectCards.forEach(card=>{
    const art=card.querySelector('.project-art');
    card.addEventListener('pointermove',event=>{
      if(!finePointer || reducedMotion || event.pointerType!=='mouse')return;
      const r=art.getBoundingClientRect(); const x=(event.clientX-r.left)/r.width-.5; const y=(event.clientY-r.top)/r.height-.5;
      if(card.dataset.project==='vela') art.style.transform=`perspective(1000px) rotateX(${y*-1.5}deg) rotateY(${x*2}deg)`;
      if(card.dataset.project==='atlas'){art.style.setProperty('--mouse-x',`${x*13}px`);art.style.setProperty('--mouse-y',`${y*12}px`);}
      if(card.dataset.project==='form') art.style.setProperty('--object-turn',`${x*10}deg`);
      if(card.dataset.project==='serein'){art.style.setProperty('--wave-lift',`${y*16}px`);art.style.setProperty('--wave-shift',`${x*11}px`);}
    });
    card.addEventListener('pointerleave',()=>{art.style.transform='';art.style.removeProperty('--mouse-x');art.style.removeProperty('--mouse-y');art.style.removeProperty('--object-turn');art.style.removeProperty('--wave-lift');art.style.removeProperty('--wave-shift');});
    card.querySelectorAll('[data-case]').forEach(button=>button.addEventListener('click',()=>openCase(card.dataset.project,button)));
  });

  const caseData={
    vela:{title:'VELA®',type:'ADVANCED COMMERCE INTERFACE',lead:'A considered digital home for objects designed to stay.',overview:'An imagined direct-to-customer world where every object has room for its material, maker and story.',objective:'Make product discovery feel editorial and unhurried, while keeping the path to purchase direct.',direction:'Soft mineral tones, a tactile serif, precise product framing and a quiet navigation system.',interaction:'Layered object movement, close product details and a low-friction collection journey.',technology:'Illustrative concept stack: semantic HTML, CSS motion, responsive product views and accessible commerce patterns.',decisions:'One object takes the lead; motion is tied to pointer intent; the interface gives buying information clear priority.'},
    atlas:{title:'ATLAS NO. 08',type:'IMMERSIVE SCROLL EXPERIENCE',lead:'A field guide to the feeling of getting away.',overview:'An imagined travel journal that unfolds like a journey through a changing landscape.',objective:'Turn a collection of field notes into a place visitors move through, rather than a page they skim.',direction:'Weathered greens, topographic pacing, sparse wayfinding and landscape-led typography.',interaction:'Scroll shifts the horizon and reveals each frame; pointer position moves the foreground at a different depth.',technology:'Illustrative concept stack: scroll-linked transforms, layered SVG landscapes and a reduced-motion reading mode.',decisions:'The scene changes with scroll; movement stays directional; coordinates provide orientation, not decoration.'},
    form:{title:'FORM STUDIES',type:'CINEMATIC EDITORIAL WEBSITE',lead:'An index of beautiful things, made for the curious eye.',overview:'An imagined editorial platform for ideas on design, making and the objects between them.',objective:'Build a flexible identity for image-rich features and short notes without losing a calm reading rhythm.',direction:'Warm paper, expressive editorial type, object studies and a modular issue structure.',interaction:'A responsive index adapts to cursor focus; issue controls adjust the reading view and object scale.',technology:'Illustrative concept stack: semantic article structure, responsive layout and light-touch interface controls.',decisions:'Images have breathing room; the index keeps its hierarchy; transitions mark a new reading mode.'},
    serein:{title:'SEREIN',type:'EXPERIMENTAL INTERACTIVE EXPERIENCE',lead:'A sound-led identity that knows when to be quiet.',overview:'An imagined portfolio for an independent audio label, shaped around stillness and attentive listening.',objective:'Make an audio brand memorable without borrowing the visual volume of the category.',direction:'Midnight blue, a restrained brass accent, open space and a hand-drawn wave signature.',interaction:'The wave responds to pointer movement; a single control changes the listening state and visual cadence.',technology:'Illustrative concept stack: responsive SVG, reduced-motion states and keyboard-operable audio controls.',decisions:'Sound never starts without intent; waves carry the identity; controls remain visible and simple.'}
  };
  const caseDialog=document.querySelector('.case-dialog');
  const caseKeys=Object.keys(caseData);
  let currentCase='vela'; let caseOpener=null;
  let visualSequence=0;
  function cloneProjectVisual(source){
    const clone=source.cloneNode(true);
    const renames=[];
    clone.querySelectorAll('[id]').forEach(node=>{const original=node.id;const next=`${original}-copy-${++visualSequence}`;renames.push([original,next]);node.id=next;});
    const nodes=[clone,...clone.querySelectorAll('*')];
    nodes.forEach(node=>node.getAttributeNames().forEach(name=>{
      let value=node.getAttribute(name);
      renames.forEach(([oldId,newId])=>{value=value.replaceAll(`url(#${oldId})`,`url(#${newId})`).replaceAll(`#${oldId}")`,`#${newId}")`);});
      node.setAttribute(name,value);
    }));
    return clone;
  }
  function openCase(key,opener){
    const data=caseData[key]; if(!data)return;
    currentCase=key;
    if(opener)caseOpener=opener;
    else if(!caseDialog.open)caseOpener=document.activeElement;
    const card=document.querySelector(`[data-project="${key}"]`);
    const art=card.querySelector('.project-art');
    document.querySelector('#case-title').textContent=data.title;
    caseDialog.querySelector('.case-type').textContent=data.type;
    caseDialog.querySelector('.case-count').textContent=`${String(caseKeys.indexOf(key)+1).padStart(2,'0')} / 04`;
    caseDialog.querySelector('.case-lead').textContent=data.lead;
    ['overview','objective','direction','interaction','technology','decisions'].forEach(field=>caseDialog.querySelector(`.case-${field}`).textContent=data[field]);
    caseDialog.querySelector('.case-visual').replaceChildren(cloneProjectVisual(art));
    caseDialog.querySelector('.case-position').textContent=`${String(caseKeys.indexOf(key)+1).padStart(2,'0')} / 04`;
    caseDialog.querySelector('.preview-project').textContent=`${data.title} / CONCEPT PROJECT`;
    caseDialog.querySelector('.preview-experience').hidden=true;
    if(!caseDialog.open)caseDialog.showModal();
    document.body.classList.add('dialog-open');
  }
  caseDialog.querySelector('.dialog-close').addEventListener('click',()=>caseDialog.close());
  caseDialog.addEventListener('close',()=>{document.body.classList.remove('dialog-open');caseDialog.querySelector('.preview-experience').hidden=true;if(caseOpener?.isConnected)caseOpener.focus();});
  caseDialog.addEventListener('click',event=>{if(event.target===caseDialog)caseDialog.close();});
  function moveCase(direction){const i=caseKeys.indexOf(currentCase);openCase(caseKeys[(i+direction+caseKeys.length)%caseKeys.length]);}
  caseDialog.querySelector('.case-next').addEventListener('click',()=>moveCase(1));
  caseDialog.querySelector('.case-prev').addEventListener('click',()=>moveCase(-1));
  const preview=caseDialog.querySelector('.preview-experience');
  caseDialog.querySelector('.preview-launch').addEventListener('click',()=>{
    const art=cloneProjectVisual(document.querySelector(`[data-project="${currentCase}"] .project-art`));
    caseDialog.querySelector('.preview-stage').replaceChildren(art);
    const controls=caseDialog.querySelector('.preview-controls');
    controls.replaceChildren();
    const feedback=document.createElement('span');feedback.className='preview-feedback';feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');feedback.textContent='INTERACTIVE CONCEPT PREVIEW';
    const action=document.createElement('button');action.type='button';action.dataset.previewAction='true';
    if(currentCase==='vela')action.textContent='ADD TO BAG';
    if(currentCase==='atlas')action.textContent='CHANGE HORIZON';
    if(currentCase==='form')action.textContent='ADJUST TYPE';
    if(currentCase==='serein'){action.textContent='ANIMATE WAVE';action.setAttribute('aria-label','Toggle visual score motion');}
    controls.append(action,feedback);
    if(currentCase==='form'){
      const range=document.createElement('input');range.type='range';range.min='0';range.max='100';range.value='50';range.setAttribute('aria-label','Adjust display type size');
      range.addEventListener('input',()=>caseDialog.querySelector('.preview-stage').style.setProperty('--preview-size',`${.78+Number(range.value)/100*.65}`));
      controls.append(range);
    }
    const closePreview=document.createElement('button');closePreview.type='button';closePreview.className='preview-close-control';closePreview.textContent='CLOSE PREVIEW  ×';closePreview.addEventListener('click',()=>{preview.hidden=true;});controls.append(closePreview);
    action.addEventListener('click',()=>{
      const stage=caseDialog.querySelector('.preview-stage');
      if(currentCase==='vela'){stage.classList.toggle('bag-added');feedback.textContent=stage.classList.contains('bag-added')?'ADDED — BAG (1)':'REMOVED — BAG (0)';}
      if(currentCase==='atlas'){stage.classList.toggle('horizon-shift');feedback.textContent=stage.classList.contains('horizon-shift')?'HORIZON SHIFTED':'HORIZON RESTORED';}
      if(currentCase==='form'){stage.classList.toggle('type-adjusted');feedback.textContent=stage.classList.contains('type-adjusted')?'TYPE VIEW ADJUSTED':'TYPE VIEW RESTORED';}
      if(currentCase==='serein'){stage.classList.toggle('sound-playing');feedback.textContent=stage.classList.contains('sound-playing')?'VISUAL SCORE IN MOTION':'VISUAL SCORE PAUSED';}
    });
    preview.hidden=false;
  });
  caseDialog.querySelector('.preview-close').addEventListener('click',()=>{preview.hidden=true;});

  // Full project inquiry opens the visitor's mail app with a composed, addressed brief.
  const inquiryDialog=document.querySelector('.inquiry-dialog');
  const inquiryForm=document.querySelector('#inquiry-form');
  let inquiryOpener=null;
  document.querySelectorAll('[data-open-inquiry]').forEach(button=>button.addEventListener('click',()=>{
    inquiryOpener=button;closeMenu();inquiryDialog.showModal();document.body.classList.add('dialog-open');
    window.setTimeout(()=>inquiryForm.querySelector('[name="name"]').focus(),80);
  }));
  inquiryDialog.querySelector('.inquiry-close').addEventListener('click',()=>inquiryDialog.close());
  inquiryDialog.addEventListener('click',event=>{if(event.target===inquiryDialog)inquiryDialog.close();});
  inquiryDialog.addEventListener('close',()=>{document.body.classList.remove('dialog-open');if(inquiryOpener?.isConnected)inquiryOpener.focus();});
  inquiryForm.addEventListener('submit',event=>{
    event.preventDefault();
    const data=new FormData(inquiryForm);
    const lines=[
      `Name: ${data.get('name')||''}`,`Company: ${data.get('company')||'—'}`,`Project type: ${data.get('projectType')||''}`,
      `What they need: ${data.getAll('needs').join(', ')||'Not selected'}`,`Budget range: ${data.get('budget')||'Not sure yet'} ${data.get('currency')||''}`,`Timeline: ${data.get('timeline')||''}`,
      `Contact email: ${data.get('email')||''}`,`Phone: ${data.get('phone')||'Not provided'}`,`Project description: ${data.get('description')||''}`
    ];
    const subject=encodeURIComponent(`Project inquiry — ${data.get('name')||'New project'}`);
    const body=encodeURIComponent(lines.join('\n\n'));
    document.querySelector('.form-status').textContent='Opening your email app with the inquiry ready to send…';
    window.location.href=`mailto:${contactEmail}?subject=${subject}&body=${body}`;
  });
})();

/* Live split-flap wall in three.js, seen through a real-time glass pass.
   Usage: BOARD3D.run(canvas). Requires THREE (r128 UMD) loaded first. */
(function () {
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ALPHA = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789·-:';
  var AT_COLS = 8, AT_ROWS = 5;

  function makeAtlas() {
    var size = 1024, cw = size / AT_COLS, chh = 960 / AT_ROWS;
    var c = document.createElement('canvas'); c.width = size; c.height = 960;
    var g = c.getContext('2d');
    g.clearRect(0, 0, size, 960);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (var i = 0; i < ALPHA.length; i++) {
      var ch = ALPHA[i], x = (i % AT_COLS) * cw + cw / 2, y = Math.floor(i / AT_COLS) * chh + chh / 2;
      if (ch === ' ') continue;
      // halo in G channel (blurred), crisp glyph in R channel
      g.save(); g.filter = 'blur(9px)'; g.fillStyle = 'rgb(0,255,0)'; g.font = '700 ' + (chh * 0.68) + 'px "Bebas Neue", Impact, sans-serif';
      g.fillText(ch, x, y + chh * 0.02); g.restore();
      g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgb(255,0,0)'; g.font = '700 ' + (chh * 0.68) + 'px "Bebas Neue", Impact, sans-serif';
      g.fillText(ch, x, y + chh * 0.02); g.restore();
    }
    var t = new THREE.CanvasTexture(c); t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = 4;
    return t;
  }

  var tileVS = [
    'attribute vec3 aOffset; attribute float aChar; attribute float aNext; attribute float aFlip; attribute float aTone;',
    'uniform float uHalf; uniform float uIsFlap;',
    'varying vec2 vUv; varying float vChar; varying float vNext; varying float vFlip; varying float vTone; varying float vShade; varying float vDepth; varying float vHalf;',
    'void main(){',
    '  vUv=uv; vChar=aChar; vNext=aNext; vFlip=aFlip; vTone=aTone; vHalf=uHalf;',
    '  vec3 p=position; float shade=1.0;',
    '  if(uIsFlap>0.5){ float a=aFlip*3.14159265; float c=cos(a), s=sin(a); float y=p.y; p.y=y*c; p.z=y*s; shade=0.45+0.55*abs(c); }',
    '  vShade=shade;',
    '  vec4 mv=modelViewMatrix*vec4(p+aOffset,1.0); vDepth=-mv.z;',
    '  gl_Position=projectionMatrix*mv;',
    '}'].join('\n');

  var tileFS = [
    'precision highp float; uniform sampler2D uAtlas; uniform float uIsFlap; uniform vec3 uFog; uniform float uTime;',
    'varying vec2 vUv; varying float vChar; varying float vNext; varying float vFlip; varying float vTone; varying float vShade; varying float vDepth; varying float vHalf;',
    'vec2 cellUv(float c, vec2 uv){ float col=mod(c,8.0); float row=floor(c/8.0); return vec2((col+uv.x)/8.0, 1.0-(row+1.0-uv.y)/5.0); }',
    'void main(){',
    '  float c=vChar; float hf=vHalf; vec2 uv=vUv;',
    '  if(uIsFlap>0.5){ if(vFlip>0.5){ c=vNext; hf=-1.0; uv.y=1.0-uv.y; } else { hf=1.0; } }',
    '  float vv = hf>0.0 ? 0.5+0.5*uv.y : 0.5*uv.y;',
    '  vec4 g=texture2D(uAtlas, cellUv(c, vec2(uv.x, vv)));',
    '  vec3 tile=vec3(0.118,0.114,0.106);',
    '  float grad = hf>0.0 ? mix(0.92,1.08,uv.y) : mix(0.82,0.98,uv.y);',
    '  tile*=grad;',
    '  float edge=smoothstep(0.0,0.035,uv.x)*smoothstep(1.0,0.965,uv.x)*(hf>0.0?smoothstep(1.0,0.96,uv.y):smoothstep(0.0,0.04,uv.y));',
    '  tile=mix(tile*0.35,tile,edge);',
    '  vec3 paper=vec3(0.93,0.918,0.894); vec3 amber=vec3(1.0,0.792,0.443);',
    '  vec3 glyph=mix(paper,amber,vTone);',
    '  vec3 col=tile+glyph*g.r*0.78;',
    '  col*=vShade;',
    '  float fog=smoothstep(8.0,40.0,vDepth);',
    '  col=mix(col,uFog,fog);',
    '  gl_FragColor=vec4(col,1.0);',
    '}'].join('\n');

  var postFS = [
    'precision highp float; uniform sampler2D tScene; uniform vec2 uRes; uniform vec2 uMouse; uniform float uTime;',
    'varying vec2 vUv;',
    'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
    'void main(){',
    '  vec2 uv=vUv; float asp=uRes.x/uRes.y; vec2 q=vec2(uv.x*asp,uv.y);',
    // --- glass: a faint slow ripple (the cursor drives camera parallax, not the glass)
    '  vec2 ripple=vec2(sin(q.y*9.0+uTime*0.5)*0.0016, cos(q.x*7.0-uTime*0.4)*0.0016);',
    '  vec2 refr = ripple;',
    '  vec3 col=texture2D(tScene, uv+refr).rgb;',
    // --- grade: darken for text, scanlines, vignette, grain
    '  col*=0.62;',
    '  col*=0.94+0.06*sin(gl_FragCoord.y*1.3);',
    '  float v=smoothstep(1.25,0.3,length((uv-0.5)*vec2(1.1,1.0))); col*=0.4+0.6*v;',
    '  col+=(hash(uv*uRes+uTime)-0.5)*0.028;',
    '  gl_FragColor=vec4(col,1.0);',
    '}'].join('\n');

  function run(canvas, opts) {
    opts = opts || {};
    var still = !!opts.still || reduced;
    if (!window.THREE) return null;
    var renderer;
    try { renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: false, alpha: false, powerPreference: 'high-performance' }); }
    catch (e) { return null; }
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    renderer.setPixelRatio(dpr);
    var scene = new THREE.Scene(); var FOG = new THREE.Color(0x0b0b0a); scene.background = FOG;
    var camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);

    var COLS = 54, ROWS = 12, TW = 1.0, TH = 1.5, GX = 0.1, GY = 0.18, N = COLS * ROWS;
    var atlas = makeAtlas();
    var group = new THREE.Group(); scene.add(group);

    function makeHalf(isFlap, half) {
      var base = new THREE.PlaneGeometry(TW, TH / 2);
      base.translate(0, half > 0 ? TH / 4 : -TH / 4, 0);
      var geo = new THREE.InstancedBufferGeometry();
      geo.index = base.index; geo.attributes.position = base.attributes.position; geo.attributes.uv = base.attributes.uv; geo.attributes.normal = base.attributes.normal;
      var off = new Float32Array(N * 3), tone = new Float32Array(N);
      for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
        var i = r * COLS + c;
        off[i * 3] = (c - COLS / 2 + 0.5) * (TW + GX); off[i * 3 + 1] = (ROWS / 2 - r - 0.5) * (TH + GY); off[i * 3 + 2] = 0;
        tone[i] = (r === 0 || (c >= 2 && c < 7) || c >= COLS - 11) ? 1 : 0; // header row and time/status columns in amber
      }
      geo.setAttribute('aOffset', new THREE.InstancedBufferAttribute(off, 3));
      geo.setAttribute('aTone', new THREE.InstancedBufferAttribute(tone, 1));
      geo.setAttribute('aChar', new THREE.InstancedBufferAttribute(new Float32Array(N), 1).setUsage(THREE.DynamicDrawUsage));
      geo.setAttribute('aNext', new THREE.InstancedBufferAttribute(new Float32Array(N), 1).setUsage(THREE.DynamicDrawUsage));
      geo.setAttribute('aFlip', new THREE.InstancedBufferAttribute(new Float32Array(N), 1).setUsage(THREE.DynamicDrawUsage));
      geo.instanceCount = N;
      var mat = new THREE.ShaderMaterial({ vertexShader: tileVS, fragmentShader: tileFS, side: THREE.DoubleSide,
        uniforms: { uAtlas: { value: atlas }, uHalf: { value: half }, uIsFlap: { value: isFlap ? 1 : 0 }, uFog: { value: FOG }, uTime: { value: 0 } } });
      var mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; group.add(mesh); return mesh;
    }
    var topStatic = makeHalf(false, 1), botStatic = makeHalf(false, -1), flap = makeHalf(true, 1);
    flap.renderOrder = 2;
    var meshes = [topStatic, botStatic, flap];

    // Board pose: near on the left, receding to the right, like the photograph
    group.rotation.y = -0.7; group.position.set(10.8, -3.4, -17.5);
    camera.position.set(0, 0, 0);

    // ---- flip state
    var cur = new Float32Array(N), nxt = new Float32Array(N), prog = new Float32Array(N), speed = new Float32Array(N);
    var queue = []; for (var i = 0; i < N; i++) queue.push([]);
    function idx(ch) { var k = ALPHA.indexOf(ch); return k < 0 ? 0 : k; }
    function randLine() {
      var s = '';
      function word(n) { var w = ''; for (var i = 0; i < n; i++) w += ALPHA[1 + Math.floor(Math.random() * 26)]; return w; }
      function num(n) { var w = ''; for (var i = 0; i < n; i++) w += ALPHA[27 + Math.floor(Math.random() * 10)]; return w; }
      s = num(2) + ':' + num(2) + ' ' + word(3 + Math.floor(Math.random() * 9)) + ' ' + word(3) + ' ' + num(2);
      s = s.replace(':', '·');
      while (s.length < COLS) s += ' ';
      return s.slice(0, COLS);
    }
    function setRow(r, text, cascade) {
      for (var c = 0; c < COLS; c++) {
        var i = r * COLS + c, target = idx(text[c]);
        if (target === cur[i] && queue[i].length === 0) continue;
        var from = queue[i].length ? queue[i][queue[i].length - 1] : (prog[i] > 0 ? nxt[i] : cur[i]);
        var steps = Math.min(12, ((target - from) + ALPHA.length) % ALPHA.length);
        if (steps === 0 || steps > 8) steps = 3 + Math.floor(Math.random() * 5);
        var k = from; for (var st = 0; st < steps - 1; st++) { k = (k + 1) % ALPHA.length; queue[i].push(k); }
        queue[i].push(target);
        speed[i] = 5 + Math.random() * 3;
        if (cascade) queue[i].unshift(-1 - Math.floor(c * 1.2)); // delay tokens
      }
    }
    for (var r = 0; r < ROWS; r++) { var line = randLine(); for (var c = 0; c < COLS; c++) { var i = r * COLS + c; cur[i] = nxt[i] = idx(line[c]); } }
    var nextChange = 0.8, external = false;

    // ---- post pass
    var rt = new THREE.WebGLRenderTarget(1, 1, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBFormat });
    var postScene = new THREE.Scene(), postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    var postMat = new THREE.ShaderMaterial({ vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }', fragmentShader: postFS,
      uniforms: { tScene: { value: rt.texture }, uRes: { value: new THREE.Vector2(1, 1) }, uMouse: { value: new THREE.Vector2(0.5, 0.5) }, uTime: { value: 0 } } });
    postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMat));

    var mouse = new THREE.Vector2(0.5, 0.5), target = new THREE.Vector2(0.5, 0.5);
    if (!still) window.addEventListener('pointermove', function (e) { target.set(e.clientX / window.innerWidth, 1 - e.clientY / window.innerHeight); }, { passive: true });

    var w = 0, h = 0;
    function resize() {
      var cw = canvas.clientWidth, ch = canvas.clientHeight;
      if (cw === w && ch === h) return;
      w = cw; h = ch; renderer.setSize(cw, ch, false);
      rt.setSize(Math.floor(cw * dpr), Math.floor(ch * dpr));
      camera.aspect = cw / ch; camera.updateProjectionMatrix();
      postMat.uniforms.uRes.value.set(cw * dpr, ch * dpr);
    }

    var last = performance.now(), t = 0, running = true;
    function step(now) { var dt = Math.min(0.05, (now - last) / 1000); last = now; frame(dt); }
    function frame(dt) {
      t += dt;
      resize();
      mouse.lerp(target, 0.06);
      // camera: slow lateral carousel drift plus cursor parallax
      var drift = still ? 0 : Math.sin(t * 0.12) * 1.6;
      camera.position.set(drift + (mouse.x - 0.5) * 0.8, (mouse.y - 0.5) * 0.5, 0);
      camera.lookAt(drift * 0.6 + 3.0 + (mouse.x - 0.5) * 1.2, 0.3 + (mouse.y - 0.5) * 0.6, -17.5);
      // flips
      if (!still) {
        if (!external && t > nextChange) { setRow(Math.floor(Math.random() * ROWS), randLine(), Math.random() < 0.5); nextChange = t + 0.45 + Math.random() * 1.1; }
        for (var i = 0; i < N; i++) {
          if (prog[i] === 0 && queue[i].length) {
            var q = queue[i][0];
            if (q < 0) { queue[i][0] = q + dt * 22; if (queue[i][0] >= -1) queue[i].shift(); continue; }
            nxt[i] = queue[i].shift(); prog[i] = 0.0001;
          }
          if (prog[i] > 0) { prog[i] += dt * speed[i]; if (prog[i] >= 1) { cur[i] = nxt[i]; prog[i] = 0; } }
        }
      }
      meshes.forEach(function (m) {
        var a = m.geometry.attributes;
        a.aChar.array.set(cur); a.aNext.array.set(nxt); a.aFlip.array.set(prog);
        a.aChar.needsUpdate = a.aNext.needsUpdate = a.aFlip.needsUpdate = true;
        m.material.uniforms.uTime.value = t;
      });
      postMat.uniforms.uTime.value = t; postMat.uniforms.uMouse.value.copy(mouse);
      renderer.setRenderTarget(rt); renderer.render(scene, camera);
      renderer.setRenderTarget(null); renderer.render(postScene, postCam);
    }
    function loop(now) { if (!running) return; step(now); if (!still) requestAnimationFrame(loop); }
    function instant(lines) { for (var r = 0; r < ROWS; r++) { var l = pad(lines[r] || ''); for (var c = 0; c < COLS; c++) { var i = r * COLS + c; cur[i] = nxt[i] = ALPHA.indexOf(l[c]); prog[i] = 0; queue[i] = []; } } mouse.set(0.5, 0.5); frame(0); }
    document.addEventListener('visibilitychange', function () { running = !document.hidden; if (running && !still) { last = performance.now(); requestAnimationFrame(loop); } });
    if (still) window.addEventListener('resize', function () { frame(0); });
    var ready = function () { canvas.classList.add('is-ready'); requestAnimationFrame(loop); };
    if (document.fonts && document.fonts.load) {
      document.fonts.load('700 100px "Bebas Neue"').then(function () { atlas.image = makeAtlas().image; atlas.needsUpdate = true; ready(); }, ready);
    } else ready();
    function pad(str) { str = String(str || '').toUpperCase(); var out = ''; for (var i = 0; i < COLS; i++) { var ch = str[i] || ' '; out += ALPHA.indexOf(ch) >= 0 ? ch : ' '; } return out; }
    var api = { renderer: renderer, frame: frame, cols: COLS, rows: ROWS, still: still,
      setLines: function (lines, cascade) { external = true; if (still) { instant(lines); return; } for (var r = 0; r < ROWS; r++) setRow(r, pad(lines[r] || ''), cascade !== false); },
      setLine: function (r, line, cascade) { external = true; if (r >= 0 && r < ROWS) setRow(r, pad(line), cascade !== false); } };
    canvas._board = api; return api;
  }
  window.BOARD3D = { run: run };
})();

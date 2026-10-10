// Animation core from public/references/solar-composer.html.
// Shaders, palettes, constants and equations are preserved; application callbacks replace demo replies.
export function mountSolarSky(scene, canvas, veil, onFlip, onReply) {
  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function hex(h) { return [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255]; }
  var PAL = {
    light: { bottom: hex('#87ceeb'), mid: hex('#f8f8f8'), top: hex('#ffffff'), flat: hex('#ffffff'), end: hex('#ffffff') },
    dark: { bottom: hex('#050812'), mid: hex('#1d2840'), top: hex('#52648a'), flat: hex('#09090b'), end: hex('#0d111b') }
  };
  var theme = 'light';
  var cur = { bottom: PAL.light.bottom.slice(), mid: PAL.light.mid.slice(), top: PAL.light.top.slice(), flat: PAL.light.flat.slice(), end: PAL.light.end.slice() };
  var raf = 0, initialTheme = true;
  function goChat() { chatMode = true; onFlip(); }
  function startReply() { onReply(); } // Reveal only actual provider content, at the supplied REPLY_AT point.
  var VERT = 'attribute vec2 position; void main(){ gl_Position = vec4(position, 0.0, 1.0); }';
  var FRAG = [
    'precision highp float;',
    'uniform vec2 u_resolution; uniform float u_time; uniform float u_speed;',
    'uniform vec3 u_colorBottom; uniform vec3 u_colorMid; uniform vec3 u_colorTop; uniform vec3 u_flat; uniform vec3 u_end;',
    'uniform float u_z0; uniform float u_z1; uniform float u_roll0; uniform float u_roll1; uniform float u_dive; uniform float u_fade;',
    'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }',
    'float noise(vec2 p){',
    '  vec2 i = floor(p); vec2 f = fract(p);',
    '  float a = hash(i); float b = hash(i + vec2(1.0, 0.0)); float c = hash(i + vec2(0.0, 1.0)); float d = hash(i + vec2(1.0, 1.0));',
    '  vec2 u = f * f * (3.0 - 2.0 * f);',
    '  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;',
    '}',
    '// fbm "infini" : quand on zoome (L octaves), les octaves fines prennent le relais pour garder du détail.',
    'float fbm(vec2 p, float L, float t){',
    '  float n = floor(L); float f = L - n;',
    '  mat2 rot = mat2(0.86, 0.51, -0.51, 0.86);',
    '  for (int j = 0; j < 8; j++) { if (float(j) < n) p = rot * p * 2.0; }',
    '  float v = 0.0; float fi = n;',
    '  for (int k = 0; k < 7; k++) {',
    '    float amp = pow(0.5, float(k) + 1.0 - f);',
    '    if (k == 0) amp *= (1.0 - f);',
    '    vec2 morph = vec2(sin(t * 0.5 + fi), cos(t * 0.3 - fi)) * 0.05;',
    '    v += amp * noise(p + morph);',
    '    p = rot * p * 2.0; fi += 1.0;',
    '  }',
    '  return v;',
    '}',
    'vec3 sky(vec2 p0, float z, float roll, float t){',
    '  float c = cos(roll); float s = sin(roll);',
    '  vec2 p = mat2(c, -s, s, c) * p0 * z;',
    '  vec2 wind = vec2(t * 0.1, t * 0.02) * z;',
    '  float pattern = fbm(p * 2.2 - wind, max(0.0, -log2(z)), t);',
    '  float bandLow = smoothstep(0.3, 0.65, pattern);',
    '  float bandHigh = smoothstep(0.7, 0.95, pattern);',
    '  vec3 col = mix(u_colorBottom, u_colorMid, bandLow);',
    '  return mix(col, u_colorTop, bandHigh);',
    '}',
    'void main(){',
    '  vec2 uv = gl_FragCoord.xy / u_resolution;',
    '  float t = u_time * u_speed;',
    '  vec2 aspect = vec2(u_resolution.x / max(u_resolution.y, 1.0), 1.0);',
    '  vec2 p = (uv - 0.5) * aspect;',
    '  vec3 col;',
    '  if (abs(u_z1 - u_z0) < 0.0004) {',
    '    col = sky(p, u_z1, u_roll1, t);',
    '  } else {',
    '    vec3 acc = vec3(0.0);',
    '    for (int i = 0; i < 10; i++) {',
    '      float k = float(i) / 9.0;',
    '      acc += sky(p, mix(u_z0, u_z1, k), mix(u_roll0, u_roll1, k), t);',
    '    }',
    '    col = acc / 10.0;',
    '  }',
    '  col = mix(col, u_end, smoothstep(0.55, 1.0, u_dive));',
    '  col = mix(col, u_flat, u_fade);',
    '  col += (hash(gl_FragCoord.xy + fract(u_time)) - 0.5) / 255.0;',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  var gl = null, U = {};
  function initGL() {
    try { gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' }); } catch (e) { gl = null; }
    if (!gl) return false;
    function sh(type, src) {
      var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.error(gl.getShaderInfoLog(s)); return null; }
      return s;
    }
    var vs = sh(gl.VERTEX_SHADER, VERT), fs = sh(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return false;
    var pr = gl.createProgram(); gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { console.error(gl.getProgramInfoLog(pr)); return false; }
    gl.useProgram(pr);
    var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(pr, 'position'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    ['u_resolution', 'u_time', 'u_speed', 'u_colorBottom', 'u_colorMid', 'u_colorTop', 'u_flat', 'u_end', 'u_z0', 'u_z1', 'u_roll0', 'u_roll1', 'u_dive', 'u_fade']
      .forEach(function (n) { U[n] = gl.getUniformLocation(pr, n); });
    return true;
  }
  var hasGL = initGL();
  if (!hasGL) { canvas.hidden = true; scene.classList.add('nogl'); }
  function resize() {
    if (!hasGL) return;
    var r = scene.getBoundingClientRect();
    var k = Math.min(window.devicePixelRatio || 1, 2) * 0.6;
    canvas.width = Math.max(2, Math.floor(r.width * k));
    canvas.height = Math.max(2, Math.floor(r.height * k));
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(U.u_resolution, canvas.width, canvas.height);
  }
  resize();
  var observer = new ResizeObserver(resize); observer.observe(scene);

  /* ---------- Chronologie de la chute (temps virtuel T, en secondes) ---------- */
  var DIVE = 2.7, FADE0 = 1.9, FADE1 = 3.1, FLIP_AT = 2.9, REPLY_AT = 3.5, SHUTTER = 0.14;
  var T = 0, vel = 0, flipped = false, replying = false, chatMode = false;
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function diveAt(t) { var x = clamp(t / DIVE, 0, 1); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  function fadeAt(t) { var x = clamp((t - FADE0) / (FADE1 - FADE0), 0, 1); return x * x * (3 - 2 * x); }
  function zoomAt(t) { return Math.exp(-5.5 * diveAt(t)); }
  function rollAt(t) { return 0.45 * diveAt(t); }

  var startMs = performance.now(), lastMs = startMs, canvasOn = true;
  function frame(now) {
    var dt = Math.min(0.25, (now - lastMs) / 1000); lastMs = now;
    // couleurs : fondu doux au changement de thème
    var a = 1 - Math.exp(-dt * 6);
    ['bottom', 'mid', 'top', 'flat', 'end'].forEach(function (k) { for (var i = 0; i < 3; i++) cur[k][i] += (PAL[theme][k][i] - cur[k][i]) * a; });

    if (vel !== 0) {
      T += vel * dt;
      if (vel < 0 && T <= 0) { T = 0; vel = 0; }
      if (vel > 0 && T >= 4) { T = 4; vel = 0; }
      if (vel > 0) {
        if (!flipped && T >= FLIP_AT) { flipped = true; goChat(); }
        if (!replying && T >= REPLY_AT) { replying = true; startReply(); }
      }
    }
    var fade = fadeAt(T);
    if (hasGL) {
      var flat = fade >= 1 && vel >= 0;
      if (flat && canvasOn) { canvas.hidden = true; canvasOn = false; }
      if (!flat) {
        if (!canvasOn) { canvas.hidden = false; canvasOn = true; }
        var Tp = clamp(T - (vel >= 0 ? 1 : -1) * SHUTTER, 0, 4);
        if (vel === 0) Tp = T;
        gl.uniform1f(U.u_time, (now - startMs) / 1000);
        gl.uniform1f(U.u_speed, 1);
        gl.uniform3fv(U.u_colorBottom, cur.bottom); gl.uniform3fv(U.u_colorMid, cur.mid); gl.uniform3fv(U.u_colorTop, cur.top); gl.uniform3fv(U.u_flat, cur.flat); gl.uniform3fv(U.u_end, cur.end);
        gl.uniform1f(U.u_z0, zoomAt(Tp)); gl.uniform1f(U.u_z1, zoomAt(T));
        gl.uniform1f(U.u_roll0, rollAt(Tp)); gl.uniform1f(U.u_roll1, rollAt(T));
        gl.uniform1f(U.u_dive, diveAt(T)); gl.uniform1f(U.u_fade, fade);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
    } else {
      veil.style.opacity = String(fade);
    }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);


  return {
    begin() { T = REDUCED ? FADE1 : 0; vel = 1; flipped = false; replying = false; },
    stop() { if (!flipped && vel > 0) vel = -1.8; },
    reset(show = true) {
      T = show ? 0 : 4; vel = 0; flipped = !show; replying = !show; chatMode = !show;
      if (hasGL && show) { canvas.style.opacity = '0'; canvas.hidden = false; canvasOn = true; void canvas.offsetWidth; canvas.style.opacity = '1'; }
      scene.classList.remove('intro'); void scene.offsetWidth; scene.classList.add('intro');
    },
    setTheme(t) { theme = t; if (initialTheme) { ['bottom', 'mid', 'top', 'flat', 'end'].forEach(k => cur[k] = PAL[t][k].slice()); initialTheme = false; } },
    dispose() { cancelAnimationFrame(raf); observer.disconnect(); if (gl) { var program = gl.getParameter(gl.CURRENT_PROGRAM); if (program) { (gl.getAttachedShaders(program) || []).forEach(shader => gl.deleteShader(shader)); gl.deleteProgram(program); } var buffer = gl.getParameter(gl.ARRAY_BUFFER_BINDING); if (buffer) gl.deleteBuffer(buffer); } }
  };
}

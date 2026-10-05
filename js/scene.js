// The 3D room: a bathroom-lounge that gets stripped and retiled stage by stage.
//   stage 0..1  old floor tiles lifted and carried to a rubble pile
//   stage 1..2  rubble cleared, floor screeded and cleaned
//   stage 2..3  shower walls and floor waterproofed
//   stage 3..4  adhesive and tiles laid, mosaic up the shower walls
//   stage 4..5  grouted, walls painted, shower fitted and polished
// Light comes in through one window: a shadowed sun beam, a sky fill and a CC0 Poly Haven HDRI.
import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const ASSETS = 'assets/3d/';
const ROOM = { x0: -2.4, x1: 2.4, z0: -2.0, z1: 2.4, h: 2.7 };
const WIN = { x0: 0.3, x1: 1.9, y0: 0.85, y1: 2.35, mull: 1.1, depth: 0.22 };
const MOSAIC_ROW = 0.1265;                            // glazed finger mosaic: 10 rows per 1.27 m texture
const SHOWER = { x1: -1.15, z1: -0.85, h: MOSAIC_ROW * 16 };  // shower corner: x0..x1 on the back wall, z0..z1 on the left
const TILE_BED = 0.008;                               // adhesive thickness under the tiles
const TILE_T = 0.01;
const TILE_TOP = TILE_BED + TILE_T;
const SUN_DIR = new THREE.Vector3(-0.45, -0.6, 0.66).normalize();  // the direction sunlight travels, into the room
const HEAP = new THREE.Vector3(1.55, 0, 1.55);

// Camera shots. from/to: the stretch of the build this shot plays. offset: push the subject right, clear of the text.
export const SHOTS = {
  hero:      { pos: [2.05, 1.32, 2.15], target: [-0.85, 0.82, -1.25], from: 5, to: 5, offset: 0.16 },
  remove:    { pos: [2.6, 3.9, 3.6], target: [-0.2, 0.0, -0.3], from: 0, to: 1, offset: 0.14 },
  prep:      { pos: [-0.3, 3.3, 3.1], target: [-0.2, 0.0, -0.5], from: 1, to: 2, offset: 0.14 },
  waterproof:{ pos: [0.55, 1.55, 1.15], target: [-2.0, 0.85, -1.55], from: 2, to: 3, offset: 0.14 },
  lay:       { pos: [1.7, 2.35, 2.05], target: [-0.7, 0.0, -0.8], from: 3, to: 4, offset: 0.14 },
  finish:    { pos: [1.95, 1.2, 2.05], target: [-1.15, 0.9, -1.35], from: 4, to: 5, offset: 0.14 },
};

export const FINISHES = {
  porcelain: { file: 'tile-porcelain.jpg', label: 'Polished porcelain', grout: 0xc9c8c3, rough: 0.09, coat: 1.0, blur: 0.4, gap: 0.002 },
  marble:    { file: 'tile-marble.jpg', label: 'Marble', grout: 0xd4d3cf, rough: 0.12, coat: 0.8, blur: 0.7, gap: 0.002 },
  stone:     { file: 'tile-stone.jpg', label: 'Charcoal stone', grout: 0x3d3e41, rough: 0.42, coat: 0.38, blur: 2.4, gap: 0.003 },
  oak:       { file: 'tile-oak.jpg', label: 'Oak-look herringbone', grout: 0x8b7a66, rough: 0.48, coat: 0.22, blur: 3.0, gap: 0.0015 },
};

export const PAINTS = {
  white: { hex: 0xe8e5de, label: 'Warm white' },
  sage:  { hex: 0xaab5a1, label: 'Sage' },
  ink:   { hex: 0x2b3a63, label: 'Ink blue' },
};

const ease = (t) => t * t * (3 - 2 * t);
const clamp01 = (t) => Math.min(1, Math.max(0, t));
const easeOutBack = (t) => { const c = 1.4; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

const NOISE = /* glsl */ `
float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float h13(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h12(i), h12(i + vec2(1, 0)), u.x), mix(h12(i + vec2(0, 1)), h12(i + vec2(1, 1)), u.x), u.y); }
float vn3(vec3 p){ vec3 i = floor(p), f = fract(p); vec3 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h13(i), h13(i + vec3(1,0,0)), u.x), mix(h13(i + vec3(0,1,0)), h13(i + vec3(1,1,0)), u.x), u.y),
             mix(mix(h13(i + vec3(0,0,1)), h13(i + vec3(1,0,1)), u.x), mix(h13(i + vec3(0,1,1)), h13(i + vec3(1,1,1)), u.x), u.y), u.z); }
`;

// ---------------------------------------------------------------- tile layouts

// Each layout is a list of tiles { x, z, rot, w, d, order } inside the room, laid from the
// back-left corner (the shower) out towards the door, the way a tiler works.
function layoutFor(name) {
  const tiles = [];
  const { x0, x1, z0, z1 } = ROOM;
  const inRoom = (x, z, r) => x + r > x0 && x - r < x1 && z + r > z0 && z - r < z1;
  const push = (x, z, rot, w, d) => {
    const r = Math.hypot(w, d) / 2;
    if (inRoom(x, z, r)) tiles.push({ x, z, rot, w, d });
  };
  if (name === 'porcelain') {
    for (let x = x0 + 0.3; x < x1 + 0.3; x += 0.6) for (let z = z0 + 0.3; z < z1 + 0.3; z += 0.6) push(x, z, 0, 0.6, 0.6);
  } else if (name === 'marble') {
    let row = 0;
    for (let z = z0 + 0.3; z < z1 + 0.3; z += 0.6, row++) {
      const shift = ((row % 3) * 0.4) - 1.2;
      for (let x = x0 + shift + 0.6; x < x1 + 0.6; x += 1.2) push(x, z, 0, 1.2, 0.6);
    }
  } else if (name === 'stone') {
    // 600 x 600 laid on the diagonal
    const sz = 0.6, a = Math.PI / 4, c = Math.cos(a), sn = Math.sin(a);
    for (let i = -12; i <= 12; i++) for (let j = -12; j <= 12; j++) {
      const u = i * sz, v = j * sz;
      push(u * c - v * sn + x0, u * sn + v * c + z0, -a, sz, sz);
    }
  } else if (name === 'oak') {
    // herringbone, 200 x 1000 planks. Pattern period vectors are (W, W) and (L + W, -(L - W)),
    // then the whole pattern is turned 45 degrees so the chevrons run down the room.
    const L = 1.0, Wd = 0.2, a = Math.PI / 4, c = Math.cos(a), sn = Math.sin(a);
    const at = (u, v) => [u * c - v * sn + x0, u * sn + v * c + z0];
    for (let m = -10; m <= 10; m++) for (let k = -36; k <= 36; k++) {
      const ou = m * (L + Wd) + k * Wd, ov = -m * (L - Wd) + k * Wd;
      push(...at(ou + L / 2, ov + Wd / 2), -a, L, Wd);
      push(...at(ou + L + Wd / 2, ov + Wd - L / 2), -a - Math.PI / 2, L, Wd);
    }
  }
  const maxD = Math.max(...tiles.map((t) => Math.hypot(t.x - x0, t.z - z0)));
  tiles.forEach((t) => { t.order = Math.hypot(t.x - x0, t.z - z0) / maxD; });
  return tiles;
}

// ---------------------------------------------------------------- scene

export function initRoomScene(container, { reducedMotion = false, lowPower = false, onReady, onProgress, onCut } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  const maxDpr = Math.min(window.devicePixelRatio, lowPower ? 1.25 : 1.75);
  let dpr = maxDpr;
  renderer.setPixelRatio(dpr);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.localClippingEnabled = true;
  container.appendChild(renderer.domElement);
  renderer.domElement.addEventListener('webglcontextlost', () => container.classList.remove('is-ready'));
  renderer.domElement.addEventListener('webglcontextrestored', () => container.classList.add('is-ready'));
  RectAreaLightUniformsLib.init();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xdfe2e6);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.03, 60);

  // Once every file is in, compile all shaders in the background (with every object switched on,
  // so nothing compiles later mid-scroll), and only then start drawing.
  let compiled = false;
  const manager = new THREE.LoadingManager(() => {
    const hidden = [];
    scene.traverse((o) => { if (!o.visible) { hidden.push(o); o.visible = true; } });
    const done = () => {
      hidden.forEach((o) => { o.visible = false; });
      lastKey = '';
      compiled = true;
      container.classList.add('is-ready');
      onReady?.();
    };
    (renderer.compileAsync ? renderer.compileAsync(scene, camera) : Promise.resolve()).then(done, done);
  }, (url, loaded, total) => onProgress?.(loaded / total));
  const texLoader = new THREE.TextureLoader(manager);
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const tex = (file, { srgb = false, repeat = [1, 1] } = {}) => {
    const t = texLoader.load(ASSETS + file);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = aniso;
    t.repeat.set(...repeat);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };

  new RGBELoader(manager).load(ASSETS + 'room-light-1k.hdr', (hdr) => {
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = hdr;
  });
  scene.environmentIntensity = 0.32;

  // things the ambient-occlusion pass should ignore (glass, light beam, reflections)
  const noAO = [];
  const clipRoom = [
    new THREE.Plane(new THREE.Vector3(1, 0, 0), -ROOM.x0), new THREE.Plane(new THREE.Vector3(-1, 0, 0), ROOM.x1),
    new THREE.Plane(new THREE.Vector3(0, 0, 1), -ROOM.z0), new THREE.Plane(new THREE.Vector3(0, 0, -1), ROOM.z1),
  ];

  const add = (geo, mat, pos = [0, 0, 0], { cast = true, receive = true, rot, parent = scene } = {}) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...pos);
    if (rot) m.rotation.set(...rot);
    m.castShadow = cast; m.receiveShadow = receive;
    parent.add(m);
    return m;
  };

  // ---------------------------------------------------------------- light
  const sun = new THREE.DirectionalLight(0xffeedd, 7.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -4.5, right: 4.5, top: 4.5, bottom: -4.5, near: 0.5, far: 16 });
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 3;
  sun.target.position.set(0, 0, 0);
  sun.position.copy(SUN_DIR).multiplyScalar(-8);
  scene.add(sun, sun.target);

  // daylight from the window opening, and a soft bounce off the sunlit floor
  const sky = new THREE.RectAreaLight(0xdbe8ff, 9, WIN.x1 - WIN.x0, WIN.y1 - WIN.y0);
  sky.position.set((WIN.x0 + WIN.x1) / 2, (WIN.y0 + WIN.y1) / 2, ROOM.z0 + 0.02);
  sky.lookAt(sky.position.x, sky.position.y, 0);
  scene.add(sky);
  const bounce = new THREE.RectAreaLight(0xffe2c4, 1.6, 2.2, 1.4);
  bounce.position.set(0.1, 0.02, -0.3);
  bounce.lookAt(0.1, 3, -0.3);
  scene.add(bounce);
  scene.add(new THREE.HemisphereLight(0xe9eef5, 0x8a8178, 0.25));

  // ---------------------------------------------------------------- walls
  const wallUniforms = {
    uPaint: { value: 0 }, uPaintA: { value: new THREE.Color(PAINTS.white.hex) }, uPaintB: { value: new THREE.Color(PAINTS.white.hex) },
    uRepaint: { value: 1 }, uOld: { value: tex('wall-old.jpg', { srgb: true }) },
  };
  const wallMat = new THREE.MeshStandardMaterial({
    map: tex('wall-plaster.jpg', { srgb: true }), normalMap: tex('wall-normal.jpg'), roughness: 0.88,
    normalScale: new THREE.Vector2(0.6, 0.6), shadowSide: THREE.DoubleSide,
  });
  wallMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, wallUniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vW;')
      .replace('#include <uv_vertex>', `#include <uv_vertex>
        vW = (modelMatrix * vec4(position, 1.0)).xyz;
        vec2 wuv = vec2(vW.x + vW.z, vW.y) / 1.6;
        vMapUv = wuv; vNormalMapUv = wuv;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vW;
        uniform float uPaint, uRepaint;
        uniform vec3 uPaintA, uPaintB;
        uniform sampler2D uOld;
        ${NOISE}`)
      .replace('#include <map_fragment>', `
        vec4 plaster = texture2D(map, vMapUv);
        float u = (vW.x - ${ROOM.x0.toFixed(2)}) + (vW.z - ${ROOM.z0.toFixed(2)});
        float edge = (vn(vec2(vW.y * 9.0, u * 2.0)) - 0.5) * 0.35 + (vn(vec2(vW.y * 40.0, 1.0)) - 0.5) * 0.08;
        float painted = 1.0 - smoothstep(-0.03, 0.03, u - uPaint * 9.6 + edge);
        float fresh = 1.0 - smoothstep(-0.03, 0.03, u - uRepaint * 9.6 + edge);
        vec3 paint = mix(uPaintA, uPaintB, fresh) * (0.86 + 0.28 * plaster.r);
        vec3 old = mix(texture2D(uOld, vMapUv * 0.8).rgb, vec3(0.62, 0.58, 0.5), 0.45);
        diffuseColor.rgb *= mix(old, paint, painted);`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(0.95, 0.82, painted);');
  };
  wallMat.customProgramCacheKey = () => 'room-wall';

  // back wall with the window opening
  const backShape = new THREE.Shape([[ROOM.x0, 0], [ROOM.x1, 0], [ROOM.x1, ROOM.h], [ROOM.x0, ROOM.h]].map(([a, b]) => new THREE.Vector2(a, b)));
  backShape.holes.push(new THREE.Path([[WIN.x0, WIN.y0], [WIN.x0, WIN.y1], [WIN.x1, WIN.y1], [WIN.x1, WIN.y0]].map(([a, b]) => new THREE.Vector2(a, b))));
  const backGeo = new THREE.ShapeGeometry(backShape);
  add(backGeo, wallMat, [0, 0, ROOM.z0]);
  const W = ROOM.x1 - ROOM.x0, D = ROOM.z1 - ROOM.z0;
  add(new THREE.PlaneGeometry(D, ROOM.h), wallMat, [ROOM.x0, ROOM.h / 2, (ROOM.z0 + ROOM.z1) / 2], { rot: [0, Math.PI / 2, 0] });
  add(new THREE.PlaneGeometry(D, ROOM.h), wallMat, [ROOM.x1, ROOM.h / 2, (ROOM.z0 + ROOM.z1) / 2], { rot: [0, -Math.PI / 2, 0] });
  add(new THREE.PlaneGeometry(W, ROOM.h), wallMat, [0, ROOM.h / 2, ROOM.z1], { rot: [0, Math.PI, 0] });
  const ceilingMat = new THREE.MeshStandardMaterial({ color: 0xf1f0ec, roughness: 0.95, shadowSide: THREE.DoubleSide });
  add(new THREE.PlaneGeometry(W, D), ceilingMat, [0, ROOM.h, (ROOM.z0 + ROOM.z1) / 2], { rot: [Math.PI / 2, 0, 0] });

  // window reveals, sill, aluminium frame, glass and the garden outside
  const revealMat = new THREE.MeshStandardMaterial({ color: 0xeceae5, roughness: 0.9, shadowSide: THREE.DoubleSide });
  const rz = ROOM.z0 - WIN.depth / 2;
  const winW = WIN.x1 - WIN.x0, winH = WIN.y1 - WIN.y0;
  add(new THREE.PlaneGeometry(WIN.depth, winH), revealMat, [WIN.x0, (WIN.y0 + WIN.y1) / 2, rz], { rot: [0, Math.PI / 2, 0] });
  add(new THREE.PlaneGeometry(WIN.depth, winH), revealMat, [WIN.x1, (WIN.y0 + WIN.y1) / 2, rz], { rot: [0, -Math.PI / 2, 0] });
  add(new THREE.PlaneGeometry(winW, WIN.depth), revealMat, [(WIN.x0 + WIN.x1) / 2, WIN.y1, rz], { rot: [Math.PI / 2, 0, 0] });
  const sillMat = new THREE.MeshPhysicalMaterial({ map: tex('tile-marble.jpg', { srgb: true, repeat: [0.4, 0.1] }), roughness: 0.18, clearcoat: 0.4 });
  add(new RoundedBoxGeometry(winW + 0.08, 0.025, WIN.depth + 0.05, 2, 0.006), sillMat, [(WIN.x0 + WIN.x1) / 2, WIN.y0 - 0.0125, rz + 0.025]);
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x2a2d32, metalness: 0.6, roughness: 0.38 });
  const fz = ROOM.z0 - WIN.depth + 0.04;
  for (const x of [WIN.x0 + 0.025, WIN.mull, WIN.x1 - 0.025]) add(new THREE.BoxGeometry(0.05, winH, 0.06), frameMat, [x, (WIN.y0 + WIN.y1) / 2, fz]);
  for (const y of [WIN.y0 + 0.025, WIN.y1 - 0.025]) add(new THREE.BoxGeometry(winW, 0.05, 0.06), frameMat, [(WIN.x0 + WIN.x1) / 2, y, fz]);
  const winGlass = add(new THREE.PlaneGeometry(winW, winH), new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.02, transparent: true, opacity: 0.12, envMapIntensity: 1.5,
  }), [(WIN.x0 + WIN.x1) / 2, (WIN.y0 + WIN.y1) / 2, fz], { cast: false, receive: false });
  noAO.push(winGlass);
  const viewTex = tex('window-view.jpg', { srgb: true });
  viewTex.wrapS = viewTex.wrapT = THREE.ClampToEdgeWrapping;
  const outside = add(new THREE.PlaneGeometry(7.5, 5.6), new THREE.MeshBasicMaterial({ map: viewTex, color: new THREE.Color(2.6, 2.6, 2.6) }),
    [1.4, 1.5, ROOM.z0 - 2.6], { cast: false, receive: false });
  noAO.push(outside);

  // ---------------------------------------------------------------- floor slab: stripped screed -> prepared screed
  const screedUniforms = { uPrep: { value: 0 }, uNew: { value: tex('screed-new.jpg', { srgb: true }) } };
  const screedMat = new THREE.MeshStandardMaterial({
    map: tex('screed-old.jpg', { srgb: true }), normalMap: tex('screed-normal.jpg'), roughness: 0.92, normalScale: new THREE.Vector2(0.8, 0.8),
  });
  screedMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, screedUniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vF;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvF = (modelMatrix * vec4(position, 1.0)).xz; vMapUv = vF / 2.2; vNormalMapUv = vF / 2.2;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec2 vF;\nuniform float uPrep;\nuniform sampler2D uNew;\n${NOISE}`)
      .replace('#include <map_fragment>', `
        float sweep = (vF.x - ${ROOM.x0.toFixed(2)}) / ${W.toFixed(2)} + (vn(vF * 3.0) - 0.5) * 0.12;
        float prepped = 1.0 - smoothstep(-0.02, 0.02, sweep - uPrep * 1.15);
        vec3 oldS = texture2D(map, vMapUv).rgb * 0.9;
        vec3 newS = texture2D(uNew, vMapUv * 1.3).rgb;
        diffuseColor.rgb *= mix(oldS, newS, prepped);`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(0.95, 0.8, prepped);');
  };
  screedMat.customProgramCacheKey = () => 'room-screed';
  add(new THREE.PlaneGeometry(W, D), screedMat, [0, 0, (ROOM.z0 + ROOM.z1) / 2], { rot: [-Math.PI / 2, 0, 0], cast: false });

  // ---------------------------------------------------------------- the old floor and its rubble
  const oldTex = tex('tile-old.jpg', { srgb: true });
  const oldMat = new THREE.MeshStandardMaterial({ map: oldTex, roughness: 0.55, clippingPlanes: clipRoom });
  instanceVariation(oldMat, 0.33 / 1.4);
  const OLD = 0.33;
  const oldTiles = [];
  for (let x = ROOM.x0 + OLD / 2; x < ROOM.x1 + OLD / 2; x += OLD) for (let z = ROOM.z0 + OLD / 2; z < ROOM.z1 + OLD / 2; z += OLD) oldTiles.push({ x, z });
  const oldMax = Math.max(...oldTiles.map((t) => Math.hypot(t.x - ROOM.x0, t.z - ROOM.z0)));
  oldTiles.forEach((t, i) => {
    t.order = Math.hypot(t.x - ROOM.x0, t.z - ROOM.z0) / oldMax * 0.85 + Math.random() * 0.15;
    t.spin = (Math.random() - 0.5) * 2.4; t.tilt = (Math.random() - 0.5) * 1.4; t.i = i;
  });
  const oldGeo = new RoundedBoxGeometry(OLD - 0.004, 0.009, OLD - 0.004, 2, 0.002);
  oldGeo.translate(0, 0.0045, 0);
  const oldMesh = new THREE.InstancedMesh(oldGeo, oldMat, oldTiles.length);
  oldMesh.castShadow = true; oldMesh.receiveShadow = true;
  const shade = new THREE.Color();
  oldTiles.forEach((t, i) => { const k = 0.82 + Math.random() * 0.2; oldMesh.setColorAt(i, shade.setRGB(k, k * 0.98, k * 0.95)); });
  scene.add(oldMesh);
  // old grout and adhesive left under the old tiles
  const oldGrout = add(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ color: 0x6f6a62, roughness: 1 }),
    [0, 0.004, (ROOM.z0 + ROOM.z1) / 2], { rot: [-Math.PI / 2, 0, 0], cast: false });

  const heapGeo = (() => {
    const g = new THREE.IcosahedronGeometry(1, 6);
    const p = g.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const n = Math.sin(v.x * 7.1 + v.z * 4.3) * 0.05 + Math.sin(v.x * 17.7 - v.z * 13.1 + v.y * 6.0) * 0.03 + Math.sin(v.z * 29.0 + v.x * 23.0) * 0.015;
      v.multiplyScalar(1 + n);
      v.y = Math.max(v.y, 0);
      p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return g;
  })();
  const heap = add(heapGeo, new THREE.MeshStandardMaterial({
    map: tex('rubble-color.jpg', { srgb: true, repeat: [2, 2] }), normalMap: tex('rubble-normal.jpg', { repeat: [2, 2] }), roughness: 1, normalScale: new THREE.Vector2(1.5, 1.5),
  }), [HEAP.x, 0, HEAP.z]);
  heap.userData.base = new THREE.Vector3(0.62, 0.34, 0.5);

  // ---------------------------------------------------------------- waterproofing + shower mosaic (one material, three layers)
  const showerUniforms = { uMembrane: { value: 0 }, uMosaic: { value: 0 }, uOld: wallUniforms.uOld };
  const showerMat = (axis) => {
    const m = new THREE.MeshPhysicalMaterial({
      map: tex('mosaic-color.jpg', { srgb: true }), normalMap: tex('mosaic-normal.jpg'), roughnessMap: tex('mosaic-rough.jpg'),
      roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.08, normalScale: new THREE.Vector2(1, 1),
    });
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, showerUniforms);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vW;')
        .replace('#include <uv_vertex>', `#include <uv_vertex>
          vW = (modelMatrix * vec4(position, 1.0)).xyz;
          vec2 suv = vec2(${axis === 'x' ? 'vW.x' : '-vW.z'}, vW.y) / 1.27 + vec2(0.0, 0.0916);
          vMapUv = suv; vNormalMapUv = suv; vRoughnessMapUv = suv;`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
          varying vec3 vW;
          uniform float uMembrane, uMosaic;
          uniform sampler2D uOld;
          ${NOISE}`)
        .replace('#include <map_fragment>', `
          float along = ${axis === 'x' ? `(vW.x - ${ROOM.x0.toFixed(2)})` : `(vW.z - ${ROOM.z0.toFixed(2)})`};
          float brush = (vn(vec2(along * 6.0, vW.y * 1.5)) - 0.5) * 0.18 + (vn(vec2(along * 30.0, vW.y * 4.0)) - 0.5) * 0.05;
          float membrane = 1.0 - smoothstep(-0.015, 0.015, vW.y - uMembrane * ${(SHOWER.h + 0.25).toFixed(2)} + brush);
          float laid = 1.0 - step(floor(uMosaic * 16.0 + 0.001) * ${MOSAIC_ROW.toFixed(4)}, vW.y);
          vec3 oldWall = mix(texture2D(uOld, vec2(vW.x + vW.z, vW.y) / 1.6 * 0.8).rgb, vec3(0.62, 0.58, 0.5), 0.45);
          float strokes = vn(vec2(along * 3.0 + vW.y * 9.0, vW.y * 2.0));
          vec3 memCol = vec3(0.25, 0.34, 0.43) * (0.8 + 0.4 * strokes) * (0.9 + 0.2 * vn(vec2(along * 55.0 + vW.y * 4.0, vW.y * 60.0)));
          vec4 mosaic = texture2D(map, vMapUv);
          vec3 base = mix(oldWall, memCol, membrane);
          diffuseColor.rgb *= mix(base, mosaic.rgb, laid);`)
        .replace('#include <normal_fragment_maps>', THREE.ShaderChunk.normal_fragment_maps.replace('mapN.xy *= normalScale;', 'mapN.xy *= normalScale * laid;'))
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(mix(0.95, 0.55, membrane), roughnessFactor, laid);')
        .replace('#include <lights_physical_fragment>', THREE.ShaderChunk.lights_physical_fragment.replace('material.clearcoat = clearcoat;', 'material.clearcoat = clearcoat * laid;'));
    };
    m.customProgramCacheKey = () => `room-shower-${axis}`;
    return m;
  };
  const shW = SHOWER.x1 - ROOM.x0, shD = SHOWER.z1 - ROOM.z0;
  add(new THREE.PlaneGeometry(shW, SHOWER.h), showerMat('x'), [ROOM.x0 + shW / 2, SHOWER.h / 2, ROOM.z0 + 0.006]);
  add(new THREE.PlaneGeometry(shD, SHOWER.h), showerMat('z'), [ROOM.x0 + 0.006, SHOWER.h / 2, ROOM.z0 + shD / 2], { rot: [0, Math.PI / 2, 0] });
  // tile edge trim where the mosaic stops
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xc9ccd0, metalness: 1, roughness: 0.25 });
  const trimA = add(new THREE.BoxGeometry(shW, 0.012, 0.012), trimMat, [ROOM.x0 + shW / 2, SHOWER.h, ROOM.z0 + 0.008]);
  const trimB = add(new THREE.BoxGeometry(0.012, 0.012, shD), trimMat, [ROOM.x0 + 0.008, SHOWER.h, ROOM.z0 + shD / 2]);
  const trimC = add(new THREE.BoxGeometry(0.012, SHOWER.h, 0.012), trimMat, [SHOWER.x1, SHOWER.h / 2, ROOM.z0 + 0.008]);
  const trimD = add(new THREE.BoxGeometry(0.012, SHOWER.h, 0.012), trimMat, [ROOM.x0 + 0.008, SHOWER.h / 2, SHOWER.z1]);
  const trims = [trimA, trimB, trimC, trimD];

  // membrane on the shower floor
  const memFloorUniforms = { uMem: { value: 0 } };
  const memFloorMat = new THREE.MeshStandardMaterial({ color: 0x46596b, roughness: 0.6, transparent: true });
  memFloorMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, memFloorUniforms);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vF;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvF = (modelMatrix * vec4(position, 1.0)).xz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec2 vF;\nuniform float uMem;\n${NOISE}`)
      .replace('#include <map_fragment>', `
        float d = length(vF - vec2(${ROOM.x0.toFixed(2)}, ${ROOM.z0.toFixed(2)})) / 1.7 + (vn(vF * 9.0) - 0.5) * 0.12;
        float cov = 1.0 - smoothstep(-0.02, 0.02, d - uMem * 1.15);
        diffuseColor.rgb *= 0.88 + 0.24 * vn(vF * vec2(14.0, 3.0));
        diffuseColor.a = cov;
        if (cov < 0.01) discard;`);
  };
  const memFloor = add(new THREE.PlaneGeometry(shW + 0.02, shD + 0.02), memFloorMat, [ROOM.x0 + shW / 2, 0.0035, ROOM.z0 + shD / 2], { rot: [-Math.PI / 2, 0, 0], cast: false });

  // ---------------------------------------------------------------- floor finishes
  const adhesiveMat = new THREE.MeshStandardMaterial({
    map: tex('adhesive-color.jpg', { srgb: true }), normalMap: tex('adhesive-normal.jpg'), roughness: 0.9, normalScale: new THREE.Vector2(1.4, 1.4),
    clippingPlanes: clipRoom,
  });
  const groutMat = new THREE.MeshStandardMaterial({ color: FINISHES.porcelain.grout, roughness: 0.85 });
  const grout = add(new THREE.PlaneGeometry(W, D), groutMat, [0, TILE_BED, (ROOM.z0 + ROOM.z1) / 2], { rot: [-Math.PI / 2, 0, 0], cast: false });

  const spacerMat = new THREE.MeshStandardMaterial({ color: 0xe14b3b, roughness: 0.55 });
  const spacerGeo = (() => {
    const a = new THREE.BoxGeometry(0.03, 0.006, 0.0022), b = new THREE.BoxGeometry(0.0022, 0.006, 0.03);
    const g = new THREE.BufferGeometry();
    const merge = [a, b].map((x) => x.toNonIndexed());
    const pos = new Float32Array(merge[0].attributes.position.array.length * 2);
    pos.set(merge[0].attributes.position.array); pos.set(merge[1].attributes.position.array, merge[0].attributes.position.array.length);
    const nor = new Float32Array(pos.length);
    nor.set(merge[0].attributes.normal.array); nor.set(merge[1].attributes.normal.array, merge[0].attributes.normal.array.length);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    return g;
  })();

  function instanceVariation(mat, scale, scaleY = scale) {
    // every tile samples its own window of the slab texture, so no two tiles repeat
    const uSlab = { value: new THREE.Vector2(scale, scaleY) };
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uSlab = uSlab;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform vec2 uSlab;').replace('#include <uv_vertex>', `#include <uv_vertex>
        #ifdef USE_INSTANCING
          vec3 ic = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          vec2 off = fract(sin(vec2(dot(ic.xz, vec2(12.9898, 78.233)), dot(ic.xz, vec2(39.346, 11.135)))) * 43758.5453);
          vec2 sc = uSlab;
          #ifdef USE_MAP
            vMapUv = uv * sc + off * (1.0 - sc);
          #endif
        #endif`);
    };
    mat.customProgramCacheKey = () => 'tiles';
    return mat;
  }

  const sets = {};
  function buildSet(name) {
    if (sets[name]) return sets[name];
    const f = FINISHES[name];
    const tiles = layoutFor(name);
    const { w, d } = tiles[0];
    const slab = name === 'oak' ? [w / 1.4, d / 1.4] : [w / 2.4, d / 2.4];
    const mat = instanceVariation(new THREE.MeshPhysicalMaterial({
      map: tex(f.file, { srgb: true }), roughness: f.rough, clearcoat: name === 'oak' || name === 'stone' ? 0 : 0.5,
      clearcoatRoughness: 0.05, clippingPlanes: clipRoom, envMapIntensity: 0.8,
    }), slab[0], slab[1]);
    const geo = new RoundedBoxGeometry(w - f.gap, TILE_T, d - f.gap, 2, Math.min(0.0025, f.gap));
    geo.translate(0, TILE_T / 2, 0);
    const mesh = new THREE.InstancedMesh(geo, mat, tiles.length);
    mesh.receiveShadow = true; mesh.castShadow = true;
    tiles.forEach((t, i) => {
      const k = 0.965 + Math.random() * 0.05;
      mesh.setColorAt(i, shade.setRGB(k, k, k));
      t.wob = [(Math.random() - 0.5) * 0.0012, (Math.random() - 0.5) * 0.0012];
    });
    const glueGeo = new THREE.PlaneGeometry(w - 0.03, d - 0.03);
    glueGeo.rotateX(-Math.PI / 2);
    const glue = new THREE.InstancedMesh(glueGeo, adhesiveMat, tiles.length);
    glue.receiveShadow = true;
    let spacers = null, corners = [];
    if (name !== 'oak' && name !== 'stone') {
      for (const t of tiles) corners.push([t.x - t.w / 2, t.z - t.d / 2, t.order]);
      spacers = new THREE.InstancedMesh(spacerGeo, spacerMat, corners.length);
      spacers.castShadow = true;
      scene.add(spacers);
    }
    scene.add(mesh, glue);
    sets[name] = { name, f, tiles, mesh, glue, spacers, corners, lay: -1, glueOn: -1, spacerOn: -1 };
    return sets[name];
  }

  const dummy = new THREE.Object3D();
  // lay: 0..1 how far through the floor the tiler is. glueLead: how far ahead the adhesive runs.
  function setLay(set, lay, { glue = true, spacers = 1 } = {}) {
    if (set.lay === lay && set.glueOn === glue && set.spacerOn === spacers) return;
    set.lay = lay; set.glueOn = glue; set.spacerOn = spacers;
    set.tiles.forEach((t, i) => {
      const p = lay * 1.18 - t.order;
      const kg = glue && lay > 0 ? ease(clamp01(p / 0.06 + 1)) : 0;
      const kt = clamp01((p - 0.02) / 0.14);
      dummy.position.set(t.x, TILE_BED * 0.5, t.z);
      dummy.rotation.set(0, t.rot, 0);
      dummy.scale.set(kg < 0.001 ? 0.0001 : kg, 1, kg < 0.001 ? 0.0001 : 1);
      dummy.updateMatrix();
      set.glue.setMatrixAt(i, dummy.matrix);
      const e = ease(kt);
      dummy.position.set(t.x, TILE_BED + (1 - e) * 0.22, t.z);
      dummy.rotation.set((1 - e) * 0.35 + t.wob[0] * e, t.rot, t.wob[1] * e);
      dummy.scale.setScalar(kt < 0.001 ? 0.0001 : 1);
      dummy.updateMatrix();
      set.mesh.setMatrixAt(i, dummy.matrix);
    });
    set.glue.instanceMatrix.needsUpdate = true;
    set.mesh.instanceMatrix.needsUpdate = true;
    if (set.spacers) {
      set.corners.forEach(([x, z, o], i) => {
        const on = clamp01((lay * 1.18 - o - 0.12) / 0.05) * spacers;
        dummy.position.set(x, TILE_BED + 0.003 + (1 - spacers) * 0.0, z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(on < 0.01 ? 0.0001 : 1);
        dummy.updateMatrix();
        set.spacers.setMatrixAt(i, dummy.matrix);
      });
      set.spacers.instanceMatrix.needsUpdate = true;
    }
  }
  const hideSet = (set) => { set.mesh.visible = set.glue.visible = false; if (set.spacers) set.spacers.visible = false; };
  const showSet = (set) => { set.mesh.visible = set.glue.visible = true; if (set.spacers) set.spacers.visible = true; };

  // ---------------------------------------------------------------- polished-floor reflection
  const COAT_SHADER = {
    name: 'FloorCoat',
    uniforms: {
      color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null },
      uStrength: { value: 0 }, uBlur: { value: 0.5 },
    },
    vertexShader: /* glsl */ `
      uniform mat4 textureMatrix;
      varying vec4 vUv;
      varying vec3 vWorld;
      void main(){
        vUv = textureMatrix * vec4(position, 1.0);
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse;
      uniform float uStrength, uBlur;
      varying vec4 vUv;
      varying vec3 vWorld;
      void main(){
        vec3 V = normalize(cameraPosition - vWorld);
        float F = 0.045 + 0.955 * pow(1.0 - max(V.y, 0.0), 5.0);
        vec2 uv = vUv.xy / vUv.w;
        vec2 px = uBlur / vec2(textureSize(tDiffuse, 0));
        vec3 r = texture2D(tDiffuse, uv).rgb * 0.36;
        r += texture2D(tDiffuse, uv + px * vec2( 1.5,  0.5)).rgb * 0.16;
        r += texture2D(tDiffuse, uv + px * vec2(-1.5, -0.5)).rgb * 0.16;
        r += texture2D(tDiffuse, uv + px * vec2(-0.5,  1.5)).rgb * 0.16;
        r += texture2D(tDiffuse, uv + px * vec2( 0.5, -1.5)).rgb * 0.16;
        float a = clamp(F * uStrength, 0.0, 1.0);
        gl_FragColor = vec4(r * a, a);
      }`,
  };
  const coat = new Reflector(new THREE.PlaneGeometry(W, D), {
    textureWidth: 512, textureHeight: 512, clipBias: 0.002, shader: COAT_SHADER, multisample: 0,
  });
  coat.rotation.x = -Math.PI / 2;
  coat.position.set(0, TILE_TOP + 0.0006, (ROOM.z0 + ROOM.z1) / 2);
  Object.assign(coat.material, { transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor });
  scene.add(coat);
  noAO.push(coat);
  const cu = coat.material.uniforms;

  // ---------------------------------------------------------------- shower fittings and glass
  const chrome = new THREE.MeshStandardMaterial({ color: 0xe8eaec, metalness: 1, roughness: 0.08 });
  const blackSteel = new THREE.MeshStandardMaterial({ color: 0x1d1f22, metalness: 0.7, roughness: 0.35 });
  const fittings = new THREE.Group();
  scene.add(fittings);
  const sx = -1.82, sz = -1.45;
  add(new THREE.CylinderGeometry(0.012, 0.012, 0.42, 20), chrome, [ROOM.x0 + 0.21, 2.2, sz], { rot: [0, 0, Math.PI / 2], parent: fittings });
  add(new THREE.CylinderGeometry(0.14, 0.14, 0.012, 48), chrome, [ROOM.x0 + 0.42, 2.18, sz], { parent: fittings });
  add(new THREE.CylinderGeometry(0.035, 0.035, 0.02, 32), chrome, [ROOM.x0 + 0.01, 2.2, sz], { rot: [0, 0, Math.PI / 2], parent: fittings });
  add(new RoundedBoxGeometry(0.012, 0.22, 0.14, 2, 0.004), chrome, [ROOM.x0 + 0.012, 1.1, sz], { parent: fittings });
  add(new THREE.CylinderGeometry(0.022, 0.026, 0.05, 28), chrome, [ROOM.x0 + 0.04, 1.12, sz], { rot: [0, 0, Math.PI / 2], parent: fittings });
  add(new THREE.BoxGeometry(0.075, 0.012, 0.012), chrome, [ROOM.x0 + 0.1, 1.15, sz], { parent: fittings });
  add(new THREE.BoxGeometry(0.85, 0.004, 0.07), chrome, [(ROOM.x0 + SHOWER.x1) / 2 - 0.05, TILE_TOP + 0.001, ROOM.z0 + 0.12], { parent: fittings, cast: false });
  // fixed glass screen with a slim black profile and a support bar
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xf2faf7, metalness: 0, roughness: 0.02, transmission: 1, thickness: 0.008, ior: 1.5, transparent: true, envMapIntensity: 1.4,
  });
  const gx = SHOWER.x1, gLen = 1.05, gH = 2.0;
  const glass = add(new THREE.BoxGeometry(0.008, gH, gLen), glassMat, [gx, TILE_TOP + gH / 2, ROOM.z0 + gLen / 2], { cast: false, receive: false, parent: fittings });
  noAO.push(glass);
  add(new THREE.BoxGeometry(0.022, gH, 0.022), blackSteel, [gx, TILE_TOP + gH / 2, ROOM.z0 + 0.011], { parent: fittings });
  add(new THREE.BoxGeometry(0.022, 0.012, gLen), blackSteel, [gx, TILE_TOP + 0.006, ROOM.z0 + gLen / 2], { parent: fittings });
  add(new THREE.CylinderGeometry(0.008, 0.008, Math.abs(gx - ROOM.x0), 12), blackSteel, [(gx + ROOM.x0) / 2, TILE_TOP + gH - 0.02, ROOM.z0 + gLen - 0.02], { rot: [0, 0, Math.PI / 2], parent: fittings });

  // ---------------------------------------------------------------- the tiler's tools
  const tools = new THREE.Group();
  scene.add(tools);
  const bucketProfile = [[0, 0], [0.13, 0], [0.135, 0.01], [0.16, 0.3], [0.168, 0.305], [0.168, 0.318], [0.155, 0.318], [0.148, 0.31], [0.122, 0.012], [0, 0.012]].map(([a, b]) => new THREE.Vector2(a, b));
  const bucketMat = new THREE.MeshStandardMaterial({ color: 0x1f2c57, roughness: 0.45, side: THREE.DoubleSide });
  const bucket = add(new THREE.LatheGeometry(bucketProfile, 48), bucketMat, [1.45, 0, 0.35], { parent: tools });
  add(new THREE.CylinderGeometry(0.145, 0.145, 0.01, 40), new THREE.MeshStandardMaterial({ map: tex('adhesive-color.jpg', { srgb: true }), normalMap: tex('adhesive-normal.jpg'), roughness: 0.9 }),
    [1.45, 0.23, 0.35], { parent: tools });
  add(new THREE.TorusGeometry(0.16, 0.004, 8, 40, Math.PI), new THREE.MeshStandardMaterial({ color: 0xb8bcc0, metalness: 1, roughness: 0.3 }), [1.45, 0.31, 0.35], { rot: [0, 0.4, 0.5], parent: tools });
  // notched trowel: steel blade, navy handle (as in the logo)
  const trowel = new THREE.Group();
  trowel.position.set(1.05, TILE_BED, 0.55); trowel.rotation.y = 0.6;
  tools.add(trowel);
  const steel = new THREE.MeshStandardMaterial({ color: 0xd3d6d9, metalness: 1, roughness: 0.22 });
  const bladeShape = new THREE.Shape();
  bladeShape.moveTo(-0.14, -0.06);
  for (let i = 0; i <= 14; i++) { const x = -0.14 + i * 0.02; bladeShape.lineTo(x, -0.06); bladeShape.lineTo(x + 0.01, -0.052); }
  bladeShape.lineTo(0.14, 0.06); bladeShape.lineTo(-0.14, 0.06); bladeShape.closePath();
  const blade = new THREE.ExtrudeGeometry(bladeShape, { depth: 0.0015, bevelEnabled: false });
  blade.rotateX(-Math.PI / 2);
  add(blade, steel, [0, 0.002, 0], { parent: trowel });
  add(new THREE.BoxGeometry(0.02, 0.03, 0.012), steel, [0, 0.016, 0], { parent: trowel });
  add(new RoundedBoxGeometry(0.13, 0.03, 0.035, 3, 0.012), new THREE.MeshStandardMaterial({ color: 0x1f2c57, roughness: 0.5 }), [0, 0.045, 0], { parent: trowel });
  // spirit level
  const level = new THREE.Group();
  level.position.set(0.45, TILE_TOP, 0.95); level.rotation.y = -0.25;
  tools.add(level);
  add(new THREE.BoxGeometry(1.0, 0.055, 0.028), new THREE.MeshStandardMaterial({ color: 0xc8a24a, metalness: 0.5, roughness: 0.35 }), [0, 0.0275, 0], { parent: level });
  add(new THREE.BoxGeometry(0.08, 0.02, 0.03), new THREE.MeshPhysicalMaterial({ color: 0x9be37a, transmission: 0.6, roughness: 0.1, emissive: 0x335a1c, emissiveIntensity: 0.2 }), [0, 0.034, 0], { parent: level });

  // ---------------------------------------------------------------- sun beam: ray-marched through the window
  const beamUniforms = {
    uTime: { value: 0 }, uDust: { value: 1 }, uSunDir: { value: SUN_DIR }, uStrength: { value: 0.065 },
    uMin: { value: new THREE.Vector3() }, uMax: { value: new THREE.Vector3() },
  };
  const BEAM_GLSL = /* glsl */ `
    uniform vec3 uSunDir;
    float inBeam(vec3 p){
      if (p.y < 0.0 || p.x < ${ROOM.x0.toFixed(2)} || p.x > ${ROOM.x1.toFixed(2)} || p.z > ${ROOM.z1.toFixed(2)} || p.z < ${ROOM.z0.toFixed(2)}) return 0.0;
      float t = (p.z - ${ROOM.z0.toFixed(2)}) / uSunDir.z;
      vec3 q = p - uSunDir * t;
      vec2 e = min(q.xy - vec2(${(WIN.x0 + 0.05).toFixed(3)}, ${(WIN.y0 + 0.05).toFixed(3)}), vec2(${(WIN.x1 - 0.05).toFixed(3)}, ${(WIN.y1 - 0.05).toFixed(3)}) - q.xy);
      float inside = smoothstep(0.0, 0.03, min(e.x, e.y));
      inside *= smoothstep(0.02, 0.05, abs(q.x - ${WIN.mull.toFixed(3)}));
      return inside * exp(-t * 0.18);
    }`;
  const beamMat = new THREE.ShaderMaterial({
    uniforms: beamUniforms, transparent: true, depthWrite: false, depthTest: false, side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      varying vec3 vW;
      uniform float uTime, uDust, uStrength;
      uniform vec3 uMin, uMax;
      ${NOISE}
      ${BEAM_GLSL}
      void main(){
        vec3 ro = cameraPosition, rd = normalize(vW - ro);
        vec3 t0 = (uMin - ro) / rd, t1 = (uMax - ro) / rd;
        vec3 tmin = min(t0, t1), tmax = max(t0, t1);
        float tn = max(max(tmin.x, tmin.y), max(tmin.z, 0.0));
        float tf = min(min(tmax.x, tmax.y), tmax.z);
        if (tf <= tn) discard;
        const int STEPS = 28;
        float dt = (tf - tn) / float(STEPS);
        float t = tn + dt * h12(gl_FragCoord.xy + fract(uTime) * 61.0);
        float acc = 0.0;
        for (int i = 0; i < STEPS; i++) {
          vec3 p = ro + rd * t;
          float b = inBeam(p);
          if (b > 0.0) {
            float n = vn3(p * 2.2 + vec3(0.0, uTime * 0.04, uTime * 0.03)) * 0.6 + vn3(p * 7.0 - uTime * 0.05) * 0.4;
            acc += b * (0.55 + n * 0.9 * uDust) * dt;
          }
          t += dt;
        }
        vec3 col = vec3(1.0, 0.9, 0.76) * acc * uStrength * (0.7 + 0.6 * uDust);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  // the beam's bounding box: the window projected down to the floor
  const corners = [[WIN.x0, WIN.y0], [WIN.x1, WIN.y0], [WIN.x0, WIN.y1], [WIN.x1, WIN.y1]].flatMap(([x, y]) => {
    const t = y / -SUN_DIR.y;
    return [new THREE.Vector3(x, y, ROOM.z0), new THREE.Vector3(x + SUN_DIR.x * t, 0, ROOM.z0 + SUN_DIR.z * t)];
  });
  const bb = new THREE.Box3().setFromPoints(corners);
  bb.min.x = Math.max(bb.min.x, ROOM.x0); bb.max.x = Math.min(bb.max.x, ROOM.x1); bb.min.y = 0.001;
  beamUniforms.uMin.value.copy(bb.min); beamUniforms.uMax.value.copy(bb.max);
  const beamSize = bb.getSize(new THREE.Vector3()), beamCenter = bb.getCenter(new THREE.Vector3());
  const beam = new THREE.Mesh(new THREE.BoxGeometry(beamSize.x, beamSize.y, beamSize.z), beamMat);
  beam.position.copy(beamCenter);
  beam.renderOrder = 10;
  beam.frustumCulled = false;
  scene.add(beam);
  noAO.push(beam);

  // dust motes that only sparkle inside the beam
  const DUST = 700;
  const dustPos = new Float32Array(DUST * 3), dustSeed = new Float32Array(DUST);
  for (let i = 0; i < DUST; i++) {
    dustPos[i * 3] = THREE.MathUtils.lerp(bb.min.x, bb.max.x, Math.random());
    dustPos[i * 3 + 1] = THREE.MathUtils.lerp(0.05, ROOM.h - 0.2, Math.random());
    dustPos[i * 3 + 2] = THREE.MathUtils.lerp(bb.min.z, bb.max.z, Math.random());
    dustSeed[i] = Math.random();
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  dustGeo.setAttribute('seed', new THREE.BufferAttribute(dustSeed, 1));
  const dustMat = new THREE.ShaderMaterial({
    uniforms: { ...beamUniforms, uPx: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute float seed;
      uniform float uTime, uPx;
      varying float vB;
      ${BEAM_GLSL}
      void main(){
        vec3 p = position;
        p += vec3(sin(uTime * 0.11 + seed * 40.0), sin(uTime * 0.07 + seed * 17.0) * 0.6 - 0.15 * fract(uTime * 0.01 + seed), cos(uTime * 0.09 + seed * 23.0)) * 0.18;
        vec4 w = modelMatrix * vec4(p, 1.0);
        vB = inBeam(w.xyz) * (0.4 + 0.6 * pow(0.5 + 0.5 * sin(uTime * (0.6 + seed) + seed * 50.0), 3.0));
        vec4 mv = viewMatrix * w;
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uPx * (1.2 + seed * 2.2) * (1.6 / -mv.z);
      }`,
    fragmentShader: /* glsl */ `
      varying float vB;
      uniform float uDust;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d) * vB * uDust;
        if (a < 0.003) discard;
        gl_FragColor = vec4(vec3(1.0, 0.93, 0.8) * a * 1.4, a);
      }`,
  });
  const dust = new THREE.Points(dustGeo, dustMat);
  dust.frustumCulled = false;
  scene.add(dust);

  // ---------------------------------------------------------------- post: AO, bloom, tone mapping
  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  let gtao = null;
  if (!lowPower) {
    gtao = new GTAOPass(scene, camera, 1, 1);
    gtao.updateGtaoMaterial({ radius: 0.32, distanceExponent: 1.4, thickness: 1.2, scale: 1.15, samples: 12 });
    gtao.blendIntensity = 0.95;
    const ov = gtao.overrideVisibility.bind(gtao);
    gtao.overrideVisibility = () => { ov(); noAO.forEach((o) => { o.visible = false; }); };
    composer.addPass(gtao);
  }
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.28, 0.55, 0.95);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // ---------------------------------------------------------------- build state
  let finish = 'porcelain', paint = 'white';
  for (const name of Object.keys(FINISHES)) if (name !== finish) hideSet(buildSet(name));
  let current = buildSet(finish);
  const swap = { from: null, t: 1 };
  const groutCol = new THREE.Color(FINISHES[finish].grout), groutFrom = new THREE.Color();
  let repaint = 1;
  let lastKey = '';

  function applyStage(st) {
    const pRemove = clamp01(st), pPrep = clamp01(st - 1), pWater = clamp01(st - 2), pLay = clamp01(st - 3), pFin = clamp01(st - 4);

    // old tiles: lifted in order and carried to the rubble pile
    oldMesh.visible = pRemove < 1;
    if (oldMesh.visible) {
      oldTiles.forEach((t) => {
        const k = clamp01((pRemove * 1.35 - t.order) / 0.35);
        if (k <= 0) {
          dummy.position.set(t.x, 0.006, t.z); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(1);
        } else if (k >= 1) {
          dummy.scale.setScalar(0.0001);
        } else {
          const lift = ease(clamp01(k / 0.3));
          const fly = ease(clamp01((k - 0.25) / 0.75));
          const arc = Math.sin(fly * Math.PI) * 0.55;
          dummy.position.set(THREE.MathUtils.lerp(t.x, HEAP.x, fly), 0.006 + lift * 0.05 + arc + fly * 0.2, THREE.MathUtils.lerp(t.z, HEAP.z, fly));
          dummy.rotation.set(lift * t.tilt * 0.4 + fly * t.tilt, fly * t.spin, lift * 0.25);
          dummy.scale.setScalar(Math.max(1 - fly * 0.85, 0.0001));
        }
        dummy.updateMatrix();
        oldMesh.setMatrixAt(t.i, dummy.matrix);
      });
      oldMesh.instanceMatrix.needsUpdate = true;
    }
    oldGrout.visible = pRemove < 0.98;
    const hk = ease(clamp01(pRemove / 0.9)) * (1 - ease(clamp01((st - 1.05) / 0.5)));
    heap.visible = hk > 0.002;
    heap.scale.copy(heap.userData.base).multiplyScalar(Math.max(hk, 0.0001));

    screedUniforms.uPrep.value = ease(clamp01((pPrep - 0.25) / 0.75));
    memFloorUniforms.uMem.value = clamp01(pWater / 0.35);
    memFloor.visible = pWater > 0.001 && pLay < 0.5;
    showerUniforms.uMembrane.value = ease(clamp01((pWater - 0.2) / 0.8));
    showerUniforms.uMosaic.value = clamp01(pLay / 0.85);
    trims.forEach((m) => { m.visible = pLay > 0.85; });

    // floor tiles (the current finish), with adhesive running just ahead
    if (swap.from && st < 4.2) { hideSet(swap.from); swap.from = null; swap.t = 1; groutCol.set(FINISHES[finish].grout); }
    const spacersOn = 1 - clamp01(pFin / 0.15);
    if (swap.t >= 1) setLay(current, pLay, { glue: pFin < 0.2, spacers: spacersOn });
    current.glue.visible = pFin < 0.2;
    if (current.spacers) current.spacers.visible = spacersOn > 0.001 && pLay > 0;

    grout.visible = pFin > 0.02;
    grout.position.y = TILE_BED + ease(clamp01((pFin - 0.05) / 0.25)) * (TILE_T - 0.0025);
    wallUniforms.uPaint.value = ease(clamp01((pFin - 0.15) / 0.65));
    const fit = ease(clamp01((pFin - 0.6) / 0.4));
    fittings.visible = fit > 0.002;
    fittings.position.y = (1 - fit) * 0.04;
    glassMat.opacity = fit;
    tools.visible = pLay > 0.02 && pFin < 0.25;
    tools.position.y = 0;
    tools.scale.setScalar(Math.max(ease(clamp01(pLay / 0.15)) * (1 - ease(clamp01(pFin / 0.25))), 0.0001));

    beamUniforms.uDust.value = 1 + 0.7 * (1 - clamp01((st - 1.4) / 0.6)) * clamp01(st / 0.15 + 0.4);
  }

  // ---------------------------------------------------------------- sizing
  let offsetFrac = 0, curOffset = 0, curOffsetY = 0;
  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h);
    composer.setPixelRatio(dpr);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.fov = w / h < 0.8 ? 62 : w / h < 1.2 ? 52 : 42;
    camera.updateProjectionMatrix();
    coat.getRenderTarget().setSize(Math.round(w * dpr * 0.5), Math.round(h * dpr * 0.5));
    dustMat.uniforms.uPx.value = h * dpr / 600;
  }
  new ResizeObserver(resize).observe(container);
  resize();

  // ---------------------------------------------------------------- camera and stage
  const wide = () => container.clientWidth / container.clientHeight > 1.1;
  const cur = { pos: new THREE.Vector3(...SHOTS.hero.pos), target: new THREE.Vector3(...SHOTS.hero.target) };
  const goal = { pos: cur.pos.clone(), target: cur.target.clone(), to: 5 };
  let stage = 5, cutting = false;
  function setShot(name) {
    const s = SHOTS[name] || SHOTS.hero;
    goal.pos.set(...s.pos); goal.target.set(...s.target); goal.to = s.to;
    offsetFrac = s.offset;
    const outside = stage < s.from - 0.02 || stage > s.to + 0.02;
    if (reducedMotion) { cur.pos.copy(goal.pos); cur.target.copy(goal.target); stage = s.to; return; }
    if (outside) {
      // jump back to the start of this part of the job behind a quick fade
      cutting = true;
      onCut?.(true);
      setTimeout(() => {
        stage = s.from; cur.pos.copy(goal.pos).add(new THREE.Vector3(0.25, 0.15, 0.25)); cur.target.copy(goal.target);
        onCut?.(false);
        cutting = false;
      }, 260);
    }
  }

  function setFinish(name) {
    if (!FINISHES[name] || name === finish) return;
    const next = buildSet(name);
    groutFrom.copy(groutCol);
    if (swap.from) { hideSet(swap.from); swap.from = null; swap.t = 1; }
    if (stage >= 4.2 && !reducedMotion) {
      swap.from = current; swap.t = 0;
    } else {
      hideSet(current);
    }
    current = next; finish = name;
    showSet(current);
    current.lay = -1;
    if (swap.t >= 1) { setLay(current, clamp01(stage - 3), { glue: stage < 4.2, spacers: 1 - clamp01((stage - 4) / 0.15) }); groutCol.set(FINISHES[name].grout); }
    lastKey = '';
  }
  function setPaint(name) {
    if (!PAINTS[name] || name === paint) return;
    wallUniforms.uPaintA.value.copy(wallUniforms.uPaintB.value);
    wallUniforms.uPaintB.value.set(PAINTS[name].hex);
    paint = name;
    repaint = reducedMotion ? 1 : 0;
  }

  const pointer = new THREE.Vector2();
  window.addEventListener('pointermove', (e) => {
    pointer.set(e.clientX / window.innerWidth - 0.5, e.clientY / window.innerHeight - 0.5);
  }, { passive: true });

  let visible = false, time = 0, prev = performance.now(), slowAvg = 1 / 60, frames = 0;
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; }, { rootMargin: '100px' }).observe(container);
  const sway = new THREE.Vector3(), par = new THREE.Vector2();
  applyStage(stage);

  function frame(now) {
    requestAnimationFrame(frame);
    tick(now);
  }
  function tick(now) {
    const dt = Math.min((now - prev) / 1000, 0.1); prev = now;
    if (!visible || !compiled) return;
    if (!reducedMotion) time += dt;

    const k = 1 - Math.exp(-dt * 1.7);
    cur.pos.lerp(goal.pos, k);
    cur.target.lerp(goal.target, k);
    // the job runs at a steady working pace so each step is seen happening
    if (!cutting) {
      const ds = goal.to - stage;
      if (Math.abs(ds) > 1e-4) stage += Math.sign(ds) * Math.min(Math.abs(ds), dt * (ds > 0 ? 0.3 : 1.2));
    }

    // swapping finishes: old tiles lift away as the new ones go down
    if (swap.t < 1) {
      swap.t = Math.min(1, swap.t + dt / 2.6);
      const a = ease(clamp01(swap.t / 0.55)), b = ease(clamp01((swap.t - 0.3) / 0.7));
      setLay(swap.from, 1 - a, { glue: false, spacers: 0 });
      setLay(current, b, { glue: false, spacers: 0 });
      swap.from.mesh.visible = a < 1;
      groutCol.lerpColors(groutFrom, new THREE.Color(FINISHES[finish].grout), b);
      if (swap.t >= 1) { hideSet(swap.from); swap.from = null; }
    }
    groutMat.color.copy(groutCol);
    if (repaint < 1) repaint = Math.min(1, repaint + dt / 2.2);
    wallUniforms.uRepaint.value = ease(repaint);

    const key = `${stage.toFixed(4)}|${swap.t.toFixed(3)}`;
    if (key !== lastKey) { applyStage(stage); lastKey = key; }

    // the polished-floor reflection only shows on a finished, settled floor
    const settled = clamp01((stage - 4.4) / 0.6) * (swap.t < 1 ? Math.abs(swap.t - 0.5) * 2 : 1);
    cu.uStrength.value = settled * FINISHES[finish].coat;
    cu.uBlur.value = FINISHES[finish].blur;
    coat.visible = cu.uStrength.value > 0.01;

    const s = reducedMotion ? 0 : 1;
    par.lerp(pointer, 1 - Math.exp(-dt * 3));
    camera.position.copy(cur.pos).add(sway.set(Math.sin(time * 0.17) * 0.05 * s + par.x * 0.22 * s, Math.sin(time * 0.13) * 0.03 * s - par.y * 0.1 * s, 0));
    camera.lookAt(cur.target);

    const isWide = wide();
    const want = isWide ? offsetFrac : 0.13, wantY = isWide ? 0 : 0.24;
    curOffset += (want - curOffset) * k;
    curOffsetY += (wantY - curOffsetY) * k;
    const w = container.clientWidth, h = container.clientHeight;
    if (Math.abs(curOffset) + Math.abs(curOffsetY) > 0.002) camera.setViewOffset(w, h, -w * curOffset, h * curOffsetY, w, h); else camera.clearViewOffset();

    beamUniforms.uTime.value = time;
    composer.render(dt);

    // keep integrated GPUs and phones smooth: first drop the AO pass, then resolution
    slowAvg = slowAvg * 0.95 + dt * 0.05;
    if (++frames % 90 === 0) {
      if (slowAvg > 1 / 34 && gtao?.enabled) gtao.enabled = false;
      else if (slowAvg > 1 / 34 && dpr > 0.7) { dpr = Math.max(0.7, dpr - 0.15); renderer.setPixelRatio(dpr); resize(); }
      else if (slowAvg < 1 / 57 && dpr < maxDpr) { dpr = Math.min(maxDpr, dpr + 0.1); renderer.setPixelRatio(dpr); resize(); }
    }
  }
  requestAnimationFrame(frame);

  return {
    setShot, setFinish, setPaint,
    _debug: { scene, camera, renderer, composer, get stage() { return stage; }, set stage(v) { stage = v; }, cur, goal, step: (n = 60) => { for (let i = 0; i < n; i++) tick(prev + 16.7); } },
  };
}

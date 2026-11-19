import * as T from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { film } from './config.mjs';
import { drawCallout } from './hybrid-overlay.js';

const canvas = document.querySelector('#film');
const params = new URLSearchParams(location.search);
const hybrid = params.get('hybrid') === '1';
const output = hybrid ? canvas.getContext('2d') : null;
const renderer = new T.WebGLRenderer({
  canvas: hybrid ? document.createElement('canvas') : canvas,
  powerPreference: 'high-performance', preserveDrawingBuffer: true,
});
const capAnchor = new T.Vector3();
renderer.outputColorSpace = T.SRGBColorSpace;
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = .94;

const scene = new T.Scene();
scene.background = new T.Color('#090f1a');
scene.fog = new T.FogExp2('#101b28', .038);
const camera = new T.PerspectiveCamera(36, 16 / 9, .12, 85);
const pmrem = new T.PMREMGenerator(renderer);
const room = new RoomEnvironment();
scene.environment = pmrem.fromScene(room, .035).texture;
scene.environmentIntensity = .68;
room.dispose();
pmrem.dispose();

const shell = new T.MeshStandardMaterial({ color: '#647589', roughness: .28, metalness: .79 });
const charcoal = new T.MeshStandardMaterial({ color: '#25313d', roughness: .43, metalness: .57 });
const collar = new T.MeshStandardMaterial({ color: '#b6784b', roughness: .31, metalness: .71 });
const porcelain = new T.MeshStandardMaterial({ color: '#93a5b8', roughness: .36, metalness: .25 });
const cyan = new T.MeshStandardMaterial({
  color: '#74ddfe', roughness: .22, metalness: .19, emissive: '#38baf1', emissiveIntensity: 1.1,
});
const amber = new T.MeshStandardMaterial({ color: '#ffa757', emissive: '#db6123', emissiveIntensity: 1.06 });

function mesh(geometry, material, parent = scene, position = [0, 0, 0]) {
  const result = new T.Mesh(geometry, material);
  result.position.set(...position);
  parent.add(result);
  return result;
}

function profile(points, material, parent) {
  return mesh(new T.LatheGeometry(points.map(point => new T.Vector2(...point)), 96), material, parent);
}

const platform = new T.Group();
scene.add(platform);
profile([[0,.006],[2.47,.006],[2.57,.041],[2.57,.135],[2.49,.195],
  [2.26,.195],[2.20,.232],[0,.232]], charcoal, platform);
profile([[0,.233],[2.19,.233],[2.19,.25],[2.14,.278],[0,.278]], shell, platform);
profile([[0,.279],[.88,.279],[.88,.34],[.83,.405],[.63,.442],[0,.442]], porcelain, platform);

const rail = new T.TorusGeometry(2.519, .012, 8, 144);
mesh(rail, amber, platform, [0,.164,0]).rotation.x = -Math.PI / 2;
const vent = new T.BoxGeometry(.033,.064,.091);
for (let i = 0; i < 48; i++) {
  const a = i * Math.PI / 24;
  const part = mesh(vent, i % 8 === 0 ? collar : charcoal, platform,
    [Math.cos(a)*2.325,.204,Math.sin(a)*2.325]);
  part.rotation.y = -a;
}

const beacon = new T.Group();
scene.add(beacon);
profile([[0,-.93],[.50,-.93],[.59,-.88],[.626,-.78],[.626,-.48],
  [.58,-.41],[.535,-.38],[0,-.38]], shell, beacon);
profile([[0,-.381],[.54,-.381],[.54,-.321],[.503,-.276],[.414,-.244],[0,-.244]], collar, beacon);
profile([[0,.287],[.454,.287],[.555,.338],[.571,.404],[.503,.535],
  [.444,.565],[.317,.684],[0,.684]], porcelain, beacon);
profile([[0,.685],[.311,.685],[.266,.743],[.152,.806],[0,.807]], shell, beacon);

const heart = mesh(new T.IcosahedronGeometry(.325, 3), cyan, beacon, [0,.026,0]);
mesh(new T.SphereGeometry(.375,48,24), new T.MeshPhysicalMaterial({
  color: '#43a4d7', roughness: .11, metalness: .08, transparent: true, opacity: .21,
  depthWrite: false, clearcoat: .70,
}), beacon, [0,.026,0]);
const spine = new T.CylinderGeometry(.025,.032,.82,12);
for (let i = 0; i < 6; i++) {
  const a = i * Math.PI / 3;
  const bar = mesh(spine, shell, beacon, [Math.cos(a)*.46,.029,Math.sin(a)*.46]);
  bar.rotation.z = .145 * Math.cos(a);
  bar.rotation.x = -.145 * Math.sin(a);
}

function segmentedRing(radius, tube, material, lightMaterial, segments, gap) {
  const frame = new T.Group();
  const period = Math.PI * 2 / segments;
  const beam = new T.TorusGeometry(radius, tube, 14, 72, period - gap);
  const trace = new T.TorusGeometry(radius * .995, tube * .28, 10, 56, period * .62);
  const bolt = new T.CylinderGeometry(tube * .75, tube * .75, .029, 12);
  for (let i = 0; i < segments; i++) {
    const start = i * period;
    mesh(beam, material, frame).rotation.z = start;
    mesh(trace, lightMaterial, frame, [0,0,tube * .98]).rotation.z = start + period * .085;
    const end = start + period - gap - .055;
    mesh(bolt, porcelain, frame, [Math.cos(end)*radius,Math.sin(end)*radius,tube]).rotation.x = Math.PI / 2;
  }
  scene.add(frame);
  return frame;
}

const innerRing = segmentedRing(1.00, .047, shell, cyan, 3, .18);
const outerRing = segmentedRing(1.47, .056, charcoal, amber, 3, .23);

const floorShader = {
  ...Reflector.ReflectorShader,
  fragmentShader: Reflector.ReflectorShader.fragmentShader.replace(
    'gl_FragColor = vec4( blendOverlay( base.rgb, color ), 1.0 );',
    `float grain=fract(sin(dot(gl_FragCoord.xy,vec2(21.585,91.381)))*43758.5453);
    gl_FragColor = vec4(color*(.61+.16*grain) + base.rgb*.19, 1.0);`
  ),
};
const floor = new Reflector(new T.PlaneGeometry(90,90), {
  color: new T.Color('#182635'), textureWidth: 832, textureHeight: 468,
  clipBias: .002, multisample: 0, shader: floorShader,
});
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

const contact = mesh(new T.PlaneGeometry(7.4,7.4), new T.ShaderMaterial({
  transparent: true, depthWrite: false,
  vertexShader: `varying vec2 surfaceUV;
    void main(){surfaceUV=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader: `varying vec2 surfaceUV;
    void main(){
      float distanceToCenter=length(surfaceUV-.5)*2.;
      gl_FragColor=vec4(.002,.004,.009,.57*(1.-smoothstep(.63,.97,distanceToCenter)));
    }`,
}),scene,[0,.002,0]);
contact.rotation.x = -Math.PI / 2;

const post = new T.BoxGeometry(.27,4.2,.34);
const lamp = new T.BoxGeometry(.044,1.65,.067);
const runner = new T.BoxGeometry(.035,.019,28);
for (const sign of [-1,1]) {
  mesh(runner, charcoal, scene, [sign*3.32,.014,0]);
  for (let i = 0; i < 6; i++) {
    const x = sign * (5.2 + i*.22);
    const z = 7 - i*4.4;
    mesh(post, charcoal, scene, [x,2.1,z]);
    mesh(lamp, i%3===0 ? amber : cyan, scene, [x-sign*.147,2.64,z+.07]);
    mesh(new T.BoxGeometry(.85,.14,.85), shell, scene, [x,.08,z]);
  }
}
mesh(new T.BoxGeometry(20,5.8,.50), charcoal, scene, [0,2.9,-24]);
for (let i = 0; i < 10; i++) {
  mesh(new T.BoxGeometry(.037 + i%2*.035,2.65,.043), i%3===0 ? amber : charcoal,
    scene, [(i-4.5)*1.65,2.21,-23.73]);
}

function directional(color, power, position) {
  const light = new T.DirectionalLight(color,power);
  light.position.set(...position);
  scene.add(light);
}
directional('#ffceb0', 2.3, [1.1,4.2,2.8]);
directional('#88c8ff', 2.05, [-3.5,3.3,-2.4]);
directional('#b6d6fa', .58, [4.0,2.8,-4.0]);
scene.add(new T.HemisphereLight('#cde0ef','#29202c',.62));
const coreLight = new T.PointLight('#3ad4ff', 12, 4.5, 2);
scene.add(coreLight);

let seed = 48953;
function random() {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
}
const dust = Array.from({ length: 160 }, () => [
  (random()-.5)*17, .2+random()*5.1, (random()-.5)*18, random()*Math.PI*2,
]);
const positions = new T.BufferAttribute(new Float32Array(dust.length*3),3).setUsage(T.DynamicDrawUsage);
const geometry = new T.BufferGeometry().setAttribute('position',positions);
const air = new T.Points(geometry, new T.PointsMaterial({
  color: '#9ab8c9', size: .027, transparent: true, opacity: .38, depthWrite: false,
}));
air.frustumCulled = false;
scene.add(air);

const target = new T.WebGLRenderTarget(1, 1, {
  type: T.HalfFloatType, samples: Math.min(4,renderer.capabilities.maxSamples),
});
const composer = new EffectComposer(renderer,target);
composer.addPass(new RenderPass(scene,camera));
composer.addPass(new UnrealBloomPass(new T.Vector2(1,1), .21, .39, .98));
composer.addPass(new OutputPass());

const {lerp,smoothstep,clamp} = T.MathUtils;
const exportMode = params.get('export') === '1';
const cut = 2.67;

function updateCamera(t) {
  const first = t < cut;
  const phase = first ? smoothstep(t,0,cut) : smoothstep(t,cut,film.seconds);
  const angle = first ? lerp(.75,.27,phase) : lerp(-.96,-.43,phase);
  const radius = first ? lerp(8.65,6.55,phase) : lerp(5.29,6.31,phase);
  const y = first ? lerp(2.55,2.94,phase) : lerp(2.43,2.75,phase);
  camera.position.set(Math.sin(angle)*radius, y, Math.cos(angle)*radius);
  camera.fov = first ? 35 : 39;
  camera.updateProjectionMatrix();
  camera.lookAt(0, first ? lerp(1.05,1.46,phase) : 1.73, 0);
}

function renderAt(seconds) {
  const t = clamp(seconds,0,film.seconds);
  const wake = smoothstep(t,.50,2.40);
  const center = 1.367 + .52*wake + .043*wake*Math.sin(t*1.95);
  beacon.position.y = center;
  beacon.rotation.y = -.18 + .73*wake + .14*t;
  heart.rotation.set(t*.53,.25+t*.72,t*.23);
  innerRing.position.y = center + .03;
  innerRing.rotation.set(.71 - t*.24, -.4 + t*.32, t*.79);
  outerRing.position.y = center + .07;
  outerRing.rotation.set(-.71 + t*.18, .32 - t*.23, .81 - t*.38);
  cyan.emissiveIntensity = .65 + 1.37*wake + .15*Math.sin(t*3.35)*wake;
  amber.emissiveIntensity = .68 + .87*wake;
  coreLight.position.set(0,center+.02,0);
  coreLight.intensity = .41 + 1.5*wake;
  dust.forEach(([x,y,z,phase],i) => {
    positions.setXYZ(i,x+.16*Math.sin(phase+t*.52),y+.057*t+.06*Math.sin(t+phase),z+.11*Math.sin(phase+t*.43));
  });
  positions.needsUpdate = true;
  updateCamera(t);
  composer.render(0);
  if (hybrid) {
    output.drawImage(renderer.domElement, 0, 0);
    capAnchor.set(0, .807, 0);
    beacon.localToWorld(capAnchor).project(camera);
    drawCallout(output, capAnchor);
  }
}

function fit() {
  const aspect = film.size[0] / film.size[1];
  const width = exportMode ? innerWidth : Math.min(innerWidth, Math.round(innerHeight*aspect));
  const height = exportMode ? innerHeight : Math.round(width/aspect);
  if (!exportMode) Object.assign(canvas.style, { width: width + 'px', height: height + 'px' });
  renderer.setSize(width,height,false);
  if (hybrid) {
    canvas.width = width;
    canvas.height = height;
  }
  composer.setSize(width,height);
  camera.aspect = width/height;
}

const fixedTime = params.has('t') ? Number(params.get('t')) : NaN;
fit();
renderAt(Number.isFinite(fixedTime) ? fixedTime : 0);
window.renderAt = renderAt;
window.filmInfo = () => {
  const gl = renderer.getContext();
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  return {
    webgl: gl.getParameter(gl.VERSION),
    gpu: gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER),
    size: [canvas.width,canvas.height],
  };
};
window.filmReady = true;

if (!exportMode) {
  let last = Number.isFinite(fixedTime) ? fixedTime : 0;
  window.addEventListener('resize',() => { fit();renderAt(last); });
  if (!Number.isFinite(fixedTime)) {
    const started = performance.now();
    function loop(now) {
      last = ((now - started)/1000) % film.seconds;
      renderAt(last);
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }
}

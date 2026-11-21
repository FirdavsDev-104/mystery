import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { GraphicsQuality } from '../data/types';

let cachedSoftwareGl: boolean | null = null;

export function detectSoftwareWebGL(): boolean {
  if (cachedSoftwareGl !== null) return cachedSoftwareGl;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) {
      cachedSoftwareGl = true;
      return true;
    }
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    cachedSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    return cachedSoftwareGl;
  } catch {
    cachedSoftwareGl = true;
    return true;
  }
}

export interface ThreeSetupResult {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  isSoftwareGl: boolean;
  pmremTexture: THREE.Texture;
}

export function createGameScene(
  container: HTMLElement,
  quality: GraphicsQuality,
  options?: {
    skyColor?: number;
    fogNear?: number;
    fogFar?: number;
    fov?: number;
    near?: number;
    far?: number;
  },
): ThreeSetupResult {
  const isSoftwareGl = detectSoftwareWebGL();
  const width = Math.max(container.clientWidth, 320);
  const height = Math.max(container.clientHeight, 240);

  const scene = new THREE.Scene();
  const skyColor = options?.skyColor ?? 0x101828;
  scene.background = new THREE.Color(skyColor);
  scene.fog = new THREE.Fog(skyColor, options?.fogNear ?? 35, options?.fogFar ?? 140);

  const camera = new THREE.PerspectiveCamera(
    options?.fov ?? 55,
    width / height,
    options?.near ?? 0.1,
    options?.far ?? 300,
  );

  const renderer = new THREE.WebGLRenderer({
    antialias: !isSoftwareGl && quality !== 'low',
    powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const targetDpr = isSoftwareGl
    ? 1
    : quality === 'high'
      ? Math.min(window.devicePixelRatio || 1, 2)
      : quality === 'medium'
        ? Math.min(window.devicePixelRatio || 1, 1.35)
        : 0.9;
  renderer.setPixelRatio(targetDpr);
  renderer.setSize(width, height);
  renderer.shadowMap.enabled = !isSoftwareGl && quality !== 'low';
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  container.innerHTML = '';
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  container.appendChild(renderer.domElement);

  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const envScene = new RoomEnvironment();
  const pmremTarget = pmremGenerator.fromScene(envScene, 0.04);
  scene.environment = pmremTarget.texture;
  envScene.dispose();
  pmremGenerator.dispose();

  return {
    scene,
    camera,
    renderer,
    isSoftwareGl,
    pmremTexture: pmremTarget.texture,
  };
}

export function addThreePointLights(
  scene: THREE.Scene,
  options?: {
    keyColor?: number;
    keyIntensity?: number;
    skyColor?: number;
    groundColor?: number;
    hemiIntensity?: number;
    shadowRange?: number;
    isSoftwareGl?: boolean;
    quality?: GraphicsQuality;
  },
) {
  const hemi = new THREE.HemisphereLight(
    options?.skyColor ?? 0xbcd8ff,
    options?.groundColor ?? 0x2a3342,
    options?.hemiIntensity ?? 0.85,
  );
  scene.add(hemi);

  const keyLight = new THREE.DirectionalLight(
    options?.keyColor ?? 0xfff5e4,
    options?.keyIntensity ?? 1.8,
  );
  keyLight.position.set(22, 34, 18);
  const enableShadows = !(options?.isSoftwareGl) && options?.quality !== 'low';
  keyLight.castShadow = enableShadows;
  if (enableShadows) {
    const d = options?.shadowRange ?? 28;
    keyLight.shadow.mapSize.width = options?.quality === 'high' ? 1024 : 512;
    keyLight.shadow.mapSize.height = options?.quality === 'high' ? 1024 : 512;
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 110;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
  }
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0x68b5ff, 0.6);
  rimLight.position.set(-20, 14, -22);
  scene.add(rimLight);

  return { hemi, keyLight, rimLight };
}

export function startLoop(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  isSoftwareGl: boolean,
  onTick: (dt: number, elapsed: number) => void,
  isPausedRef: { current: boolean },
) {
  let disposed = false;
  let frameId = 0;
  let timerId = 0;
  const clock = new THREE.Clock();

  if (!isSoftwareGl) {
    try {
      renderer.compile(scene, camera);
    } catch {
      // Ignore compile hint errors
    }
  }

  function afterDraw(cb: () => void) {
    try {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (gl && typeof gl.fenceSync === 'function') {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          if (disposed) {
            if (sync) gl.deleteSync(sync);
            return;
          }
          const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (state === gl.UNSIGNALED) {
            timerId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl.deleteSync(sync);
            timerId = window.setTimeout(cb, 80);
          }
        };
        timerId = window.setTimeout(poll, 5);
        return;
      }
    } catch {
      // Fallback
    }
    timerId = window.setTimeout(cb, 80);
  }

  function tick() {
    if (disposed) return;
    const rawDelta = clock.getDelta();
    const dt = isPausedRef.current ? 0 : Math.min(rawDelta, 0.05);
    const elapsed = clock.elapsedTime;

    onTick(dt, elapsed);
    renderer.render(scene, camera);

    if (isSoftwareGl) {
      afterDraw(tick);
    } else {
      frameId = requestAnimationFrame(tick);
    }
  }

  tick();

  return () => {
    disposed = true;
    cancelAnimationFrame(frameId);
    clearTimeout(timerId);
  };
}

export function attachResizeObserver(
  container: HTMLElement,
  camera: THREE.PerspectiveCamera,
  renderer: THREE.WebGLRenderer,
) {
  const handleResize = () => {
    const w = Math.max(container.clientWidth, 320);
    const h = Math.max(container.clientHeight, 240);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };

  const ro = new ResizeObserver(handleResize);
  ro.observe(container);
  window.addEventListener('resize', handleResize);

  return () => {
    ro.disconnect();
    window.removeEventListener('resize', handleResize);
  };
}

export function disposeThreeScene(scene: THREE.Scene, renderer: THREE.WebGLRenderer, pmremTexture?: THREE.Texture) {
  scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }
    if (mesh.material) {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((mat) => {
        Object.values(mat).forEach((val) => {
          if (val && typeof (val as THREE.Texture).dispose === 'function') {
            (val as THREE.Texture).dispose();
          }
        });
        mat.dispose();
      });
    }
  });
  if (pmremTexture) {
    pmremTexture.dispose();
  }
  renderer.dispose();
}

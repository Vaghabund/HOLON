import * as THREE from 'three';
import { SparkRenderer, SplatMesh } from '@sparkjsdev/spark';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

window.__holonViewerBooted = true;

const ASSETS_FOLDER = 'assets/';
const DEFAULT_COMPARE_MODELS = [
  {
    label: 'SPZ Output',
    kind: 'splat',
    file: 'HW2 4P DO_ply.spz'
  },
  {
    label: 'GLB Output',
    kind: 'glb',
    file: 'HW2 4P DO_glb.glb'
  }
];

const viewerHint = document.getElementById('viewerHint');
const resetViewButton = document.getElementById('resetViewButton');
const frameObjectButton = document.getElementById('frameObjectButton');

const panelElements = [
  {
    slot: 'left',
    canvas: document.getElementById('leftCanvas'),
    typeLabel: document.getElementById('leftModelType'),
    title: document.getElementById('leftModelTitle'),
    file: document.getElementById('leftModelFile'),
    statusPanel: document.getElementById('leftStatus'),
    statusTitle: document.getElementById('leftStatusTitle'),
    statusBody: document.getElementById('leftStatusBody')
  },
  {
    slot: 'right',
    canvas: document.getElementById('rightCanvas'),
    typeLabel: document.getElementById('rightModelType'),
    title: document.getElementById('rightModelTitle'),
    file: document.getElementById('rightModelFile'),
    statusPanel: document.getElementById('rightStatus'),
    statusTitle: document.getElementById('rightStatusTitle'),
    statusBody: document.getElementById('rightStatusBody')
  }
];

const viewers = [];

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return 'unknown size';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function setPanelStatus(panel, title, message, isError = false) {
  panel.statusTitle.textContent = title;
  panel.statusBody.textContent = message;
  panel.statusPanel.classList.toggle('viewer-status-error', isError);
  panel.statusPanel.classList.remove('viewer-status-hidden');
}

function hidePanelStatus(panel) {
  panel.statusPanel.classList.add('viewer-status-hidden');
}

function describeModelKind(kind) {
  return kind === 'glb' ? 'GLB' : 'SPZ';
}

function inferModelKind(fileName = '') {
  return /\.gl(?:b|tf)$/i.test(fileName) ? 'glb' : 'splat';
}

function updatePanelMeta(panel, model) {
  panel.typeLabel.textContent = describeModelKind(model.kind);
  panel.title.textContent = model.label;
  panel.file.textContent = `${model.fileName} · ${formatFileSize(model.sizeBytes || 0)}`;
}

async function resolveComparisonModels() {
  let configuredModels = DEFAULT_COMPARE_MODELS;

  try {
    const response = await fetch(`${ASSETS_FOLDER}config.json`, { cache: 'no-cache' });
    if (response.ok) {
      const config = await response.json();
      if (Array.isArray(config.compareModels) && config.compareModels.length >= 2) {
        configuredModels = config.compareModels.slice(0, 2);
      } else if (config.splatFile || config.glbFile) {
        configuredModels = [
          {
            label: 'SPZ Output',
            kind: 'splat',
            file: config.splatFile || DEFAULT_COMPARE_MODELS[0].file
          },
          {
            label: 'GLB Output',
            kind: 'glb',
            file: config.glbFile || DEFAULT_COMPARE_MODELS[1].file
          }
        ];
      }
    }
  } catch (error) {
    console.warn('Failed to read config.json, falling back to default comparison models.', error);
  }

  return Promise.all(configuredModels.map(async (model) => {
    const fileName = model.file || model.fileName;
    const kind = model.kind || inferModelKind(fileName);
    const resolvedPath = `${ASSETS_FOLDER}${fileName}`;
    const headResponse = await fetch(resolvedPath, { method: 'HEAD', cache: 'no-cache' });

    if (!headResponse.ok) {
      throw new Error(`Configured ${kind} file "${fileName}" was not found in the assets folder.`);
    }

    const contentLength = Number.parseInt(headResponse.headers.get('content-length') || '', 10);

    return {
      label: model.label || describeModelKind(kind),
      kind,
      fileName,
      url: resolvedPath,
      sizeBytes: Number.isFinite(contentLength) ? contentLength : null
    };
  }));
}

async function downloadBinaryFile(panel, { url, fileName, sizeBytes, label }) {
  const response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok) {
    throw new Error(`Failed to download "${fileName}".`);
  }

  if (!response.body) {
    const arrayBuffer = await response.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  }

  const totalBytes = Number.parseInt(response.headers.get('content-length') || '', 10) || sizeBytes || 0;
  const reader = response.body.getReader();
  const chunks = [];
  let receivedBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    chunks.push(value);
    receivedBytes += value.length;

    if (totalBytes > 0) {
      const percent = Math.min(100, (receivedBytes / totalBytes) * 100);
      setPanelStatus(
        panel,
        `Downloading ${label}`,
        `${fileName} · ${percent.toFixed(1)}% of ${formatFileSize(totalBytes)}`
      );
    } else {
      setPanelStatus(
        panel,
        `Downloading ${label}`,
        `${fileName} · ${formatFileSize(receivedBytes)} received`
      );
    }
  }

  const merged = new Uint8Array(receivedBytes);
  let offset = 0;

  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  return merged;
}

function handleResize(viewer) {
  if (!viewer?.renderer) {
    return;
  }

  const width = viewer.canvas.clientWidth;
  const height = viewer.canvas.clientHeight;
  if (width === 0 || height === 0) {
    return;
  }

  viewer.renderer.setSize(width, height, false);
  viewer.camera.aspect = width / height;
  viewer.camera.updateProjectionMatrix();

}

function getQuantile(sortedValues, quantile) {
  if (sortedValues.length === 0) {
    return null;
  }

  const clampedQuantile = Math.min(Math.max(quantile, 0), 1);
  const index = (sortedValues.length - 1) * clampedQuantile;
  const lowerIndex = Math.floor(index);
  const upperIndex = Math.ceil(index);

  if (lowerIndex === upperIndex) {
    return sortedValues[lowerIndex];
  }

  const mix = index - lowerIndex;
  return sortedValues[lowerIndex] * (1 - mix) + sortedValues[upperIndex] * mix;
}

function computeFiniteBoundingBox(splatMesh) {
  const maxSamples = 20000;
  const trimFraction = 0.005;
  const estimatedCount = Number.isFinite(splatMesh.numSplats) ? splatMesh.numSplats : 0;
  const stride = Math.max(1, Math.ceil(estimatedCount / maxSamples));
  const sampledX = [];
  const sampledY = [];
  const sampledZ = [];

  splatMesh.forEachSplat((index, center) => {
    if (index % stride !== 0) {
      return;
    }

    if (!Number.isFinite(center.x) || !Number.isFinite(center.y) || !Number.isFinite(center.z)) {
      return;
    }

    sampledX.push(center.x);
    sampledY.push(center.y);
    sampledZ.push(center.z);
  });

  if (sampledX.length === 0) {
    return null;
  }

  sampledX.sort((left, right) => left - right);
  sampledY.sort((left, right) => left - right);
  sampledZ.sort((left, right) => left - right);

  const trim = sampledX.length >= 128 ? trimFraction : 0;
  const min = new THREE.Vector3(
    getQuantile(sampledX, trim),
    getQuantile(sampledY, trim),
    getQuantile(sampledZ, trim)
  );
  const max = new THREE.Vector3(
    getQuantile(sampledX, 1 - trim),
    getQuantile(sampledY, 1 - trim),
    getQuantile(sampledZ, 1 - trim)
  );

  if (
    !Number.isFinite(min.x) ||
    !Number.isFinite(min.y) ||
    !Number.isFinite(min.z) ||
    !Number.isFinite(max.x) ||
    !Number.isFinite(max.y) ||
    !Number.isFinite(max.z)
  ) {
    return null;
  }

  const box = new THREE.Box3(min, max);
  const padding = box.getSize(new THREE.Vector3()).multiplyScalar(0.05);
  box.min.sub(padding);
  box.max.add(padding);

  return box;
}

function computeWorldBoundingBox(viewer) {
  if (!viewer.object) {
    return null;
  }

  if (viewer.kind === 'splat') {
    const localBox = computeFiniteBoundingBox(viewer.object);
    if (!localBox) {
      return null;
    }

    return localBox.clone().applyMatrix4(viewer.object.matrixWorld);
  }

  return new THREE.Box3().setFromObject(viewer.object);
}

function resetViewer(viewer) {
  if (!viewer.initialCameraState) {
    return;
  }

  viewer.camera.position.copy(viewer.initialCameraState.position);
  viewer.camera.near = viewer.initialCameraState.near;
  viewer.camera.far = viewer.initialCameraState.far;
  viewer.camera.up.copy(viewer.initialCameraState.up);
  viewer.camera.updateProjectionMatrix();

  viewer.controls.target.copy(viewer.initialCameraState.target);
  viewer.controls.update();
}

function frameViewer(viewer) {
  if (!viewer.object || !viewer.initialCameraState) {
    return false;
  }

  viewer.object.updateMatrixWorld(true);
  const worldBox = computeWorldBoundingBox(viewer);
  if (!worldBox) {
    setPanelStatus(viewer.panel, 'Unable to frame model', 'No finite model positions were found for framing.', true);
    return false;
  }

  if (
    worldBox.isEmpty() ||
    !Number.isFinite(worldBox.min.x) ||
    !Number.isFinite(worldBox.min.y) ||
    !Number.isFinite(worldBox.min.z) ||
    !Number.isFinite(worldBox.max.x) ||
    !Number.isFinite(worldBox.max.y) ||
    !Number.isFinite(worldBox.max.z)
  ) {
    setPanelStatus(viewer.panel, 'Unable to frame model', 'Computed bounds were invalid.', true);
    return false;
  }

  const center = worldBox.getCenter(new THREE.Vector3());
  const size = worldBox.getSize(new THREE.Vector3());
  if (!Number.isFinite(center.x) || !Number.isFinite(center.y) || !Number.isFinite(center.z)) {
    setPanelStatus(viewer.panel, 'Unable to frame model', 'Computed center was invalid.', true);
    return false;
  }

  const halfFovY = THREE.MathUtils.degToRad(viewer.camera.fov * 0.5);
  const halfFovX = Math.atan(Math.tan(halfFovY) * Math.max(viewer.camera.aspect, 0.1));
  const fitHeightDistance = (size.y * 0.5) / Math.tan(Math.max(halfFovY, 0.01));
  const fitWidthDistance = (size.x * 0.5) / Math.tan(Math.max(halfFovX, 0.01));
  const fitDepthOffset = size.z * 0.75;
  const distance = Math.max(fitHeightDistance, fitWidthDistance, 0.5) + fitDepthOffset;

  if (!Number.isFinite(distance)) {
    setPanelStatus(viewer.panel, 'Unable to frame model', 'Computed camera distance was invalid.', true);
    return false;
  }

  const offsetDirection = viewer.initialCameraState.offset.clone().normalize();
  const nextPosition = center.clone().add(offsetDirection.multiplyScalar(distance));

  if (!Number.isFinite(nextPosition.x) || !Number.isFinite(nextPosition.y) || !Number.isFinite(nextPosition.z)) {
    setPanelStatus(viewer.panel, 'Unable to frame model', 'Computed camera position was invalid.', true);
    return false;
  }

  viewer.controls.target.copy(center);
  viewer.camera.position.copy(nextPosition);
  viewer.camera.up.copy(viewer.initialCameraState.up);
  viewer.camera.near = Math.max(distance / 500, 0.01);
  viewer.camera.far = Math.max(distance * 20, size.length() * 10, 1000);
  viewer.camera.lookAt(center);
  viewer.camera.updateProjectionMatrix();
  viewer.controls.update();
  hidePanelStatus(viewer.panel);
  return true;
}

function createViewer(panel) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf4f2ec);

  const renderer = new THREE.WebGLRenderer({ canvas: panel.canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0xf4f2ec, 1);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 1000);
  camera.position.set(0, 0.45, 3.25);
  camera.lookAt(0, 0, 0);
  scene.add(camera);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = true;
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.screenSpacePanning = true;
  controls.minDistance = 0.01;
  controls.maxDistance = Infinity;
  controls.touches.ONE = THREE.TOUCH.ROTATE;
  controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
  controls.target.set(0, 0, 0);
  controls.update();

  scene.add(new THREE.HemisphereLight(0xffffff, 0xd8d1c4, 1.4));
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.1);
  directionalLight.position.set(3, 5, 4);
  scene.add(directionalLight);

  const viewer = {
    panel,
    canvas: panel.canvas,
    scene,
    renderer,
    camera,
    controls,
    object: null,
    kind: null,
    isLoaded: false,
    initialCameraState: {
      position: camera.position.clone(),
      target: controls.target.clone(),
      offset: camera.position.clone().sub(controls.target),
      up: camera.up.clone(),
      near: camera.near,
      far: camera.far
    }
  };

  renderer.setAnimationLoop(() => {
    controls.update();
    renderer.render(scene, camera);
  });

  handleResize(viewer);
  return viewer;
}

async function loadSplatModel(viewer, model) {
  setPanelStatus(
    viewer.panel,
    'Preparing download',
    `${model.fileName} · ${formatFileSize(model.sizeBytes || 0)}`
  );

  const fileBytes = await downloadBinaryFile(viewer.panel, model);
  setPanelStatus(viewer.panel, `Processing ${model.label}`, `Decoding ${model.fileName}.`);

  const spark = new SparkRenderer({ renderer: viewer.renderer });
  spark.blurAmount = 0.08;
  spark.maxStdDev = 2.4;
  spark.maxPixelRadius = 160;
  viewer.scene.add(spark);

  const splatMesh = new SplatMesh({ fileBytes, fileName: model.fileName });
  splatMesh.rotation.set(0, Math.PI, Math.PI);
  viewer.scene.add(splatMesh);
  viewer.object = splatMesh;
  viewer.kind = 'splat';

  await splatMesh.initialized;
}

async function loadGlbModel(viewer, model) {
  const loader = new GLTFLoader();

  const gltf = await new Promise((resolve, reject) => {
    loader.load(
      model.url,
      resolve,
      (event) => {
        const totalBytes = event.total || model.sizeBytes || 0;
        if (totalBytes > 0) {
          const percent = Math.min(100, (event.loaded / totalBytes) * 100);
          setPanelStatus(
            viewer.panel,
            `Loading ${model.label}`,
            `${model.fileName} · ${percent.toFixed(1)}% of ${formatFileSize(totalBytes)}`
          );
        } else {
          setPanelStatus(
            viewer.panel,
            `Loading ${model.label}`,
            `${model.fileName} · ${formatFileSize(event.loaded || 0)} received`
          );
        }
      },
      (error) => {
        reject(new Error(error?.message || `Failed to load ${model.fileName}.`));
      }
    );
  });

  const modelRoot = gltf.scene || gltf.scenes?.[0];
  if (!modelRoot) {
    throw new Error(`GLB file "${model.fileName}" did not contain a renderable scene.`);
  }

  viewer.scene.add(modelRoot);
  viewer.object = modelRoot;
  viewer.kind = 'glb';
}

async function initViewer() {
  if (!window.WebGL2RenderingContext) {
    throw new Error('This browser does not support WebGL2, which the comparison viewer requires.');
  }

  const models = await resolveComparisonModels();
  const setupPairs = panelElements.map((panel, index) => ({
    panel,
    model: models[index]
  }));

  for (const { panel, model } of setupPairs) {
    updatePanelMeta(panel, model);
    const viewer = createViewer(panel);
    viewers.push(viewer);
  }

  resetViewButton.addEventListener('click', () => {
    for (const viewer of viewers) {
      resetViewer(viewer);
    }
  });

  frameObjectButton.addEventListener('click', () => {
    for (const viewer of viewers) {
      frameViewer(viewer);
    }
  });

  window.addEventListener('resize', () => {
    for (const viewer of viewers) {
      handleResize(viewer);
    }
  });

  await Promise.all(setupPairs.map(async ({ model }, index) => {
    const viewer = viewers[index];

    if (model.kind === 'glb') {
      await loadGlbModel(viewer, model);
    } else {
      await loadSplatModel(viewer, model);
    }

    viewer.isLoaded = true;
    frameViewer(viewer);
  }));

  viewerHint.classList.add('viewer-hint-visible');
}

initViewer().catch((error) => {
  console.error('Error loading comparison viewer:', error);
  for (const panel of panelElements) {
    setPanelStatus(panel, 'Unable to load model', error.message, true);
  }
});
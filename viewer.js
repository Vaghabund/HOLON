import * as THREE from 'three';
import { SparkRenderer, SplatMesh } from '@sparkjsdev/spark';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

window.__holonViewerBooted = true;

const ASSETS_FOLDER = 'assets/';
const DEFAULT_SPLAT_FILE = 'Intrabeam_GS.ply';

const canvas = document.getElementById('gsCanvas');
const statusPanel = document.getElementById('viewerStatus');
const statusTitle = document.getElementById('viewerStatusTitle');
const statusBody = document.getElementById('viewerStatusBody');
const viewerHint = document.getElementById('viewerHint');
const viewerDebugContent = document.getElementById('viewerDebugContent');
const resetViewButton = document.getElementById('resetViewButton');
const frameObjectButton = document.getElementById('frameObjectButton');

let renderer = null;
let controls = null;
let activeCamera = null;
let activeSplatMesh = null;
let initialCameraState = null;

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

function setStatus(title, message, isError = false) {
  statusTitle.textContent = title;
  statusBody.textContent = message;
  statusPanel.classList.toggle('viewer-status-error', isError);
  statusPanel.classList.remove('viewer-status-hidden');
}

function hideStatus() {
  statusPanel.classList.add('viewer-status-hidden');
}

async function resolveSplatPath() {
  let configuredFile = DEFAULT_SPLAT_FILE;

  try {
    const response = await fetch(`${ASSETS_FOLDER}config.json`, { cache: 'no-cache' });
    if (response.ok) {
      const config = await response.json();
      configuredFile = config.splatFile || config.gsFile || config.pdfSplatFile || DEFAULT_SPLAT_FILE;
    }
  } catch (error) {
    console.warn('Failed to read config.json, falling back to default splat file.', error);
  }

  const resolvedPath = `${ASSETS_FOLDER}${configuredFile}`;
  const headResponse = await fetch(resolvedPath, { method: 'HEAD', cache: 'no-cache' });
  if (!headResponse.ok) {
    throw new Error(`Splat file "${configuredFile}" was not found in the assets folder.`);
  }

  const contentLength = Number.parseInt(headResponse.headers.get('content-length') || '', 10);

  return {
    fileName: configuredFile,
    url: resolvedPath,
    sizeBytes: Number.isFinite(contentLength) ? contentLength : null
  };
}

async function downloadSplatFile({ url, fileName, sizeBytes }) {
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
      setStatus(
        'Downloading scene',
        `${fileName} · ${percent.toFixed(1)}% of ${formatFileSize(totalBytes)}`
      );
    } else {
      setStatus(
        'Downloading scene',
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

function handleResize(camera) {
  if (!renderer) {
    return;
  }

  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function formatVector(vector) {
  return `${vector.x.toFixed(2)}, ${vector.y.toFixed(2)}, ${vector.z.toFixed(2)}`;
}

function updateDebugPanel() {
  if (!viewerDebugContent || !activeCamera || !controls) {
    return;
  }

  const forward = new THREE.Vector3();
  activeCamera.getWorldDirection(forward);

  const debugLines = [
    `pos    ${formatVector(activeCamera.position)}`,
    `target ${formatVector(controls.target)}`,
    `dir    ${formatVector(forward)}`,
    `dist   ${activeCamera.position.distanceTo(controls.target).toFixed(2)}`,
    `azim   ${THREE.MathUtils.radToDeg(controls.getAzimuthalAngle()).toFixed(1)} deg`,
    `polar  ${THREE.MathUtils.radToDeg(controls.getPolarAngle()).toFixed(1)} deg`,
    `near   ${activeCamera.near.toFixed(3)}`,
    `far    ${activeCamera.far.toFixed(1)}`
  ];

  viewerDebugContent.textContent = debugLines.join('\n');
}

function computeFiniteBoundingBox(splatMesh) {
  const min = new THREE.Vector3(Infinity, Infinity, Infinity);
  const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
  let validCount = 0;

  splatMesh.forEachSplat((_index, center) => {
    if (!Number.isFinite(center.x) || !Number.isFinite(center.y) || !Number.isFinite(center.z)) {
      return;
    }

    min.min(center);
    max.max(center);
    validCount += 1;
  });

  if (validCount === 0) {
    return null;
  }

  return new THREE.Box3(min, max);
}
function resetView() {
  if (!activeCamera || !controls || !initialCameraState) {
    return;
  }

  activeCamera.position.copy(initialCameraState.position);
  activeCamera.near = initialCameraState.near;
  activeCamera.far = initialCameraState.far;
  activeCamera.up.copy(initialCameraState.up);
  activeCamera.updateProjectionMatrix();

  controls.target.copy(initialCameraState.target);
  controls.update();
  updateDebugPanel();
}

function frameObject() {
  if (!activeCamera || !controls || !activeSplatMesh || !activeSplatMesh.isInitialized || !initialCameraState) {
    return;
  }

  activeSplatMesh.updateMatrixWorld(true);

  const localBox = computeFiniteBoundingBox(activeSplatMesh);
  if (!localBox) {
    setStatus('Unable to frame object', 'No finite splat positions were found for framing.', true);
    return;
  }

  const worldBox = localBox.clone().applyMatrix4(activeSplatMesh.matrixWorld);

  if (
    worldBox.isEmpty() ||
    !Number.isFinite(worldBox.min.x) ||
    !Number.isFinite(worldBox.min.y) ||
    !Number.isFinite(worldBox.min.z) ||
    !Number.isFinite(worldBox.max.x) ||
    !Number.isFinite(worldBox.max.y) ||
    !Number.isFinite(worldBox.max.z)
  ) {
    setStatus('Unable to frame object', 'Computed bounds were invalid.', true);
    return;
  }

  const center = worldBox.getCenter(new THREE.Vector3());
  const size = worldBox.getSize(new THREE.Vector3());
  if (!Number.isFinite(center.x) || !Number.isFinite(center.y) || !Number.isFinite(center.z)) {
    setStatus('Unable to frame object', 'Computed center was invalid.', true);
    return;
  }

  const halfFovY = THREE.MathUtils.degToRad(activeCamera.fov * 0.5);
  const halfFovX = Math.atan(Math.tan(halfFovY) * Math.max(activeCamera.aspect, 0.1));
  const fitHeightDistance = (size.y * 0.5) / Math.tan(Math.max(halfFovY, 0.01));
  const fitWidthDistance = (size.x * 0.5) / Math.tan(Math.max(halfFovX, 0.01));
  const fitDepthOffset = size.z * 0.75;
  const distance = Math.max(fitHeightDistance, fitWidthDistance, 0.5) + fitDepthOffset;

  if (!Number.isFinite(distance)) {
    setStatus('Unable to frame object', 'Computed camera distance was invalid.', true);
    return;
  }

  const offsetDirection = initialCameraState.offset.clone().normalize();
  const nextPosition = center.clone().add(offsetDirection.multiplyScalar(distance));

  if (!Number.isFinite(nextPosition.x) || !Number.isFinite(nextPosition.y) || !Number.isFinite(nextPosition.z)) {
    setStatus('Unable to frame object', 'Computed camera position was invalid.', true);
    return;
  }

  controls.target.copy(center);
  activeCamera.position.copy(nextPosition);
  activeCamera.up.copy(initialCameraState.up);
  activeCamera.near = Math.max(distance / 500, 0.01);
  activeCamera.far = Math.max(distance * 20, size.length() * 10, 1000);
  activeCamera.lookAt(center);
  activeCamera.updateProjectionMatrix();
  controls.update();
  hideStatus();
  updateDebugPanel();
}

async function initViewer() {
  if (!window.WebGL2RenderingContext) {
    throw new Error('This browser does not support WebGL2, which Spark requires.');
  }

  setStatus('Loading scene', 'Preparing the configured gaussian splat.');

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf4f2ec);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0xf4f2ec, 1);

  const spark = new SparkRenderer({ renderer });
  scene.add(spark);

  const camera = new THREE.PerspectiveCamera(55, 1, 0.01, 1000);
  camera.position.set(0, 0.4, 3.25);
  camera.lookAt(0, 0, 0);
  scene.add(camera);
  activeCamera = camera;

  controls = new OrbitControls(camera, renderer.domElement);
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

  initialCameraState = {
    position: camera.position.clone(),
    target: controls.target.clone(),
    offset: camera.position.clone().sub(controls.target),
    up: camera.up.clone(),
    near: camera.near,
    far: camera.far
  };

  resetViewButton.addEventListener('click', resetView);
  frameObjectButton.addEventListener('click', frameObject);

  renderer.setAnimationLoop(() => {
    controls.update();
    updateDebugPanel();
    renderer.render(scene, camera);
  });

  handleResize(camera);
  window.addEventListener('resize', () => handleResize(camera));

  const splatSource = await resolveSplatPath();
  setStatus(
    'Preparing download',
    `${splatSource.fileName} · ${formatFileSize(splatSource.sizeBytes || 0)}`
  );

  const fileBytes = await downloadSplatFile(splatSource);

  setStatus('Processing scene', `Decoding ${splatSource.fileName}.`);

  const splatMesh = new SplatMesh({ fileBytes, fileName: splatSource.fileName });
  splatMesh.quaternion.set(1, 0, 0, 0);
  scene.add(splatMesh);
  activeSplatMesh = splatMesh;

  await splatMesh.initialized;

  updateDebugPanel();
  hideStatus();
  viewerHint.classList.add('viewer-hint-visible');
}

initViewer().catch((error) => {
  console.error('Error loading GS viewer:', error);
  setStatus('Unable to load scene', error.message, true);
});
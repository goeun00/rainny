import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";

const container = document.querySelector(".whale-viewer");

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(35, container.clientWidth / container.clientHeight, 0.1, 100);
camera.position.set(0, 0.3, 4);

const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(renderer.domElement);

// 드래그/터치로 회전
const controls = new OrbitControls(camera, renderer.domElement);
const homeCamera = new THREE.Vector3();
const homeTarget = new THREE.Vector3();

let resetTimer;
let resetFrame;
let introPlaying = false;

function easeOutCubic(value) {
  return 1 - Math.pow(1 - value, 3);
}

function returnToHome() {
  const startTarget = controls.target.clone();

  const startOrbit = new THREE.Spherical().setFromVector3(camera.position.clone().sub(startTarget));

  const homeOrbit = new THREE.Spherical().setFromVector3(homeCamera.clone().sub(homeTarget));

  const thetaDifference = Math.atan2(
    Math.sin(homeOrbit.theta - startOrbit.theta),
    Math.cos(homeOrbit.theta - startOrbit.theta),
  );

  const startedAt = performance.now();
  const duration = 700;

  function animateReturn(now) {
    const progress = Math.min((now - startedAt) / duration, 1);
    const eased = easeOutCubic(progress);

    const orbit = new THREE.Spherical(
      THREE.MathUtils.lerp(startOrbit.radius, homeOrbit.radius, eased),
      THREE.MathUtils.lerp(startOrbit.phi, homeOrbit.phi, eased),
      startOrbit.theta + thetaDifference * eased,
    );

    camera.position.copy(homeTarget).add(new THREE.Vector3().setFromSpherical(orbit));

    controls.target.copy(homeTarget);
    controls.update();

    if (progress < 1) {
      resetFrame = requestAnimationFrame(animateReturn);
    } else {
      camera.position.copy(homeCamera);
      controls.target.copy(homeTarget);
      controls.update();
    }
  }

  resetFrame = requestAnimationFrame(animateReturn);
}

function scheduleReturn() {
  clearTimeout(resetTimer);

  resetTimer = setTimeout(() => {
    returnToHome();
  }, 1500); // 손을 뗀 뒤 1.5초
}

controls.addEventListener("start", () => {
  clearTimeout(resetTimer);
  cancelAnimationFrame(resetFrame);
});

controls.addEventListener("end", scheduleReturn);

function playIntroSpin() {
  introPlaying = true;
  controls.enabled = false;

  const startedAt = performance.now();
  const duration = 3500;
  const offset = homeCamera.clone().sub(homeTarget);

  function spin(now) {
    const progress = Math.min((now - startedAt) / duration, 1);
    const eased = easeOutCubic(progress);

    const rotatedOffset = offset.clone().applyAxisAngle(
      new THREE.Vector3(0, 1, 0),
      -Math.PI * 2 * eased, // 한 바퀴
    );

    camera.position.copy(homeTarget).add(rotatedOffset);
    controls.target.copy(homeTarget);
    controls.update();

    if (progress < 1) {
      requestAnimationFrame(spin);
    } else {
      camera.position.copy(homeCamera);
      controls.target.copy(homeTarget);
      controls.update();

      introPlaying = false;
      controls.enabled = true;
    }
  }

  requestAnimationFrame(spin);
}
controls.enableDamping = true;
controls.enableZoom = false; // 확대·축소 막기
controls.enablePan = false; // 화면 이동 막기
controls.minPolarAngle = Math.PI * 0.35; // 위아래 회전 범위
controls.maxPolarAngle = Math.PI * 0.65;

scene.add(new THREE.HemisphereLight(0xffffff, 0x8a76a3, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;

const dracoLoader = new DRACOLoader();

dracoLoader.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");

const loader = new GLTFLoader();

loader.setDRACOLoader(dracoLoader);

loader.load("/models/purple-whale-web-optimized.glb", (gltf) => {
  const whale = gltf.scene;

  whale.scale.setScalar(1.5);
  whale.rotation.set(-0.1, 0.5, 0);

  // 모델의 실제 중심을 화면 중앙으로 이동
  const box = new THREE.Box3().setFromObject(whale);
  const center = box.getCenter(new THREE.Vector3());

  whale.position.sub(center);

  scene.add(whale);

  controls.target.set(0, 0, 0);
  controls.update();
  homeCamera.copy(camera.position);
  homeTarget.copy(controls.target);

  playIntroSpin();
});

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

animate();

window.addEventListener("resize", () => {
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
});

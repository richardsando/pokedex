import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as dat from 'dat.gui';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Raycaster, VectorKeyframeTrack } from 'three/build/three.module';
import { gsap } from 'gsap';

import Stats from 'three/examples/jsm/libs/stats.module.js';

import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';

//outline variables
let composer, effectFXAA;
let selectedObjects = [];

//Performance monitor

const stats = new Stats();
stats.showPanel(1);
document.body.appendChild(stats.dom);
let INTERSECTED;

const pointer = new THREE.Vector2(1, 1);
const radius = 100;

/**
 * Loaders
 *
 */
let mainAnimation,
  panelAnimation,
  idleAnimation,
  zoomAnimation,
  yellowOpenButton;
let htmlReady = false;
let sceneReady = false;
const loadingBarElement = document.querySelector('.loading-bar');
const loadingManager = new THREE.LoadingManager(
  // Loaded
  () => {
    // Wait a little
    window.setTimeout(() => {
      // Animate overlay
      gsap.to(overlayMaterial.uniforms.uAlpha, {
        duration: 1,
        value: 0,
        delay: 0.25,
      });

      // Update loadingBarElement
      loadingBarElement.classList.add('ended');
      loadingBarElement.style.transform = '';
    }, 300);
  },

  // Progress
  (itemUrl, itemsLoaded, itemsTotal) => {
    // Calculate the progress and update the loadingBarElement
    const progressRatio = itemsLoaded / itemsTotal;
    loadingBarElement.style.transform = `scaleX(${progressRatio})`;
    sceneReady = progressRatio;
  }
);
const gltfLoader = new GLTFLoader(loadingManager);
const cubeTextureLoader = new THREE.CubeTextureLoader(loadingManager);

/**
 * Base
 * /**
 * Overlay
 */
const scene = new THREE.Scene();

const overlayGeometry = new THREE.PlaneBufferGeometry(2, 2, 1, 1);
const overlayMaterial = new THREE.ShaderMaterial({
  // wireframe: true,
  transparent: true,
  uniforms: {
    uAlpha: { value: 1 },
  },
  vertexShader: `
  void main()
  {
      gl_Position = vec4(position, 1.0);
  }
`,
  fragmentShader: `
  uniform float uAlpha;

  void main()
  {
      gl_FragColor = vec4(0.0, 0.0, 0.0, uAlpha);
  }
`,
});
const overlay = new THREE.Mesh(overlayGeometry, overlayMaterial);
scene.add(overlay);

// Debug
const gui = new dat.GUI();
dat.GUI.toggleHide();
const debugObject = {};

// Canvas
const canvas = document.querySelector('canvas.webgl');

// Scene

//Raycaster
const raycaster = new Raycaster();
const pointerRaycaster = new Raycaster();

function onPointerMove(event) {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
}

/**
 * Update all materials
 */
const updateAllMaterials = () => {
  scene.traverse((child) => {
    if (
      child instanceof THREE.Mesh &&
      child.material instanceof THREE.MeshStandardMaterial
    ) {
      child.material.envMap = environmentMap;
      child.material.envMapIntensity = debugObject.envMapIntensity;
      child.material.needsUpdate = true;
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
};

/**
 * Environment map
 */
const environmentMap = cubeTextureLoader.load([
  '/textures/environmentMaps/0/px.jpg',
  '/textures/environmentMaps/0/nx.jpg',
  '/textures/environmentMaps/0/py.jpg',
  '/textures/environmentMaps/0/ny.jpg',
  '/textures/environmentMaps/0/pz.jpg',
  '/textures/environmentMaps/0/nz.jpg',
]);

environmentMap.encoding = THREE.sRGBEncoding;

// scene.background = new THREE.Color(0x62d4fe);
scene.environment = environmentMap;

debugObject.envMapIntensity = 5;
gui
  .add(debugObject, 'envMapIntensity')
  .min(0)
  .max(10)
  .step(0.001)
  .onChange(updateAllMaterials);

// Models

const ENTIRE_SCENE = 0,
  BLOOM_SCENE = 1;

const bloomLayer = new THREE.Layers();
bloomLayer.set(BLOOM_SCENE);

const tempV = new THREE.Vector3(0, 0, 0);
let mixer = null;
let screenPos = null;
let screen;
let pointA = null;
gltfLoader.load('models/pokdex_008.gltf', (gltf) => {
  gltf.scene.scale.set(35, 35, 35);
  gltf.scene.position.set(0, 0, 0);
  gltf.scene.rotation.y = Math.PI * 0.59;
  scene.add(gltf.scene);
  const { children } = gltf.scene;
  const idle = children[children.length - 1].children[0];
  const main = idle.children[0];
  const panelGRP = main.children[0];
  const baseGRP = main.children[1];
  screen = baseGRP.children[1];

  yellowOpenButton = panelGRP.children[8];
  mixer = new THREE.AnimationMixer(gltf.scene);
  panelAnimation = mixer.clipAction(gltf.animations[0]);
  mainAnimation = mixer.clipAction(gltf.animations[1]);
  idleAnimation = mixer.clipAction(gltf.animations[2]);
  zoomAnimation = mixer.clipAction(gltf.animations[3]);

  mainAnimation.setLoop(THREE.LoopOnce);
  mainAnimation.clampWhenFinished = true;

  panelAnimation.setLoop(THREE.LoopOnce);
  panelAnimation.clampWhenFinished = true;

  zoomAnimation.setLoop(THREE.LoopOnce);
  zoomAnimation.clampWhenFinished = true;

  mainAnimation.startAt(1);
  panelAnimation.startAt(1);
  idleAnimation.startAt(1);
  zoomAnimation.startAt(4.2);

  // mainAnimation.play();
  // panelAnimation.play();
  // zoomAnimation.play();
  idleAnimation.play();

  gui
    .add(gltf.scene.rotation, 'y')
    .min(-Math.PI)
    .max(Math.PI)
    .step(0.001)
    .name('rotation');

  updateAllMaterials();
});

//helpers
// const axesHelper = new THREE.AxesHelper(10);
// scene.add(axesHelper);

//Points

const points = [
  {
    position: new THREE.Vector3(0.01, 0, -0.01),
    element: document.querySelector('.point-0'),
  },
];

/**
 * Lights
 */
const directionalLight = new THREE.DirectionalLight('#ffffff', 3);
directionalLight.castShadow = true;
directionalLight.shadow.camera.far = 15;
directionalLight.shadow.mapSize.set(1024, 1024);
directionalLight.shadow.normalBias = 0.05;
directionalLight.position.set(0.25, 3, -2.25);
scene.add(directionalLight);

const directionalLightHelper = new THREE.DirectionalLightHelper(
  directionalLight,
  0.2
);
// scene.add(directionalLightHelper);

gui
  .add(directionalLight, 'intensity')
  .min(0)
  .max(10)
  .step(0.001)
  .name('lightIntensity');
gui
  .add(directionalLight.position, 'x')
  .min(-5)
  .max(5)
  .step(0.001)
  .name('lightX');
gui
  .add(directionalLight.position, 'y')
  .min(-5)
  .max(5)
  .step(0.001)
  .name('lightY');
gui
  .add(directionalLight.position, 'z')
  .min(-5)
  .max(5)
  .step(0.001)
  .name('lightZ');
// gui.add(directionalLightHelper, 'visible').name('Light Helper');
gui.closed = true;

/**
 * Sizes
 */
const sizes = {
  width: window.innerWidth,
  height: window.innerHeight,
};

window.addEventListener('resize', () => {
  // Update sizes
  sizes.width = window.innerWidth;
  sizes.height = window.innerHeight;

  // Update camera
  camera.aspect = sizes.width / sizes.height;
  camera.updateProjectionMatrix();

  // Update renderer
  renderer.setSize(sizes.width, sizes.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  //Update Composer
  composer.setSize(sizes.width, sizes.height);

  effectFXAA.uniforms['resolution'].value.set(
    1 / window.innerWidth,
    1 / window.innerHeight
  );
});

document.addEventListener('mousemove', onPointerMove);
/**
 * Camera
 */
// Base camera
const camera = new THREE.PerspectiveCamera(
  75,
  sizes.width / sizes.height,
  0.1,
  100
);
camera.position.set(4, 0, -4);
scene.add(camera);

// Controls
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.enablePan = true;
controls.enableZoom = true;
controls.enableRotate = true;

/**
 * Renderer
 */

const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  antialias: true,
});
renderer.physicallyCorrectLights = true;
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.CineonToneMapping;
renderer.toneMappingExposure = 3;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

//Render Target
let RenderTargetClass = null;

if (renderer.getPixelRatio() === 1 && renderer.capabilities.isWebGL2) {
  RenderTargetClass = THREE.WebGLMultisampleRenderTarget;
} else {
  RenderTargetClass = THREE.WebGLRenderTarget;
}
const renderTarget = new THREE.WebGLMultisampleRenderTarget(800, 600, {
  minFilter: THREE.LinearFilter,
  magFilter: THREE.LinearFilter,
  format: THREE.RGBAFormat,
  encoding: THREE.sRGBEncoding,
});

//composing
composer = new EffectComposer(renderer, renderTarget);
composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
composer.setSize(sizes.width, sizes.height);

const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const params = {
  edgeStrength: 6.0,
  edgeGlow: 0.0,
  edgeThickness: 2.5,
  pulsePeriod: 0,
  rotate: false,
  usePatternTexture: false,
  exposure: 1,
  bloomStrength: 1,
  bloomThreshold: 0,
  bloomRadius: 0,
  scene: 'Scene with Glow',
};

//bloom pass
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  1.5,
  0.4,
  0.85
);
bloomPass.threshold = params.bloomThreshold;
bloomPass.strength = params.bloomStrength;
bloomPass.radius = params.bloomRadius;
composer.addPass(bloomPass);

const GlowShader = {
  vertexShader: `
  varying vec2 vUv;

  void main()
  {
    vUv = uv;

    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
  }

  `,
  fragmentShader: `
  uniform sampler2D baseTexture;
			uniform sampler2D bloomTexture;

			varying vec2 vUv;

			void main() {

				gl_FragColor = ( texture2D( baseTexture, vUv ) + vec4( 1.0 ) * texture2D( bloomTexture, vUv ) );

			}
  `,
};

const finalPass = new ShaderPass(
  new THREE.ShaderMaterial({
    uniforms: {
      baseTexture: { value: null },
      bloomTexture: { value: bloomComposer.renderTarget2.texture },
    },
    vertexShader: GlowShader.vertexShader,
    fragmentShader: GlowShader.fragmentShader,
    defines: {},
  }),
  'baseTexture'
);
finalPass.needsSwap = true;


gui.add(params, 'exposure', 0.1, 2).onChange(function (value) {
  renderer.toneMappingExposure = Math.pow(value, 4.0);
});

gui.add(params, 'bloomThreshold', 0.0, 1.0).onChange(function (value) {
  bloomPass.threshold = Number(value);
});

gui.add(params, 'bloomStrength', 0.0, 3.0).onChange(function (value) {
  bloomPass.strength = Number(value);
});

gui
  .add(params, 'bloomRadius', 0.0, 1.0)
  .step(0.01)
  .onChange(function (value) {
    bloomPass.radius = Number(value);
  });

//Outline pass
const outlinePass = new OutlinePass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  scene,
  camera
);
outlinePass.edgeStrength = params.edgeStrength;
outlinePass.edgeGlow = params.edgeGlow;
outlinePass.edgeThickness = params.edgeThickness;
outlinePass.visibleEdgeColor.set('#ffffff');
outlinePass.hiddenEdgeColor.set('#000000');
composer.addPass(outlinePass);

function Configuration() {
  this.visibleEdgeColor = '#ffff00';
}

const conf = new Configuration();

gui.addColor(conf, 'visibleEdgeColor').onChange(function (value) {
  outlinePass.visibleEdgeColor.set(value);
});
gui.add(params, 'edgeStrength', 0.01, 10).onChange(function (value) {
  outlinePass.edgeStrength = Number(value);
});

gui.add(params, 'edgeGlow', 0.0, 1).onChange(function (value) {
  outlinePass.edgeGlow = Number(value);
});

gui.add(params, 'edgeThickness', 1, 4).onChange(function (value) {
  outlinePass.edgeThickness = Number(value);
});

if (renderer.getPixelRatio() === 1 && !renderer.capabilities.isWebGL2) {
  const smaaPass = new SMAAPass();
  composer.addPass(smaaPass);
}

effectFXAA = new ShaderPass(FXAAShader);
effectFXAA.uniforms['resolution'].value.set(
  1 / window.innerWidth,
  1 / window.innerHeight
);
effectFXAA.renderToScreen = true;
composer.addPass(effectFXAA);

gui
  .add(renderer, 'toneMapping', {
    No: THREE.NoToneMapping,
    Linear: THREE.LinearToneMapping,
    Reinhard: THREE.ReinhardToneMapping,
    Cineon: THREE.CineonToneMapping,
    ACESFilmic: THREE.ACESFilmicToneMapping,
  })
  .onFinishChange(() => {
    renderer.toneMapping = Number(renderer.toneMapping);
    updateAllMaterials();
  });
gui.add(renderer, 'toneMappingExposure').min(0).max(10).step(0.001);

function addSelectedObject(object) {
  selectedObjects = [];
  selectedObjects.push(object);
}

// Animate

const clock = new THREE.Clock();
let previousTime = 0;

const tick = () => {
  //Stats
  stats.begin();
  //   controls.update();
  const elapsedTime = clock.getElapsedTime();
  const deltaTime = elapsedTime - previousTime;
  previousTime = elapsedTime;

  //animation
  if (sceneReady === 1.0) {
    if (mixer !== null) {
      mixer.update(deltaTime);
    }

    if (screenPos !== null) {
      points[0].position.set(
        screenPos.x + 1,
        screenPos.y + 0,
        screenPos.z - 0.2
      );
    }

    //points
    for (const point of points) {
      const screenPosition = point.position.clone();
      if (screen !== undefined && sceneReady === 1.0) {
        screen.updateWorldMatrix(true, false);
        screen.getWorldPosition(tempV);
        tempV.project(camera);
        const x = tempV.x * sizes.width * 0.5;
        const y = tempV.y * sizes.height * 0.5;

        screenPosition.project(camera);

        //Find intersecting html
        raycaster.setFromCamera(screenPosition, camera);

        const intersects = raycaster.intersectObjects(scene.children, true);

        if (intersects.length === 0) {
          point.element.classList.add('visible');
        } else {
          const intersectionDistance = intersects[0].distance;
          const pointDistance = point.position.distanceTo(camera.position);

          if (screen.getWorldPosition(tempV).z > -2.9) {
            point.element.classList.remove('visible');
          } else {
            point.element.classList.add('visible');
          }
          // if (intersectionDistance < pointDistance) {
          //   point.element.classList.remove('visible');
          // } else {
          //   point.element.classList.add('visible');
          // }
        }

        const translateX = screenPosition.x * sizes.width * 0.5;
        const translateY = -screenPosition.y * sizes.height * 0.5;
        point.element.style.transform = `translateX(${x}px) translateY(${y}px)`;
      }
    }

    //find pointer intersects.
    pointerRaycaster.setFromCamera(pointer, camera);
    const pointerIntersects = pointerRaycaster.intersectObjects(
      scene.children,
      true
    );

    if (pointerIntersects.length > 0) {
      if (INTERSECTED != pointerIntersects[0].object) {
        if (INTERSECTED)
          INTERSECTED.material.emissive.setHex(INTERSECTED.currentHex);
        INTERSECTED = pointerIntersects[0].object;
        document.body.style.cursor = 'pointer';
        addSelectedObject(INTERSECTED.parent.parent);
        outlinePass.selectedObjects = selectedObjects;
        if (mainAnimation) {
          mainAnimation.paused = false;
          mainAnimation.play();
          if (panelAnimation) {
            panelAnimation.paused = false;
            panelAnimation.play();
          }
        }
      }
    } else {
      if (INTERSECTED) document.body.style.cursor = 'default';
      selectedObjects = [];
      outlinePass.selectedObjects = selectedObjects;
      INTERSECTED = null;
      panelAnimation.paused = true;
      mainAnimation.paused = true;
    }
  }

  // Render
  composer.render();

  stats.end();
  window.requestAnimationFrame(tick);
};

tick();

import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';


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
  bloomStrength: 5,
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

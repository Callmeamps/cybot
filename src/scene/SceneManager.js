import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { getPerformanceSettings, detectGpuTier } from '../performance/GpuProfiler.js';

export class SceneManager {
  constructor(canvas, settings = null) {
    this.canvas = canvas;
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    // Detect GPU tier and apply settings
    this.gpuInfo = detectGpuTier();
    this.settings = settings || getPerformanceSettings(this.gpuInfo.tier);

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050816);

    // Camera
    this.camera = new THREE.PerspectiveCamera(50, this.width / this.height, 0.1, 100);
    this.camera.position.set(3, 2.5, 4);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.settings.pixelRatio));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    // Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 1.5;
    this.controls.maxDistance = 8.0;
    this.controls.target.set(0, 1, 0);
    this.controls.update();

    // Post-processing (conditional)
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    if (this.settings.enableBloom) {
      this.bloomPass = new UnrealBloomPass(
        new THREE.Vector2(this.width, this.height).multiplyScalar(this.settings.bloomResolution),
        this.settings.bloomStrength,
        0.4,
        0.7
      );
      this.composer.addPass(this.bloomPass);
    }

    if (this.settings.enableFxaa) {
      const fxaaPass = new ShaderPass(FXAAShader);
      fxaaPass.uniforms['resolution'].value.set(1 / this.width, 1 / this.height);
      this.composer.addPass(fxaaPass);
    }

    // Vignette (cheap, always keep)
    const vignetteShader = {
      uniforms: {
        tDiffuse: { value: null },
        intensity: { value: 0.35 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float intensity;
        varying vec2 vUv;
        void main() {
          vec4 color = texture2D(tDiffuse, vUv);
          vec2 uv = (vUv - 0.5) * 2.0;
          float v = 1.0 - dot(uv, uv) * intensity;
          gl_FragColor = vec4(color.rgb * v, color.a);
        }
      `,
    };
    this.composer.addPass(new ShaderPass(vignetteShader));

    // FPS counter (debug)
    this.showFps = location.search.includes('fps');
    if (this.showFps) this.initFpsCounter();

    // Animation FPS cap
    this.minFrameTime = 1000 / this.settings.animationFps;
    this.lastFrameTime = 0;
    this.isVisible = true;

    // Resize handler
    this.onResize = this.onResize.bind(this);
    window.addEventListener('resize', this.onResize);

    // Pause when tab hidden
    this.onVisibilityChange = this.onVisibilityChange.bind(this);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  initFpsCounter() {
    this.fpsDiv = document.createElement('div');
    this.fpsDiv.style.cssText = 'position:fixed;top:8px;left:8px;color:#0f0;font:14px monospace;z-index:9999;';
    document.body.appendChild(this.fpsDiv);
    this.frameCount = 0;
    this.fpsTime = performance.now();
    this.currentFps = 0;
  }

  onResize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height);
    this.composer.setSize(this.width, this.height);
  }

  onVisibilityChange() {
    this.isVisible = !document.hidden;
  }

  render(time) {
    if (!this.isVisible) return;

    // Animation FPS cap
    if (this.minFrameTime > 0 && time - this.lastFrameTime < this.minFrameTime) {
      return;
    }
    this.lastFrameTime = time;

    this.controls.update();
    this.composer.render();

    // Update FPS counter
    if (this.showFps) {
      this.frameCount++;
      const now = performance.now();
      if (now - this.fpsTime >= 1000) {
        this.currentFps = Math.round((this.frameCount * 1000) / (now - this.fpsTime));
        this.fpsDiv.textContent = `FPS: ${this.currentFps} | GPU: ${this.gpuInfo.renderer}`;
        this.frameCount = 0;
        this.fpsTime = now;
      }
    }
  }

  dispose() {
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.renderer.dispose();
    this.composer.dispose();
    if (this.fpsDiv) this.fpsDiv.remove();
  }
}
import * as THREE from 'three';
import { SceneManager } from './scene/SceneManager.js';
import { Lighting } from './scene/Lighting.js';
import { Environment } from './scene/Environment.js';
import { AgentAvatar } from './agent/AgentAvatar.js';
import { AgentSpeech } from './agent/AgentSpeech.js';
import { ThemeEngine } from './themes/ThemeEngine.js';
import { CharacterEngine } from './characters/CharacterEngine.js';
import { ToolCardSystem } from './tools/ToolCardSystem.js';
import { detectGpuTier, getPerformanceSettings } from './performance/GpuProfiler.js';

class CybotApp {
  constructor() {
    const canvas = document.getElementById('scene');
    if (!canvas) {
      console.error('Canvas element not found');
      return;
    }

    // GPU detection
    this.gpuInfo = detectGpuTier();
    this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;
    console.log(`GPU: ${this.gpuInfo.renderer} (tier ${this.gpuInfo.tier})`);
    this.settings = getPerformanceSettings(this.gpuInfo.tier);
    this.settings.reducedMotion = this.reducedMotion;
    this.canvas = canvas;

    // Scene setup with performance settings
    this.sceneManager = new SceneManager(canvas, this.settings);
    this.lighting = new Lighting(this.sceneManager.scene);
    this.environment = new Environment(this.sceneManager.scene, this.settings);

    // Character + theme engines
    this.characterEngine = new CharacterEngine();
    this.activeCharacter = this.characterEngine.getActiveCharacter();
    this.themeEngine = new ThemeEngine({
      scene: this.sceneManager.scene,
      lighting: this.lighting,
      environment: this.environment,
      avatar: null,
      speech: null,
      sceneManager: this.sceneManager,
    });

    // Avatar — load from character config if available
    this.avatar = new AgentAvatar(this.sceneManager.scene, {
      position: new THREE.Vector3(0, 1.0, 0),
      accentColor: this.activeCharacter.fallbackColor || 0x7ddcff,
      modelPath: this.activeCharacter.modelPath || '/models/avatar.glb',
      reducedMotion: this.reducedMotion,
    });

    // Tool cards
    this.toolCards = new ToolCardSystem(this.sceneManager.scene, {
      camera: this.sceneManager.camera,
      canvas: this.canvas,
      accentColor: this.activeCharacter.fallbackColor || 0x7ddcff,
      reducedMotion: this.reducedMotion,
    });

    // Speech bubble
    this.speech = new AgentSpeech(this.sceneManager.scene, {
      anchor: new THREE.Vector3(0, 2.2, 0),
      accentColor: this.activeCharacter.fallbackColor || 0x7ddcff,
    });

    // Wire theme engine to scene objects after creation
    this.themeEngine.avatar = this.avatar;
    this.themeEngine.speech = this.speech;
    this.themeEngine.toolCards = this.toolCards;
    this.themeEngine.applyTheme(this.themeEngine.getActiveThemeId());

    // Theme/character events from UI
    document.addEventListener('cybot:theme-change', (event) => {
      this.themeEngine.applyTheme(event.detail.themeId);
    });

    document.addEventListener('cybot:character-change', () => {
      // Reload to swap the 3D model cleanly.
      location.reload();
    });

    document.addEventListener('cybot:tool-selected', (event) => {
      document.dispatchEvent(new CustomEvent('cybot:tool-context', { detail: event.detail }));
    });

    // Click-to-chat raycasting
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.onCanvasClick = this.onCanvasClick.bind(this);
    canvas.addEventListener('click', this.onCanvasClick);

    // Demo: show speech after 2s
    setTimeout(() => {
      this.speech.show(`Hello! I'm ${this.activeCharacter.name}. Click me to chat.`);
    }, 2000);

    this.lastTime = 0;
    this.isRunning = true;

    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  onCanvasClick(event) {
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.sceneManager.camera);
    const targets = this.avatar.getRaycastTargets();
    const hits = this.raycaster.intersectObjects(targets, true);

    if (hits.length > 0) {
      // Toggle chat via Alpine store
      document.dispatchEvent(new CustomEvent('cybot:toggle-chat'));
    }
  }

  animate(time) {
    if (!this.isRunning) return;

    const dt = Math.min((time - this.lastTime) / 1000, 0.1);
    this.lastTime = time;

    this.environment.update(dt);
    this.avatar.update(dt);
    this.toolCards.update(dt);
    this.speech.update(dt, this.sceneManager.camera);
    this.sceneManager.render(time);

    requestAnimationFrame(this.animate);
  }

  dispose() {
    this.isRunning = false;
    this.canvas.removeEventListener('click', this.onCanvasClick);
    this.environment.dispose();
    this.avatar.dispose();
    this.speech.dispose();
    this.toolCards.dispose();
    this.lighting.dispose();
    this.sceneManager.dispose();
  }
}

const app = new CybotApp();
window.cybot = app;

window.addEventListener('beforeunload', () => {
  if (app) app.dispose();
});
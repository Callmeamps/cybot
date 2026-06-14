# cybot/ — 3D Version of Cybernaut

## Vision

Rebuild Cybernaut as a 3D spatial interface using Three.js. The agent lives in a navigable 3D space instead of a 2D panel. Think: the astronaut avatar steps out of the chat bubble and into a volumetric environment you can orbit, zoom, and walk through.

**Aesthetic: dark, stylized, simple, fun.** No starfield. No nebula. Clean void with personality.

## Architecture

```
cybot/
  index.html              # Entry point — Three.js scene + Alpine UI overlay
  package.json            # Vite dev server, Three.js dependency
  public/
    models/               # GLTF/GLB 3D assets (astronaut, props)
    textures/             # PBR textures, emission maps
  src/
    main.js               # Bootstrap — init Three.js scene + Alpine
    scene/
      SceneManager.js     # Scene, camera, renderer setup
      CameraRig.js        # OrbitControls + smooth dolly
      Lighting.js         # Key/fill/rim lights
      Environment.js      # Void background + ground grid + floating shapes
      PostProcessing.js   # Bloom, tone mapping, FXAA, vignette
    agent/
      AgentAvatar.js      # Astronaut GLB loader + animation mixer
      AgentSpeech.js      # 3D speech bubble anchored to avatar
    ui/
      ChatOverlay.js      # Alpine-powered chat UI (HTML overlay on 3D)
      SettingsPanel.js    # Theme/character picker (reuse cybernaut logic)
      HUD.js              # Token count, model name, status indicators
    llm/
      LlmClient.js        # OpenAI-compatible streaming client
      SystemPrompt.js     # Prompt builder with character prefix
    themes/
      ThemeEngine.js      # CSS var injection + 3D material sync
      themes.json         # Theme definitions (port from cybernaut)
    characters/
      CharacterEngine.js  # Character definitions + avatar mapping
      characters.json     # Port from cybernaut
    utils/
      EventEmitter.js     # Lightweight pub/sub
      Easing.js           # Smooth damping, lerp helpers
  tests/
    scene.test.js
    agent.test.js
    llm.test.js
```

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| 3D Engine | Three.js r160+ | Mature, huge ecosystem, ES modules |
| Build | Vite | Fast HMR, zero-config, serves ES modules natively |
| UI Overlay | Alpine.js | Same as cybernaut — keeps mental model |
| Post-Processing | three/addons | UnrealBloomPass, EffectComposer |
| Animations | Three.js AnimationMixer | GLB embedded animations + procedural |
| Fonts | troika-three-text | SDF text in 3D space, crisp at any distance |
| State | Alpine store + localStorage | Same pattern as cybernaut |
| LLM | Fetch API streaming | Same OpenAI-compatible endpoints |

## 3D Scene Layout

```
┌─────────────────────────────────────────────────────────┐
│                    Dark void background                  │
│  ┌───────────────────────────────────────────────────┐  │
│  │           Floating geometric shapes                │  │
│  │  ┌─────────────────────────────────────────────┐  │  │
│  │  │           Platform + ground grid            │  │  │
│  │  │  ┌───────────────────────────────────────┐  │  │  │
│  │  │  │        Agent Avatar (astronaut)       │  │  │  │
│  │  │  │        + Speech bubble (3D text)      │  │  │  │
│  │  │  └───────────────────────────────────────┘  │  │  │
│  │  └─────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘

Camera: Perspective, 50° FOV
  - Default: 3m from avatar, slight elevation (15°)
  - Orbit: drag to rotate, scroll to zoom (1.5m–8m range)
  - Pan: right-drag
  - Mobile: touch gestures (1-finger orbit, 2-finger zoom/pan)
```

## Scene Elements

### 1. Void Background
- Solid dark color (`#050816` default) — no gradient, no particles, no sphere
- Clean, infinite darkness. The void is the aesthetic.
- Color shifts subtly with theme (slightly warmer for "light" theme, pure black for "oled")

### 2. Floating Geometric Shapes (the "fun" part)
- 5–8 simple shapes floating at various depths: torus, icosahedron, octahedron, dodecahedron
- Low-poly, stylized — not realistic
- Each shape slowly rotates on its own axis (different speeds, different axes)
- Shapes have emissive edges (theme accent color) with dark fill
- Subtle bob animation (sine wave, different phase per shape)
- Arranged in a loose arc behind/around the avatar — not blocking the view
- This is the personality of the scene: playful geometry in a dark void

```js
// Floating shapes config
const shapes = [
  { geometry: new THREE.TorusGeometry(0.4, 0.12, 8, 24), pos: [-3, 1.5, -4], rotSpeed: 0.3, bobSpeed: 0.5, bobAmp: 0.15 },
  { geometry: new THREE.IcosahedronGeometry(0.35, 0), pos: [3.5, 2, -3], rotSpeed: 0.2, bobSpeed: 0.7, bobAmp: 0.2 },
  { geometry: new THREE.OctahedronGeometry(0.3, 0), pos: [-2, 2.5, -5], rotSpeed: 0.4, bobSpeed: 0.6, bobAmp: 0.1 },
  { geometry: new THREE.DodecahedronGeometry(0.25, 0), pos: [2, 0.8, -3.5], rotSpeed: 0.25, bobSpeed: 0.4, bobAmp: 0.18 },
  { geometry: new THREE.TorusKnotGeometry(0.2, 0.06, 48, 8), pos: [0, 3, -6], rotSpeed: 0.15, bobSpeed: 0.3, bobAmp: 0.12 },
];
```

Material: `MeshStandardMaterial` with `emissive` set to theme accent, `emissiveIntensity: 0.6`, `metalness: 0.3`, `roughness: 0.7`, dark base color.

### 3. Agent Platform
- Circular platform (radius 1.5m), dark metallic material
- Edge glow ring (emissive, theme accent color) — the main "pop" of color
- Subtle concentric ring lines on the surface (shader or texture)
- Height: 0 (sits on ground plane)
- Optional: faint holographic scan line that sweeps across (slow, subtle)

### 4. Ground Plane
- Infinite grid shader (custom, not Three.js GridHelper)
- Grid lines fade to transparent at edges
- Color: theme surface color at 15% opacity
- Very subtle — grounds the scene without dominating

```glsl
// Grid shader (fragment)
float grid = abs(fract(worldPos.x) - 0.5) + abs(fract(worldPos.z) - 0.5);
float line = 1.0 - smoothstep(0.0, 0.02, grid - 0.48);
float dist = length(worldPos.xz);
float fade = 1.0 - smoothstep(8.0, 20.0, dist);
return gridColor * line * fade;
```

### 5. Agent Avatar
- Load astronaut GLB model
- Idle animation: gentle float/bob (sine wave, 0.15m amplitude, 2.5s period)
- Talking animation: subtle scale pulse + speech bubble appears
- Raycasting: click avatar to open/expand chat
- Fallback: stylized capsule/helmet mesh (two stacked spheres + visor glow)

### 6. Speech Bubble
- 3D text using `troika-three-text`
- Anchored above avatar (offset Y: 2.0m)
- Fade in/out with scale animation
- Max width: 4m, auto-wrap
- Background: semi-transparent dark panel with rounded corners
- Border: thin emissive line in theme accent color

### 7. Tool/Skill Cards (Phase 5)
- Floating flat cards arranged in arc around avatar
- Each card: rounded rectangle with icon + label
- Hover: scale up + accent glow
- Click: chat overlay opens with context
- Staggered entrance animation on load

## Camera System

```js
class CameraRig {
  orbit(deltaAzimuth, deltaPolar) { }
  zoom(delta) { }           // clamp 1.5m - 8m
  focus(target, duration = 800) { }
  reset(duration = 600) { }
  idleUpdate(dt) { }        // subtle breathing motion
}
```

- Damping: 0.08 (smooth but responsive)
- Transitions: cubic ease-out
- Idle: very subtle camera drift (0.05m amplitude, 4s period) — makes scene feel alive

## Lighting

```
Ambient:    0.12 intensity, #b8c4da
Key:        Directional, 1.0 intensity, #f3f7ff, position (5, 8, 3)
Fill:       Directional, 0.3 intensity, theme accent, position (-3, 2, -2)
Rim:        Spot, 0.6 intensity, theme accent strong, behind avatar
```

No IBL/HDRI — keeps it simple and stylized. All light colors sync with theme.

## Post-Processing Pipeline

```
EffectComposer
  → RenderPass(scene, camera)
  → UnrealBloomPass(threshold: 0.7, strength: 0.35, radius: 0.4)
  → ShaderPass(ACESFilmic tone mapping, exposure: 1.0)
  → ShaderPass(FXAA)
  → VignettePass(intensity: 0.35)
```

Bloom is key — makes the emissive edges and glow rings pop. Threshold high enough that only emissive elements bloom.

## Theme Integration

Themes affect both HTML overlay and 3D scene:

```js
class ThemeEngine {
  applyTheme(themeId) {
    this.applyCssVariables(themeId);   // HTML overlay
    this.updateSceneColors(themeId);   // 3D materials
  }
  
  updateSceneColors(themeId) {
    const c = this.getThemeColors(themeId);
    
    // Background
    this.scene.background = new THREE.Color(c.canvasDeep);
    
    // Floating shapes emissive
    this.floatingShapes.forEach(s => {
      s.material.emissive = new THREE.Color(c.accentPrimary);
    });
    
    // Platform edge glow
    this.platformEdge.material.emissive = new THREE.Color(c.accentPrimary);
    
    // Speech bubble border
    this.speechBubble.borderColor = c.accentPrimary;
    
    // Lighting
    this.fillLight.color = new THREE.Color(c.accentPrimary);
    this.rimLight.color = new THREE.Color(c.accentPrimaryStrong);
    
    // Grid
    this.gridMaterial.color = new THREE.Color(c.surface1);
    
    // Bloom
    this.bloomPass.strength = c.bloomIntensity; // 0.2–0.5 range
  }
}
```

Port all 5 built-in themes + custom theme support from cybernaut.

## Character System

```js
// characters/characters.json
{
  "default": {
    "name": "Space Agent",
    "emoji": "🤖",
    "model": "/models/astronaut.glb",
    "fallbackColor": "#7ddcff",
    "systemPromptPrefix": ""
  },
  "robot": {
    "name": "BEEP-BOOP",
    "emoji": "🦾",
    "model": "/models/robot.glb",
    "fallbackColor": "#ff8c42",
    "systemPromptPrefix": "You are a cheerful robot assistant..."
  }
  // ... port all 10 from cybernaut
}
```

Characters define: 3D model path, fallback color, system prompt prefix, speech bubble accent color.

## Chat UI Overlay

HTML overlay on top of the Three.js canvas:

```html
<div id="app" x-data x-init="$store.cybot.init()">
  <canvas id="scene"></canvas>
  
  <div class="chat-overlay" :class="{ 'is-open': $store.cybot.isChatOpen }">
    <div class="chat-header">
      <span class="agent-emoji" x-text="$store.cybot.activeCharacter.emoji"></span>
      <span class="agent-name" x-text="$store.cybot.activeCharacter.name"></span>
      <button @click="$store.cybot.toggleChat()">×</button>
    </div>
    <div class="chat-messages" x-ref="messages">
      <template x-for="msg in $store.cybot.messages" :key="msg.id">
        <div :class="'message-' + msg.role">
          <div x-html="renderMarkdown(msg.content)"></div>
        </div>
      </template>
    </div>
    <div class="chat-input">
      <textarea x-model="$store.cybot.input" @keydown.enter="send"></textarea>
      <button @click="$store.cybot.send()">Send</button>
    </div>
  </div>
  
  <div class="settings-panel" :class="{ 'is-open': $store.cybot.isSettingsOpen }">
    <!-- Theme picker, character picker, model picker -->
  </div>
  
  <div class="hud">
    <span x-text="$store.cybot.modelName"></span>
    <span x-text="$store.cybot.tokenCount"></span>
    <span :class="$store.cybot.status" x-text="$store.cybot.status"></span>
  </div>
</div>
```

## LLM Client

```js
class LlmClient {
  constructor(config) {
    this.endpoint = config.endpoint;
    this.apiKey = config.apiKey;
    this.model = config.model;
  }
  
  async *stream(messages) {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({ model: this.model, messages, stream: true })
    });
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') return;
          yield JSON.parse(data).choices[0]?.delta?.content || '';
        }
      }
    }
  }
}
```

Reuse same model list and endpoints from cybernaut's `config.js`.

## State Management

```js
document.addEventListener('alpine:init', () => {
  Alpine.store('cybot', {
    scene: null, camera: null, renderer: null,
    activeCharacter: null,
    isAgentThinking: false,
    isChatOpen: true,
    messages: [],
    input: '',
    isSettingsOpen: false,
    activeTheme: 'dark',
    model: 'openai/gpt-4o',
    apiKey: '',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    status: 'idle',
    tokenCount: 0,
    
    init() {},
    async send() {},
    toggleChat() { this.isChatOpen = !this.isChatOpen; },
    applyTheme(id) {},
    setCharacter(id) {}
  });
});
```

## Asset Pipeline

### 3D Models
- Astronaut GLB: low-poly, < 50k triangles, metallic/roughness PBR
- Animations: idle float, talk (embedded in GLB)
- Fallback: procedural capsule mesh (two spheres + glowing visor)

### Textures
- None needed for environment (procedural grid, solid colors)
- Avatar: diffuse + normal + emissive map (packed in GLB)

## Performance Budget

| Metric | Target |
|--------|--------|
| FPS | 60 on mid-range GPU (GTX 1660 / M1) |
| Draw calls | < 30 (scene is simple) |
| Triangles | < 100k |
| Texture memory | < 32MB |
| JS heap | < 100MB |
| First paint | < 1.5s |
| Time to interactive | < 2.5s |

Scene is intentionally simple — void + grid + platform + avatar + 5 shapes + speech bubble. Should be very lightweight.

## Responsive Behavior

```js
onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  this.camera.aspect = w / h;
  this.camera.updateProjectionMatrix();
  this.renderer.setSize(w, h);
  
  if (w < 768) {
    this.cameraRig.setDistance(4.5);
    this.chatOverlay.classList.add('is-fullscreen');
  } else {
    this.cameraRig.setDistance(3.0);
    this.chatOverlay.classList.remove('is-fullscreen');
  }
}
```

## Implementation Phases

### Phase 1: Core Scene
- [ ] Vite project setup + Three.js
- [ ] SceneManager + CameraRig + Lighting
- [ ] Void background + ground grid shader
- [ ] Floating geometric shapes
- [ ] Platform mesh + edge glow
- [ ] Post-processing pipeline
- [ ] Responsive canvas

### Phase 2: Agent Avatar
- [ ] GLB loader + animation mixer
- [ ] Idle float animation
- [ ] Speech bubble (troika-three-text)
- [ ] Fallback capsule mesh
- [ ] Click-to-chat interaction

### Phase 3: Chat UI
- [ ] HTML overlay with Alpine
- [ ] LLM streaming client
- [ ] Message rendering (markdown)
- [ ] Input handling + keyboard shortcuts
- [ ] Settings panel (theme/character/model)

### Phase 4: Theme + Character System
- [ ] ThemeEngine (CSS + 3D sync)
- [ ] Port all 5 built-in themes
- [ ] Character definitions + avatar mapping
- [ ] Custom theme creator
- [ ] Custom character creator

### Phase 5: Polish
- [ ] Tool/skill cards in 3D
- [ ] HUD overlay
- [ ] Loading screen
- [ ] Error states
- [ ] Mobile touch gestures
- [ ] Reduced motion support
- [ ] Performance optimization

### Phase 6: Testing + Deploy
- [ ] Unit tests (scene, agent, llm)
- [ ] Integration tests
- [ ] Render deployment (render.yaml)
- [ ] Cross-browser testing

## File-by-File Creation Order

1. `package.json`
2. `index.html`
3. `src/main.js`
4. `src/scene/SceneManager.js`
5. `src/scene/CameraRig.js`
6. `src/scene/Lighting.js`
7. `src/scene/Environment.js` — void + grid + floating shapes
8. `src/scene/PostProcessing.js`
9. `src/agent/AgentAvatar.js`
10. `src/agent/AgentSpeech.js`
11. `src/ui/ChatOverlay.js`
12. `src/ui/SettingsPanel.js`
13. `src/ui/HUD.js`
14. `src/llm/LlmClient.js`
15. `src/llm/SystemPrompt.js`
16. `src/themes/ThemeEngine.js`
17. `src/themes/themes.json`
18. `src/characters/CharacterEngine.js`
19. `src/characters/characters.json`
20. `src/utils/`
21. `public/models/`
22. `tests/`
23. `render.yaml`

## Key Differences from Cybernaut

| Aspect | Cybernaut (2D) | Cybot (3D) |
|--------|----------------|------------|
| Rendering | CSS + HTML | Three.js WebGL |
| Avatar | 2D image (webp) | 3D model (GLB) |
| Backdrop | CSS gradient layers | Dark void + floating shapes |
| Chat | Fixed panel | Floating overlay on 3D |
| Camera | N/A | OrbitControls + smooth dolly |
| Themes | CSS vars only | CSS vars + 3D material sync |
| Animations | CSS transitions | AnimationMixer + procedural |
| Post-processing | None | Bloom + tone mapping + vignette |
| Personality | Space wallpaper | Playful geometry in void |

## Risks + Mitigations

| Risk | Mitigation |
|------|------------|
| GLB model not ready | Fallback capsule mesh with emissive visor |
| Performance on low-end GPU | Disable bloom, reduce shape count, LDR |
| Mobile WebGL issues | Feature detection → fallback to 2D mode |
| Large bundle size | Code-split Three.js addons, lazy load models |
| Troika text cost | Limit 3D text to speech bubble only |
| Theme sync complexity | Single ThemeEngine owns all color mapping |

## Open Questions

1. **3D model source**: Create astronaut GLB from scratch in Blender, or use a free asset? (Recommendation: create custom to match cybernaut's astronaut aesthetic)
2. **Server-side**: Keep Node.js server for auth/config, or go fully client-side? (Recommendation: start client-only, add server later)
3. **Multi-agent**: Support multiple avatars? (Recommendation: Phase 2 feature)
4. **Voice**: Add TTS/STT? (Recommendation: Phase 2 feature)
5. **VR**: WebXR support? (Recommendation: Nice-to-have, not in v1)

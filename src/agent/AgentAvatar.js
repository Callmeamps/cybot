import * as THREE from 'three';

export class AgentAvatar {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.position = options.position || new THREE.Vector3(0, 1.0, 0);
    this.accentColor = options.accentColor || 0x7ddcff;
    this.reducedMotion = !!options.reducedMotion;
    this.isLoaded = false;
    this.mixer = null;
    this.clock = new THREE.Clock();

    // Animation state
    this.time = 0;
    this.idleBob = { amplitude: this.reducedMotion ? 0 : 0.08, speed: 2.0 };

    // Group to hold avatar parts
    this.group = new THREE.Group();
    this.group.position.copy(this.position);
    this.scene.add(this.group);

    // Build fallback mesh immediately (shows while GLB loads)
    this.buildFallbackMesh();

    // Load GLB (default to public/models/avatar.glb)
    this.loadGLB(options.modelPath || '/models/avatar.glb');
  }

  buildFallbackMesh() {
    this.fallback = new THREE.Group();

    // Body — capsule (cylinder + 2 spheres)
    const bodyRadius = 0.28;
    const bodyHeight = 0.5;

    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a2e,
      metalness: 0.6,
      roughness: 0.3,
    });

    // Cylinder
    const cyl = new THREE.Mesh(
      new THREE.CylinderGeometry(bodyRadius, bodyRadius, bodyHeight, 16),
      bodyMat
    );
    this.fallback.add(cyl);

    // Top sphere (head)
    const topSphere = new THREE.Mesh(
      new THREE.SphereGeometry(bodyRadius, 16, 16),
      bodyMat
    );
    topSphere.position.y = bodyHeight / 2;
    this.fallback.add(topSphere);

    // Bottom sphere
    const bottomSphere = new THREE.Mesh(
      new THREE.SphereGeometry(bodyRadius, 16, 16),
      bodyMat
    );
    bottomSphere.position.y = -bodyHeight / 2;
    this.fallback.add(bottomSphere);

    // Visor — emissive ring
    const visorMat = new THREE.MeshStandardMaterial({
      color: this.accentColor,
      emissive: this.accentColor,
      emissiveIntensity: 0.8,
    });
    const visor = new THREE.Mesh(
      new THREE.TorusGeometry(bodyRadius * 0.7, 0.02, 8, 24),
      visorMat
    );
    visor.rotation.x = Math.PI / 2;
    visor.position.y = bodyHeight / 2;
    visor.position.z = bodyRadius * 0.8;
    this.fallback.add(visor);
    this.visor = visor;

    this.group.add(this.fallback);
  }

  async loadGLB(path) {
    try {
      const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
      const loader = new GLTFLoader();
      const gltf = await loader.loadAsync(path);

      this.model = gltf.scene;
      this.model.scale.setScalar(1.0);
      this.group.add(this.model);

      // Animation mixer
      if (gltf.animations.length > 0 && !this.reducedMotion) {
        this.mixer = new THREE.AnimationMixer(this.model);
        const clip = gltf.animations[0];
        this.idleAction = this.mixer.clipAction(clip);
        this.idleAction.play();
      }

      // Hide fallback
      this.fallback.visible = false;
      this.isLoaded = true;
      document.dispatchEvent(new CustomEvent('cybot:model-loaded', { detail: { loaded: true, path } }));
    } catch (e) {
      console.warn('GLB load failed, using fallback:', e.message);
      document.dispatchEvent(new CustomEvent('cybot:model-loaded', { detail: { loaded: false, path, error: e.message } }));
    }
  }

  setAccentColor(hex) {
    this.accentColor = hex;
    this.visor.material.color.set(hex);
    this.visor.material.emissive.set(hex);
  }

  update(dt) {
    this.time += dt;

    // Idle bob
    if (!this.reducedMotion) {
      const bob = Math.sin(this.time * this.idleBob.speed) * this.idleBob.amplitude;
      this.group.position.y = this.position.y + bob;
    }

    // Visor pulse
    if (this.visor) {
      this.visor.material.emissiveIntensity = this.reducedMotion ? 0.7 : 0.6 + Math.sin(this.time * 3) * 0.2;
    }

    // Update GLB animation if loaded
    if (this.mixer) {
      this.mixer.update(dt);
    }
  }

  // Raycast target for click interaction
  getRaycastTargets() {
    if (this.isLoaded && this.model) {
      const targets = [];
      this.model.traverse((child) => {
        if (child.isMesh) targets.push(child);
      });
      return targets;
    }
    // Fallback mesh targets
    return this.fallback.children.filter((c) => c.isMesh);
  }

  dispose() {
    this.scene.remove(this.group);
    this.fallback.children.forEach((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    });
    if (this.model) {
      this.model.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
    }
  }
}
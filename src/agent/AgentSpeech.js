import * as THREE from 'three';

export class AgentSpeech {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.anchor = options.anchor || new THREE.Vector3(0, 2.0, 0);
    this.accentColor = options.accentColor || 0x7ddcff;
    this.maxWidth = options.maxWidth || 4.0;
    this.isVisible = false;
    this.time = 0;

    // Group for speech bubble
    this.group = new THREE.Group();
    this.group.position.copy(this.anchor);
    this.group.visible = false;
    this.scene.add(this.group);

    // Background panel
    const panelGeo = new THREE.PlaneGeometry(this.maxWidth, 1.2);
    const panelMat = new THREE.MeshStandardMaterial({
      color: 0x11142b,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
    });
    this.panel = new THREE.Mesh(panelGeo, panelMat);
    this.group.add(this.panel);

    // Border ring (emissive accent)
    const borderGeo = new THREE.EdgesGeometry(panelGeo);
    const borderMat = new THREE.LineBasicMaterial({
      color: this.accentColor,
      transparent: true,
      opacity: 0.8,
    });
    this.border = new THREE.LineSegments(borderGeo, borderMat);
    this.group.add(this.border);

    // Text content
    this.textMesh = null;
    this.textContent = '';
  }

  async setText(text) {
    this.textContent = text;

    // Remove old text
    if (this.textMesh) {
      this.group.remove(this.textMesh);
      this.textMesh.dispose();
      this.textMesh = null;
    }

    if (!text) return;

    try {
      const { Text } = await import('troika-three-text');
      this.textMesh = new Text();
      this.textMesh.text = text;
      this.textMesh.fontSize = 0.15;
      this.textMesh.color = 0xffffff;
      this.textMesh.anchorX = 'center';
      this.textMesh.anchorY = 'middle';
      this.textMesh.maxWidth = this.maxWidth - 0.4;
      this.textMesh.sync();
      this.textMesh.position.z = 0.01;
      this.group.add(this.textMesh);
    } catch (e) {
      console.warn('troika-three-text load failed:', e.message);
    }
  }

  show(text) {
    this.group.visible = true;
    this.isVisible = true;
    this.scale = 0;
    if (text) this.setText(text);
  }

  hide() {
    this.group.visible = false;
    this.isVisible = false;
    this.textContent = '';
    if (this.textMesh) {
      this.group.remove(this.textMesh);
      this.textMesh.dispose();
      this.textMesh = null;
    }
  }

  setAccentColor(hex) {
    this.accentColor = hex;
    this.border.material.color.set(hex);
  }

  update(dt, camera) {
    if (!this.isVisible) return;
    this.time += dt;

    // Scale-in animation
    if (this.scale < 1) {
      this.scale = Math.min(this.scale + dt * 4, 1);
      const ease = 1 - Math.pow(1 - this.scale, 3); // ease-out cubic
      this.group.scale.set(ease, ease, ease);
    }

    // Face camera (billboard)
    if (camera) {
      this.group.quaternion.copy(camera.quaternion);
    }
  }

  dispose() {
    this.scene.remove(this.group);
    this.panel.geometry.dispose();
    this.panel.material.dispose();
    this.border.geometry.dispose();
    this.border.material.dispose();
    if (this.textMesh) {
      this.textMesh.dispose();
    }
  }
}
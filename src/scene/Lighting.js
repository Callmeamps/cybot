import * as THREE from 'three';

export class Lighting {
  constructor(scene) {
    this.scene = scene;
    this.accentColor = new THREE.Color(0x7ddcff);

    // Ambient
    this.ambient = new THREE.AmbientLight(0xb8c4da, 0.12);
    this.scene.add(this.ambient);

    // Key light
    this.key = new THREE.DirectionalLight(0xf3f7ff, 1.0);
    this.key.position.set(5, 8, 3);
    this.scene.add(this.key);

    // Fill light
    this.fill = new THREE.DirectionalLight(0x7ddcff, 0.3);
    this.fill.position.set(-3, 2, -2);
    this.scene.add(this.fill);

    // Rim light
    this.rim = new THREE.SpotLight(0x7ddcff, 0.6);
    this.rim.position.set(0, 3, -5);
    this.rim.target.position.set(0, 1, 0);
    this.scene.add(this.rim);
    this.scene.add(this.rim.target);
  }

  setAccentColor(hex) {
    this.accentColor.set(hex);
    this.fill.color.set(hex);
    this.rim.color.set(hex);
  }

  dispose() {
    this.scene.remove(this.ambient);
    this.scene.remove(this.key);
    this.scene.remove(this.fill);
    this.scene.remove(this.rim);
    this.scene.remove(this.rim.target);
  }
}
import * as THREE from 'three';
import { getPerformanceSettings } from '../performance/GpuProfiler.js';

export class Environment {
  constructor(scene, performanceSettings = null) {
    this.scene = scene;
    this.shapes = [];
    this.time = 0;

    const settings = performanceSettings || getPerformanceSettings(1);
    const reducedMotion = !!settings.reducedMotion;

    // Ground grid
    const gridGeometry = new THREE.PlaneGeometry(100, 100);
    const gridMaterial = new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.DoubleSide,
      uniforms: {
        uGridColor: { value: new THREE.Color(0x1a1f3d) },
        uGridScale: { value: 2.0 },
        uGridThickness: { value: 0.02 },
        uFadeNear: { value: 8.0 },
        uFadeFar: { value: 20.0 },
        uOpacity: { value: 0.15 },
      },
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision mediump float;
        uniform vec3 uGridColor;
        uniform float uGridScale;
        uniform float uGridThickness;
        uniform float uFadeNear;
        uniform float uFadeFar;
        uniform float uOpacity;
        varying vec3 vWorldPos;
        void main() {
          float grid = abs(fract(vWorldPos.x * uGridScale) - 0.5) + abs(fract(vWorldPos.z * uGridScale) - 0.5);
          float line = 1.0 - smoothstep(0.0, uGridThickness, grid - 0.48);
          float dist = length(vWorldPos.xz);
          float fade = 1.0 - smoothstep(uFadeNear, uFadeFar, dist);
          gl_FragColor = vec4(uGridColor, line * fade * uOpacity);
        }
      `,
    });
    const grid = new THREE.Mesh(gridGeometry, gridMaterial);
    grid.rotation.x = -Math.PI / 2;
    this.scene.add(grid);
    this.grid = grid;

    // Platform
    const platformSegs = settings.platformSegments || 64;
    const platformGeometry = new THREE.CylinderGeometry(1.5, 1.5, 0.1, platformSegs);
    const platformMaterial = new THREE.MeshStandardMaterial({
      color: 0x11142b,
      metalness: 0.7,
      roughness: 0.3,
    });
    this.platform = new THREE.Mesh(platformGeometry, platformMaterial);
    this.platform.position.set(0, 0, 0);
    this.scene.add(this.platform);

    // Platform edge glow
    const edgeGeometry = new THREE.TorusGeometry(1.5, 0.04, 8, platformSegs);
    const accent = 0x7ddcff;
    const edgeMaterial = new THREE.MeshStandardMaterial({
      color: accent,
      emissive: accent,
      emissiveIntensity: 0.6,
    });
    this.platformEdge = new THREE.Mesh(edgeGeometry, edgeMaterial);
    this.platformEdge.rotation.x = -Math.PI / 2;
    this.platformEdge.position.set(0, 0.05, 0);
    this.scene.add(this.platformEdge);

    // Floating geometric shapes (respect shapeCount from settings)
    const allShapes = [
      { type: 'torus', pos: [-3, 1.5, -4], rotSpeed: 0.3, bobSpeed: 0.5, bobAmp: 0.15, color: 0xff6b6b },
      { type: 'icosahedron', pos: [3.5, 2, -3], rotSpeed: 0.2, bobSpeed: 0.7, bobAmp: 0.2, color: 0x4ecdc4 },
      { type: 'octahedron', pos: [-2, 2.5, -5], rotSpeed: 0.4, bobSpeed: 0.6, bobAmp: 0.1, color: 0xffe66d },
      { type: 'dodecahedron', pos: [2, 0.8, -3.5], rotSpeed: 0.25, bobSpeed: 0.4, bobAmp: 0.18, color: 0x9b5de5 },
      { type: 'torusKnot', pos: [0, 3, -6], rotSpeed: 0.15, bobSpeed: 0.3, bobAmp: 0.12, color: 0xf15bb5 },
    ];

    const seg = settings.shapeSegments || {};
    for (let i = 0; i < Math.min(allShapes.length, settings.shapeCount || 5); i++) {
      const config = allShapes[i];
      let geometry;
      switch (config.type) {
        case 'torus':
          geometry = new THREE.TorusGeometry(0.4, 0.12, seg.torus?.[0] || 8, seg.torus?.[1] || 24);
          break;
        case 'icosahedron':
          geometry = new THREE.IcosahedronGeometry(0.35, seg.icosa || 0);
          break;
        case 'octahedron':
          geometry = new THREE.OctahedronGeometry(0.3, seg.octa || 0);
          break;
        case 'dodecahedron':
          geometry = new THREE.DodecahedronGeometry(0.25, seg.dodeca || 0);
          break;
        case 'torusKnot':
          geometry = new THREE.TorusKnotGeometry(0.2, 0.06, seg.knot?.[0] || 48, seg.knot?.[1] || 8);
          break;
      }

      const material = new THREE.MeshStandardMaterial({
        color: 0x111111,
        emissive: config.color,
        emissiveIntensity: 0.6,
        metalness: 0.3,
        roughness: 0.7,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(...config.pos);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      this.scene.add(mesh);

      this.shapes.push({
        mesh,
        basePos: new THREE.Vector3(...config.pos),
        rotSpeed: reducedMotion ? 0 : config.rotSpeed,
        bobSpeed: reducedMotion ? 0 : config.bobSpeed,
        bobAmp: reducedMotion ? 0 : config.bobAmp,
        randomOffset: Math.random() * Math.PI * 2,
      });
    }
  }

  updateColors({ accentColor, surfaceColor, gridColor }) {
    if (this.grid?.material?.uniforms?.uGridColor) {
      this.grid.material.uniforms.uGridColor.value.set(gridColor || '#1a1f3d');
    }

    if (this.platform?.material) {
      this.platform.material.color.set(surfaceColor || '#11142b');
    }

    if (this.platformEdge?.material) {
      const accent = accentColor || '#7ddcff';
      this.platformEdge.material.color.set(accent);
      this.platformEdge.material.emissive.set(accent);
    }

    for (const shape of this.shapes) {
      if (shape.mesh.material) {
        const accent = accentColor || '#7ddcff';
        shape.mesh.material.emissive.set(accent);
      }
    }
  }

  update(dt) {
    this.time += dt;

    for (const shape of this.shapes) {
      shape.mesh.rotation.x += shape.rotSpeed * dt;
      shape.mesh.rotation.y += shape.rotSpeed * dt * 0.7;
      const bob = Math.sin(this.time * shape.bobSpeed + shape.randomOffset) * shape.bobAmp;
      shape.mesh.position.y = shape.basePos.y + bob;
    }
  }

  dispose() {
    for (const shape of this.shapes) {
      shape.mesh.geometry.dispose();
      shape.mesh.material.dispose();
      this.scene.remove(shape.mesh);
    }
    this.shapes = [];
    this.grid.geometry.dispose();
    this.grid.material.dispose();
    this.scene.remove(this.grid);
    this.platform.geometry.dispose();
    this.platform.material.dispose();
    this.scene.remove(this.platform);
    this.platformEdge.geometry.dispose();
    this.platformEdge.material.dispose();
    this.scene.remove(this.platformEdge);
  }
}
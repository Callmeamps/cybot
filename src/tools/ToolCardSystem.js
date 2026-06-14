import * as THREE from 'three';
import TOOLS from './tools.json';

export class ToolCardSystem {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.camera = options.camera;
    this.canvas = options.canvas || document.querySelector('canvas');
    this.accentColor = options.accentColor || 0x7ddcff;
    this.reducedMotion = !!options.reducedMotion;
    this.isMobile = window.innerWidth < 768 || navigator.maxTouchPoints > 0;

    this.group = new THREE.Group();
    this.group.position.set(0, 1.25, 1.35);
    this.scene.add(this.group);

    this.cards = [];
    this.hovered = null;
    this.pointer = new THREE.Vector2();
    this.raycaster = new THREE.Raycaster();
    this.time = 0;

    this.createCards();

    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerLeave = this.onPointerLeave.bind(this);
    this.onCardClick = this.onCardClick.bind(this);

    if (this.canvas) {
      this.canvas.addEventListener('pointermove', this.onPointerMove);
      this.canvas.addEventListener('pointerleave', this.onPointerLeave);
      this.canvas.addEventListener('click', this.onCardClick);
    }
  }

  createCards() {
    const count = TOOLS.length;
    const radius = this.isMobile ? 1.75 : 2.25;
    const span = this.isMobile ? 0.9 : 1.25;

    TOOLS.forEach((tool, index) => {
      const t = count === 1 ? 0 : index / (count - 1);
      const angle = -span + t * span * 2;
      const card = {
        tool,
        mesh: null,
        texture: null,
        material: null,
        basePosition: new THREE.Vector3(Math.sin(angle) * radius, Math.sin(t * Math.PI) * 0.16, Math.cos(angle) * 0.35 - 0.25),
        targetScale: 1,
        scale: 0.01,
        phase: Math.random() * Math.PI * 2,
      };

      const geometry = new THREE.PlaneGeometry(this.isMobile ? 0.72 : 0.86, this.isMobile ? 0.28 : 0.34, 1, 1);
      const texture = this.createTexture(tool);
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0.82,
        side: THREE.DoubleSide,
        depthWrite: false,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(card.basePosition);
      mesh.scale.setScalar(card.scale);
      mesh.renderOrder = 20;
      mesh.userData.card = card;

      card.mesh = mesh;
      card.texture = texture;
      card.material = material;
      this.cards.push(card);
      this.group.add(mesh);
    });
  }

  createTexture(tool) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 192;
    const ctx = canvas.getContext('2d');
    const accent = new THREE.Color(this.accentColor).getStyle();

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Soft card glow
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, 'rgba(8, 14, 34, 0.92)');
    gradient.addColorStop(1, 'rgba(18, 28, 58, 0.82)');
    this.roundRect(ctx, 10, 10, canvas.width - 20, canvas.height - 20, 28);
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.lineWidth = 3;
    ctx.strokeStyle = accent;
    ctx.stroke();

    ctx.shadowColor = accent;
    ctx.shadowBlur = 18;

    ctx.font = '42px Segoe UI, system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(tool.icon, 62, 92);

    ctx.shadowBlur = 0;
    ctx.textAlign = 'left';
    ctx.font = '700 30px Segoe UI, system-ui, sans-serif';
    ctx.fillStyle = '#f3f7ff';
    ctx.fillText(tool.label.toUpperCase(), 112, 76);

    ctx.font = '22px Segoe UI, system-ui, sans-serif';
    ctx.fillStyle = 'rgba(220, 232, 255, 0.78)';
    this.wrapText(ctx, tool.description, 112, 118, 360, 28);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 1;
    return texture;
  }

  roundRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = String(text).split(' ');
    let line = '';
    let yy = y;

    for (let n = 0; n < words.length; n++) {
      const testLine = `${line}${words[n]} `;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        ctx.fillText(line, x, yy);
        line = `${words[n]} `;
        yy += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, yy);
  }

  setAccentColor(hex) {
    this.accentColor = hex;
    this.cards.forEach((card) => {
      if (card.texture) card.texture.dispose();
      card.texture = this.createTexture(card.tool);
      card.material.map = card.texture;
      card.material.needsUpdate = true;
    });
  }

  setHovered(card) {
    if (this.hovered === card) return;

    if (this.hovered) {
      this.hovered.targetScale = 1;
      this.hovered.material.opacity = 0.82;
    }

    this.hovered = card || null;

    if (this.hovered) {
      this.hovered.targetScale = this.reducedMotion ? 1 : 1.12;
      this.hovered.material.opacity = 1;
    }
  }

  onPointerMove(event) {
    if (!this.camera || !this.canvas) return;

    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.cards.map((card) => card.mesh), true);
    const card = hits.length ? hits[0].object.userData.card : null;
    this.setHovered(card);
  }

  onPointerLeave() {
    this.setHovered(null);
  }

  onCardClick(event) {
    if (!this.hovered) return;
    event.stopPropagation();
    document.dispatchEvent(new CustomEvent('cybot:tool-selected', {
      detail: this.hovered.tool,
    }));
  }

  update(dt) {
    this.time += dt;

    this.cards.forEach((card) => {
      const hoverScale = this.hovered === card ? card.targetScale : 1;
      card.scale = THREE.MathUtils.lerp(card.scale, hoverScale, Math.min(1, dt * 8));
      card.mesh.scale.setScalar(card.scale);

      if (!this.reducedMotion) {
        card.mesh.position.y = card.basePosition.y + Math.sin(this.time * 1.2 + card.phase) * 0.035;
        card.mesh.rotation.y = Math.sin(this.time * 0.8 + card.phase) * 0.035;
      }
    });
  }

  dispose() {
    if (this.canvas) {
      this.canvas.removeEventListener('pointermove', this.onPointerMove);
      this.canvas.removeEventListener('pointerleave', this.onPointerLeave);
      this.canvas.removeEventListener('click', this.onCardClick);
    }

    this.cards.forEach((card) => {
      this.group.remove(card.mesh);
      card.mesh.geometry.dispose();
      card.mesh.material.dispose();
      if (card.texture) card.texture.dispose();
    });

    this.scene.remove(this.group);
  }
}

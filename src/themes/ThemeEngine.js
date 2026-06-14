import * as THREE from 'three';
import THEMES from './themes.json';

export const THEME_STORAGE_KEY = 'cybot.themes';
export const ACTIVE_THEME_KEY = 'cybot.activeTheme';

const THEME_COLOR_KEYS = [
  '--color-canvas',
  '--color-canvas-elevated',
  '--color-canvas-deep',
  '--color-surface-1',
  '--color-surface-2',
  '--color-surface-3',
  '--color-surface-glass',
  '--color-border-soft',
  '--color-border-strong',
  '--color-text-primary',
  '--color-text-secondary',
  '--color-text-tertiary',
  '--color-accent-primary',
  '--color-accent-primary-strong',
  '--color-accent-primary-soft',
  '--color-accent-secondary',
  '--color-accent-ink',
  '--color-status-success',
  '--color-status-warning',
  '--color-status-danger',
  '--color-layer-overlay',
  '--color-backdrop-glow-primary',
  '--color-backdrop-glow-secondary',
  '--color-backdrop-glow-depth',
];

const CYBOT_CSS_KEYS = {
  '--color-canvas': '--cybot-canvas',
  '--color-canvas-deep': '--cybot-canvas-deep',
  '--color-canvas-elevated': '--cybot-canvas-elevated',
  '--color-surface-1': '--cybot-surface',
  '--color-surface-2': '--cybot-surface-2',
  '--color-surface-3': '--cybot-surface-3',
  '--color-surface-glass': '--cybot-surface-glass',
  '--color-border-soft': '--cybot-border-soft',
  '--color-border-strong': '--cybot-border-strong',
  '--color-text-primary': '--cybot-text-primary',
  '--color-text-secondary': '--cybot-text-secondary',
  '--color-text-tertiary': '--cybot-text-tertiary',
  '--color-accent-primary': '--cybot-accent-primary',
  '--color-accent-primary-strong': '--cybot-accent-primary-strong',
  '--color-accent-primary-soft': '--cybot-accent-primary-soft',
  '--color-accent-secondary': '--cybot-accent-secondary',
  '--color-accent-ink': '--cybot-accent-ink',
  '--color-status-success': '--cybot-status-success',
  '--color-status-warning': '--cybot-status-warning',
  '--color-status-danger': '--cybot-status-danger',
  '--color-layer-overlay': '--cybot-layer-overlay',
  '--color-backdrop-glow-primary': '--cybot-holo-glow',
  '--color-backdrop-glow-secondary': '--cybot-holo-glow-secondary',
  '--color-backdrop-glow-depth': '--cybot-holo-glow-depth',
};

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function cloneTheme(theme) {
  return {
    ...theme,
    colors: { ...theme.colors },
  };
}

export class ThemeEngine {
  constructor(options = {}) {
    this.scene = options.scene;
    this.lighting = options.lighting;
    this.environment = options.environment;
    this.avatar = options.avatar;
    this.speech = options.speech;
    this.sceneManager = options.sceneManager;
    this.storageKey = options.storageKey || THEME_STORAGE_KEY;
  }

  getBuiltInThemes() {
    return THEMES;
  }

  getCustomThemes() {
    return JSON.parse(localStorage.getItem(this.storageKey) || '[]');
  }

  getThemes() {
    return [...this.getBuiltInThemes(), ...this.getCustomThemes()];
  }

  getTheme(id) {
    return this.getThemes().find((theme) => theme.id === id) || this.getBuiltInThemes()[0];
  }

  getActiveThemeId() {
    return localStorage.getItem(ACTIVE_THEME_KEY) || 'dark';
  }

  getActiveTheme() {
    const active = this.getTheme(this.getActiveThemeId());
    return this.resolveSystemTheme(active);
  }

  resolveSystemTheme(theme) {
    if (theme.id !== 'system') return cloneTheme(theme);

    const prefersLight = window.matchMedia?.('(prefers-color-scheme: light)').matches;
    const resolved = this.getBuiltInThemes().find((item) => item.id === (prefersLight ? 'light' : 'dark'));
    return {
      ...theme,
      colors: { ...resolved.colors },
      bloomIntensity: resolved.bloomIntensity,
      _resolvedFrom: resolved.id,
    };
  }

  setActiveTheme(id) {
    const theme = this.getTheme(id);
    if (!theme) return null;

    localStorage.setItem(ACTIVE_THEME_KEY, id);
    this.applyTheme(id);
    document.dispatchEvent(new CustomEvent('cybot:theme-change', { detail: { themeId: id } }));
    return theme;
  }

  applyTheme(id) {
    const theme = this.resolveTheme(id);
    this.applyCssVariables(theme);
    this.updateSceneColors(theme);
  }

  resolveTheme(id) {
    const theme = this.getTheme(id);
    return this.resolveSystemTheme(theme);
  }

  applyCssVariables(theme) {
    const root = document.documentElement;
    root.style.setProperty('--cybot-theme-id', theme.id);
    root.style.setProperty('--cybot-theme-mode', theme.base);

    Object.entries(theme.colors).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    Object.entries(CYBOT_CSS_KEYS).forEach(([source, target]) => {
      root.style.setProperty(target, theme.colors[source] || '');
    });
  }

  updateSceneColors(theme) {
    const colors = theme.colors;
    const accent = colors['--color-accent-primary'] || '#7ddcff';
    const canvas = colors['--color-canvas-deep'] || colors['--color-canvas'] || '#050816';
    const surface = colors['--color-surface-3'] || colors['--color-surface-1'] || '#182540';
    const grid = colors['--color-surface-1'] || '#0d1628';

    if (this.scene) {
      this.scene.background = new THREE.Color(canvas);
    }

    if (this.lighting) {
      this.lighting.setAccentColor(accent);
    }

    if (this.environment) {
      this.environment.updateColors({ accentColor: accent, surfaceColor: surface, gridColor: grid });
    }

    if (this.avatar) {
      this.avatar.setAccentColor(accent);
    }

    if (this.speech) {
      this.speech.setAccentColor(accent);
    }

    if (this.toolCards) {
      this.toolCards.setAccentColor(accent);
    }

    if (this.sceneManager?.bloomPass) {
      this.sceneManager.bloomPass.strength = theme.bloomIntensity || 0.35;
    }
  }

  createTheme(input = {}) {
    const id = slugify(input.id || input.label);
    const label = String(input.label || '').trim();
    const base = ['dark', 'light'].includes(input.base) ? input.base : 'dark';
    const errors = [];

    if (!id) errors.push('Theme ID is required');
    if (!label) errors.push('Theme name is required');
    if (this.getBuiltInThemes().some((theme) => theme.id === id)) errors.push(`Theme '${id}' conflicts with a built-in theme`);
    if (this.getCustomThemes().some((theme) => theme.id === id)) errors.push(`Theme '${id}' already exists`);

    if (errors.length) {
      console.warn(errors.join('\n'));
      return null;
    }

    const baseTheme = this.getBuiltInThemes().find((theme) => theme.id === base);
    const colors = { ...baseTheme.colors };

    if (input.accent) {
      colors['--color-accent-primary'] = input.accent;
      colors['--color-accent-primary-strong'] = input.accent;
      colors['--color-accent-primary-soft'] = `${input.accent}24`;
      colors['--color-accent-secondary'] = input.accentSecondary || input.accent;
    }

    if (input.canvas) {
      colors['--color-canvas'] = input.canvas;
      colors['--color-canvas-deep'] = input.canvasDeep || input.canvas;
    }

    if (input.surface) {
      colors['--color-surface-1'] = input.surface;
      colors['--color-surface-2'] = input.surface2 || input.surface;
      colors['--color-surface-3'] = input.surface3 || input.surface;
    }

    if (input.text) {
      colors['--color-text-primary'] = input.text;
      colors['--color-text-secondary'] = input.textSecondary || input.text;
    }

    const theme = {
      id,
      label,
      icon: input.icon || '🎨',
      description: input.description || 'Custom theme',
      base,
      bloomIntensity: input.bloomIntensity || baseTheme.bloomIntensity,
      colors,
      custom: true,
    };

    const customThemes = this.getCustomThemes();
    customThemes.push(theme);
    localStorage.setItem(this.storageKey, JSON.stringify(customThemes));

    return theme;
  }

  deleteTheme(id) {
    const customThemes = this.getCustomThemes().filter((theme) => theme.id !== id);
    localStorage.setItem(this.storageKey, JSON.stringify(customThemes));
  }
}
import CHARACTERS from './characters.json';

export const CUSTOM_CHARACTERS_STORAGE_KEY = 'cybot.customCharacters';
export const ACTIVE_CHARACTER_KEY = 'cybot.activeCharacter';
export const SETTINGS_STORAGE_KEY = 'cybot-settings';

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export class CharacterEngine {
  constructor(options = {}) {
    this.storageKey = options.storageKey || SETTINGS_STORAGE_KEY;
  }

  getBuiltInCharacters() {
    return CHARACTERS;
  }

  getCustomCharacters() {
    return JSON.parse(localStorage.getItem(CUSTOM_CHARACTERS_STORAGE_KEY) || '[]');
  }

  getCharacters() {
    return [...this.getBuiltInCharacters(), ...this.getCustomCharacters()];
  }

  getCharacter(id) {
    return this.getCharacters().find((character) => character.id === id) || this.getBuiltInCharacters()[0];
  }

  getActiveCharacterId() {
    const saved = JSON.parse(localStorage.getItem(this.storageKey) || '{}');
    return saved.character || localStorage.getItem(ACTIVE_CHARACTER_KEY) || 'default';
  }

  getActiveCharacter() {
    return this.getCharacter(this.getActiveCharacterId());
  }

  setActiveCharacter(id) {
    const character = this.getCharacter(id);
    if (!character) return null;

    const saved = JSON.parse(localStorage.getItem(this.storageKey) || '{}');
    saved.character = id;
    localStorage.setItem(this.storageKey, JSON.stringify(saved));
    localStorage.setItem(ACTIVE_CHARACTER_KEY, id);

    document.dispatchEvent(new CustomEvent('cybot:character-change', { detail: { characterId: id } }));
    return character;
  }

  createCharacter(input = {}) {
    const id = slugify(input.id || input.name);
    const name = String(input.name || '').trim();
    const emoji = String(input.emoji || '').trim();
    const errors = [];

    if (!id) errors.push('Character ID is required');
    if (!name) errors.push('Character name is required');
    if (!emoji) errors.push('Character emoji is required');
    if (this.getCharacters().some((character) => character.id === id)) errors.push(`Character '${id}' already exists`);

    if (errors.length) {
      console.warn(errors.join('\n'));
      return null;
    }

    const character = {
      id,
      name,
      emoji,
      avatar: input.avatar || '',
      modelPath: input.modelPath || '/models/avatar.glb',
      fallbackColor: input.fallbackColor || '#7ddcff',
      description: input.description || 'Custom character',
      systemPromptPrefix: input.systemPromptPrefix || '',
      custom: true,
    };

    const customCharacters = this.getCustomCharacters();
    customCharacters.push(character);
    localStorage.setItem(CUSTOM_CHARACTERS_STORAGE_KEY, JSON.stringify(customCharacters));

    return character;
  }

  deleteCharacter(id) {
    const customCharacters = this.getCustomCharacters().filter((character) => character.id !== id);
    localStorage.setItem(CUSTOM_CHARACTERS_STORAGE_KEY, JSON.stringify(customCharacters));
  }
}
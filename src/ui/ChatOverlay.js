import Alpine from 'alpinejs';
import { LlmClient } from '../llm/LlmClient.js';
import { ThemeEngine } from '../themes/ThemeEngine.js';
import { CharacterEngine } from '../characters/CharacterEngine.js';

function renderMarkdown(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code style="background:var(--cybot-accent-primary-soft);padding:1px 5px;border-radius:3px;">$1</code>')
    .replace(/\n/g, '<br>');
}

function normalizeErrorMessage(text) {
  const value = String(text || '').trim();
  if (value.startsWith('[Error')) return value.replace(/^\[Error:?\s*/, '').replace(/\]$/, '');
  return value;
}

let msgId = 0;

window.Alpine = Alpine;

Alpine.data('chatApp', () => ({
    themeEngine: new ThemeEngine(),
    characterEngine: new CharacterEngine(),

    messages: [],
    input: '',
    isThinking: false,
    isChatOpen: true,
    isSettingsOpen: false,
    model: 'openai/gpt-4o-mini',
    character: 'default',
    theme: 'dark',
    apiKey: '',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    modelName: 'GPT-4o Mini',
    status: 'idle',
    isLoading: true,
    loadingText: 'Warming the holo-grid…',
    lastError: '',
    hudCharacter: 'Cybot',
    hudModel: 'GPT-4o Mini',
    hudTheme: 'Dark',
    hudGpu: 'GPU ?',
    hudFps: 'FPS 0',
    activeCharacter: null,
    themes: [],
    characters: [],
    llm: null,

    customTheme: {
      id: '',
      label: '',
      base: 'dark',
      accent: '#7ddcff',
      accentSecondary: '#79edd8',
      canvas: '#050816',
      canvasDeep: '#02050d',
      surface: '#0d1628',
      surface2: '#121d33',
      surface3: '#182540',
      text: '#f3f7ff',
      textSecondary: '#b8c4da',
    },

    customCharacter: {
      id: '',
      name: '',
      emoji: '🤖',
      description: '',
      modelPath: '/models/avatar.glb',
      fallbackColor: '#7ddcff',
      systemPromptPrefix: '',
    },

    init() {
      this.themes = this.themeEngine.getThemes();
      this.characters = this.characterEngine.getCharacters();

      const saved = JSON.parse(localStorage.getItem('cybot-settings') || '{}');
      this.apiKey = saved.apiKey || '';
      this.endpoint = saved.endpoint || this.endpoint;
      this.model = saved.model || this.model;
      this.character = this.characterEngine.getActiveCharacterId();
      this.theme = this.themeEngine.getActiveThemeId();
      this.modelName = this.model.split('/').pop();
      this.activeCharacter = this.characterEngine.getActiveCharacter();

      this.llm = new LlmClient({
        endpoint: this.endpoint,
        apiKey: this.apiKey,
        model: this.model,
        systemPrompt: this.activeCharacter.systemPromptPrefix || '',
      });

      this.messages.push({
        id: ++msgId,
        role: 'agent',
        content: `Hello! I'm ${this.activeCharacter.name}. How can I help?`,
        html: renderMarkdown(`Hello! I'm ${this.activeCharacter.name}. How can I help?`),
      });

      document.addEventListener('keydown', (e) => {
        if (e.key === '/' && !e.ctrlKey && !e.metaKey && document.activeElement?.tagName !== 'TEXTAREA') {
          e.preventDefault();
          this.isChatOpen = true;
          this.$refs.input?.focus();
        }
        if (e.key === 'Escape') {
          this.isChatOpen = false;
          this.isSettingsOpen = false;
        }
      });

      document.addEventListener('cybot:toggle-chat', () => {
        this.isChatOpen = !this.isChatOpen;
        if (this.isChatOpen) this.$refs.input?.focus();
      });

      document.addEventListener('cybot:model-loaded', () => {
        this.hideLoading();
      });

      document.addEventListener('cybot:tool-context', (event) => {
        this.selectTool(event.detail);
      });

      this.refreshHud();
      this.hudTimer = setInterval(() => this.refreshHud(), 1000);
      setTimeout(() => this.hideLoading(), 3500);
    },

    async send() {
      const text = this.input.trim();
      if (!text || this.isThinking) return;

      this.messages.push({
        id: ++msgId,
        role: 'user',
        content: text,
        html: renderMarkdown(text),
      });
      this.input = '';
      this.scrollDown();

      this.isThinking = true;
      this.status = 'streaming';

      const agentMsg = { id: ++msgId, role: 'agent', content: '', html: '' };
      this.messages.push(agentMsg);
      this.scrollDown();

      const chatHistory = this.messages
        .filter((m) => m.role === 'user' || m.role === 'agent')
        .slice(-20)
        .map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }));

      try {
        for await (const token of this.llm.stream(chatHistory)) {
          agentMsg.content += token;
          agentMsg.html = renderMarkdown(agentMsg.content);
          this.scrollDown();
        }
      } catch (e) {
        const error = this.normalizeError(e.message);
        agentMsg.content += `\n\n[Stream error: ${error}]`;
        agentMsg.html = renderMarkdown(agentMsg.content);
        this.lastError = error;
      }

      if (this.isErrorMessage(agentMsg.content)) {
        this.lastError = this.normalizeError(agentMsg.content);
      }

      this.isThinking = false;
      this.status = 'idle';
      this.scrollDown();
    },

    toggleChat() {
      this.isChatOpen = !this.isChatOpen;
    },

    scrollDown() {
      this.$nextTick(() => {
        const el = this.$refs.messages;
        if (el) el.scrollTop = el.scrollHeight;
      });
    },

    saveSettings() {
      localStorage.setItem('cybot-settings', JSON.stringify({
        apiKey: this.apiKey,
        endpoint: this.endpoint,
        model: this.model,
        character: this.character,
        theme: this.theme,
      }));
      this.modelName = this.model.split('/').pop();
      if (this.llm) {
        this.llm.endpoint = this.endpoint;
        this.llm.apiKey = this.apiKey;
        this.llm.model = this.model;
      }
      this.refreshHud();
    },

    changeTheme() {
      this.themeEngine.setActiveTheme(this.theme);
      this.saveSettings();
      this.refreshHud();
    },

    changeCharacter() {
      this.characterEngine.setActiveCharacter(this.character);
      this.saveSettings();
    },

    createTheme() {
      const theme = this.themeEngine.createTheme(this.customTheme);
      if (!theme) return;

      this.theme = theme.id;
      this.themes = this.themeEngine.getThemes();
      this.themeEngine.setActiveTheme(theme.id);
      this.saveSettings();
      this.resetCustomTheme();
    },

    createCharacter() {
      const character = this.characterEngine.createCharacter(this.customCharacter);
      if (!character) return;

      this.character = character.id;
      this.characters = this.characterEngine.getCharacters();
      this.characterEngine.setActiveCharacter(character.id);
      this.saveSettings();
      this.resetCustomCharacter();
    },

    resetCustomTheme() {
      this.customTheme = {
        id: '',
        label: '',
        base: 'dark',
        accent: '#7ddcff',
        accentSecondary: '#79edd8',
        canvas: '#050816',
        canvasDeep: '#02050d',
        surface: '#0d1628',
        surface2: '#121d33',
        surface3: '#182540',
        text: '#f3f7ff',
        textSecondary: '#b8c4da',
      };
    },

    resetCustomCharacter() {
      this.customCharacter = {
        id: '',
        name: '',
        emoji: '🤖',
        description: '',
        modelPath: '/models/avatar.glb',
        fallbackColor: '#7ddcff',
        systemPromptPrefix: '',
      };
    },

    selectTool(tool) {
      this.input = `${tool?.context || 'Help me with this.'} `;
      this.isChatOpen = true;
      this.$nextTick(() => this.$refs.input?.focus());
    },

    dismissError() {
      this.lastError = '';
    },

    hideLoading() {
      this.isLoading = false;
      this.loadingText = '';
    },

    refreshHud() {
      const theme = this.themeEngine.getActiveTheme();
      const gpu = window.cybot?.gpuInfo;
      const fps = Math.round(window.cybot?.sceneManager?.currentFps || 0);

      this.hudCharacter = this.activeCharacter ? `${this.activeCharacter.emoji} ${this.activeCharacter.name}` : 'Cybot';
      this.hudModel = this.modelName;
      this.hudTheme = `${theme.icon || '🎨'} ${theme.label}`;
      this.hudGpu = gpu ? `GPU ${gpu.tier}` : 'GPU ?';
      this.hudFps = `FPS ${fps}`;
    },

    normalizeError(message) {
      return normalizeErrorMessage(message);
    },

    isErrorMessage(text) {
      return String(text || '').includes('[Error');
    },
  }));

Alpine.start();
export class LlmClient {
  constructor(config = {}) {
    this.endpoint = config.endpoint || 'https://openrouter.ai/api/v1/chat/completions';
    this.apiKey = config.apiKey || '';
    this.model = config.model || 'openai/gpt-4o-mini';
    this.systemPrompt = config.systemPrompt || '';
  }

  async *stream(messages) {
    const requestMessages = this.systemPrompt
      ? [{ role: 'system', content: this.systemPrompt }, ...messages]
      : messages;

    if (!this.apiKey) {
      yield '[Error: API key not set. Open Settings (⚙) to configure.]';
      return;
    }

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: requestMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      yield `[Error ${response.status}: ${err}]`;
      return;
    }

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
          try {
            const parsed = JSON.parse(data);
            const token = parsed.choices?.[0]?.delta?.content;
            if (token) yield token;
          } catch {
            // skip malformed lines
          }
        }
      }
    }
  }
}
import { CompletionOptions, CompletionResponse } from '../agent/agent-brain';

interface OllamaMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
}

interface OllamaData {
  message?: {
    content?: string;
    tool_calls?: Array<{
      function?: {
        name?: string;
        arguments?: Record<string, unknown>;
      };
    }>;
  };
}

export class OllamaAdapter {
  private baseUrl: string;
  private model: string;

  constructor(baseUrl: string = 'http://localhost:11434', model: string = 'qwen3.5:cloud') {
    this.baseUrl = baseUrl;
    this.model = model;
  }

  async complete(options: CompletionOptions): Promise<CompletionResponse> {
    const messages: OllamaMessage[] = options.messages.map((m: any) => ({
      role: m.role as 'system' | 'user' | 'assistant' | 'tool',
      content: m.content,
    }));

    const tools = options.tools?.map((t: any) => {
      console.log('[OllamaAdapter] Mapping tool:', JSON.stringify(t, null, 2));
      return {
        type: 'function' as const,
        function: {
          name: t.name || t.function?.name,
          description: t.description || t.function?.description,
          parameters: t.input_schema || t.function?.parameters,
        },
      };
    });

    const payload = {
      model: this.model,
      messages,
      tools: tools || undefined,
      stream: false,
      options: {
        temperature: options.temperature ?? 0,
      },
    };

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as OllamaData;
      console.log('[OllamaAdapter] Raw response:', JSON.stringify(data, null, 2).substring(0, 500));

      const toolCalls = data.message?.tool_calls?.map((tc: any) => {
        console.log('[OllamaAdapter] Parsing tool call:', JSON.stringify(tc, null, 2));
        return {
          id: tc.id || `call_${Date.now()}`,
          name: tc.function?.name || 'unknown',
          input: tc.function?.arguments || {},
        };
      });

      console.log('[OllamaAdapter] Parsed tool calls:', toolCalls);

      return {
        content: data.message?.content || null,
        toolCalls: toolCalls || undefined,
      };
    } catch (error) {
      console.error('[OllamaAdapter] Completion error:', error);
      throw error;
    }
  }
}

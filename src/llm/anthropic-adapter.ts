import { CompletionOptions, CompletionResponse } from '../agent/agent-brain';

/**
 * Anthropic Adapter — Production LLM for VANTA Core
 * 
 * Uses Anthropic Messages API with tool_use support:
 * - claude-sonnet-4-20250514 (default)
 * - claude-opus-4-20250514 (high-reasoning)
 * - claude-haiku-4-20250514 (fast/cheap)
 */

export interface AnthropicConfig {
  apiKey: string;
  model: string;
  maxTokens?: number;
  baseUrl?: string;
}

export class AnthropicAdapter {
  private config: AnthropicConfig;

  constructor(config?: Partial<AnthropicConfig>) {
    this.config = {
      apiKey: config?.apiKey || process.env.ANTHROPIC_API_KEY || '',
      model: config?.model || 'claude-sonnet-4-20250514',
      maxTokens: config?.maxTokens || 4096,
      baseUrl: config?.baseUrl || 'https://api.anthropic.com',
    };

    if (!this.config.apiKey) {
      throw new Error('Anthropic API key required. Set ANTHROPIC_API_KEY env var.');
    }
  }

  /**
   * Call Anthropic Messages API with tool_use support
   */
  async complete(options: CompletionOptions): Promise<CompletionResponse> {
    const messages = options.messages.map((m: any) => {
      if (m.role === 'tool') {
        // Anthropic expects tool results as user messages with tool_result content
        return {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: m.tool_call_id,
              content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
            }
          ]
        };
      }
      return {
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      };
    });

    // Extract system prompt (first message with role 'system')
    const systemPrompt = options.messages.find(m => m.role === 'system')?.content;

    // Map tools to Anthropic tool definition format
    const tools = options.tools?.map((t: any) => ({
      name: t.name || t.function?.name,
      description: t.description || t.function?.description,
      input_schema: t.input_schema || t.function?.parameters,
    }));

    const payload: any = {
      model: this.config.model,
      max_tokens: this.config.maxTokens,
      messages: messages.filter(m => m.role !== 'system'),
    };

    if (systemPrompt) {
      payload.system = systemPrompt;
    }

    if (tools && tools.length > 0) {
      payload.tools = tools;
    }

    console.log('[AnthropicAdapter] Sending request:', {
      model: this.config.model,
      messages: messages.length,
      tools: tools?.length,
      hasSystem: !!systemPrompt,
    });

    try {
      const response = await fetch(`${this.config.baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Anthropic API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data: any = await response.json();
      console.log('[AnthropicAdapter] Raw response:', {
        id: data.id,
        type: data.type,
        role: data.role,
        content: data.content?.length,
        stop_reason: data.stop_reason,
      });

      // Parse tool calls from content blocks
      const toolCalls = data.content
        .filter((block: any) => block.type === 'tool_use')
        .map((block: any, idx: number) => ({
          id: block.id || `tooluse_${Date.now()}_${idx}`,
          name: block.name,
          input: block.input || {},
        }));

      // Parse text content
      const textContent = data.content
        .filter((block: any) => block.type === 'text')
        .map((block: any) => block.text)
        .join('');

      console.log('[AnthropicAdapter] Parsed tool calls:', toolCalls);
      console.log('[AnthropicAdapter] Text content:', textContent?.substring(0, 200));

      return {
        content: textContent || null,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        stopReason: data.stop_reason || null,
      };
    } catch (error) {
      console.error('[AnthropicAdapter] Completion error:', error);
      throw error;
    }
  }

  /**
   * Switch model at runtime
   */
  setModel(model: string): void {
    this.config.model = model;
  }

  /**
   * Get current model
   */
  getModel(): string {
    return this.config.model;
  }
}

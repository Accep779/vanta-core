#!/usr/bin/env ts-node

/**
 * Test Ollama adapter with tool calling
 */

import { OllamaAdapter } from '../src/llm/ollama-adapter';
import { ToolRegistry } from '../src/tools/tool-registry';
import { MockNmapTool } from '../src/tools/mock-nmap.tool';

async function testOllamaToolCall(): Promise<void> {
  console.log('🧪 Testing Ollama tool calling\n');

  const adapter = new OllamaAdapter('http://localhost:11434', 'qwen3.5:cloud');
  const registry = new ToolRegistry();
  registry.register(MockNmapTool);

  const messages = [
    { role: 'system', content: 'You are a penetration testing assistant. Use tools to scan targets.' },
    { role: 'user', content: 'Scan example.com for open ports using nmap.' },
  ];

  const tools = registry.getAnthropicSchemas();

  console.log('Sending request to Ollama...');
  console.log('Tools:', tools.length);
  console.log('Tools[0]:', JSON.stringify(tools[0], null, 2));
  console.log('Messages:', messages.length);

  try {
    console.log('Calling adapter.complete()...');
    const response = await adapter.complete({
      model: 'qwen3.5:cloud',
      messages,
      tools: tools as any,
      temperature: 0,
    });
    console.log('Got response from adapter');

    console.log('\nResponse:');
    console.log('  Content:', response.content?.substring(0, 200));
    console.log('  Tool calls:', response.toolCalls?.length || 0);
    if (response.toolCalls && response.toolCalls.length > 0) {
      console.log('  First tool:', JSON.stringify(response.toolCalls[0], null, 2));
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    console.error('Stack:', (error as Error).stack);
  }
}

testOllamaToolCall().catch(console.error);

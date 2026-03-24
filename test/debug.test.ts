#!/usr/bin/env ts-node

/**
 * VANTA Core ReAct Loop Test — Minimal Debug Version
 */

import { ToolRegistry } from '../src/tools/tool-registry';
import { MockNmapTool } from '../src/tools/mock-nmap.tool';

async function runDebugTest(): Promise<void> {
  console.log('🔍 Debug Test: ToolRegistry + MockNmapTool\n');

  const toolRegistry = new ToolRegistry();
  
  console.log('1. Registering MockNmapTool...');
  toolRegistry.register(MockNmapTool);
  console.log('   Registered:', MockNmapTool.name);

  console.log('2. Listing tools in registry...');
  const tools = toolRegistry.listTools();
  console.log('   Tools count:', tools.length);
  console.log('   Tools:', tools);

  console.log('3. Getting Anthropic schemas...');
  try {
    const schemas = toolRegistry.getAnthropicSchemas();
    console.log('   Schemas count:', schemas.length);
    console.log('   First schema:', JSON.stringify(schemas[0], null, 2));
  } catch (error) {
    console.error('   Error:', error instanceof Error ? error.message : error);
  }

  console.log('\n✅ Debug test complete\n');
}

runDebugTest().catch(console.error);

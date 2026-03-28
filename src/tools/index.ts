/**
 * VANTA Core Tools - Auto-registration
 * 
 * Import and register all available tools
 */

import { ToolRegistry } from './tool-registry';
import { SubfinderTool } from './subfinder.tool';
import { HttpxTool } from './httpx.tool';
import { MockSubfinderTool } from './mock-subfinder.tool';

export function registerAllTools(registry: ToolRegistry): void {
  console.log('[ToolRegistry] Registering tools...\n');
  
  // Register subfinder (real Docker-based)
  registry.register(SubfinderTool);
  console.log('   ✓ subfinder - Subdomain enumeration (LOW risk)');
  
  // Register httpx (HTTP probe)
  registry.register(HttpxTool);
  console.log('   ✓ httpx - HTTP probing (LOW risk)');
  
  // Register mock subfinder (for testing without Docker)
  registry.register(MockSubfinderTool);
  console.log('   ✓ mock-subfinder - Mock subdomain enum (testing)');
  
  console.log(`\n[ToolRegistry] ${registry.listTools().length} tools registered\n`);
}

export { SubfinderTool } from './subfinder.tool';
export { HttpxTool } from './httpx.tool';
export { MockSubfinderTool } from './mock-subfinder.tool';

/**
 * ToolRunner Debug Test
 * Tests Docker execution directly
 */

import { ToolRunner } from '../src/tools/tool-runner';

async function testToolRunner(): Promise<void> {
  console.log('=== ToolRunner Debug Test ===\n');
  
  const runner = new ToolRunner();
  
  console.log('Testing nmap execution...\n');
  
  const result = await runner.runNmap('example.com', '22,80');
  
  console.log('\nResult:', JSON.stringify(result, null, 2));
  
  if (result.success) {
    console.log('\n✅ ToolRunner working correctly!');
  } else {
    console.log('\n❌ ToolRunner failed:', result.error);
  }
}

testToolRunner().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});

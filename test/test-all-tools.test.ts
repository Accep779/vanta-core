/**
 * ToolRunner Full Test — All 4 Tools
 */

import { ToolRunner } from '../src/tools/tool-runner';

async function testAllTools(): Promise<void> {
  console.log('=== ToolRunner Full Test ===\n');
  
  const runner = new ToolRunner();
  
  // Test 1: Nmap
  console.log('1. Testing nmap...');
  const nmapResult = await runner.runNmap('example.com', '22,80');
  console.log('   Nmap:', nmapResult.success ? '✅ PASS' : '❌ FAIL');
  if (nmapResult.success) {
    console.log('   Found:', (nmapResult.discoveredAssets || []).length, 'assets');
  }
  
  // Test 2: Subfinder
  console.log('\n2. Testing subfinder...');
  const subfinderResult = await runner.runSubfinder('example.com');
  console.log('   Subfinder:', subfinderResult.success ? '✅ PASS' : '❌ FAIL');
  if (subfinderResult.success) {
    console.log('   Found:', (subfinderResult.discoveredAssets || []).length, 'subdomains');
  }
  
  // Test 3: Httpx
  console.log('\n3. Testing httpx...');
  // First create subdomain list
  const fs = require('fs');
  const subdomainFile = '/tmp/vanta-scans/test_subs.txt';
  fs.writeFileSync(subdomainFile, 'example.com\nwww.example.com\n');
  const httpxResult = await runner.runHttpx(subdomainFile);
  console.log('   Httpx:', httpxResult.success ? '✅ PASS' : '❌ FAIL');
  if (httpxResult.success) {
    console.log('   Probed:', (httpxResult.discoveredAssets || []).length, 'URLs');
  }
  
  // Test 4: Nuclei
  console.log('\n4. Testing nuclei...');
  const urlFile = '/tmp/vanta-scans/test_urls.txt';
  fs.writeFileSync(urlFile, 'https://example.com\n');
  const nucleiResult = await runner.runNuclei(urlFile, 10);
  console.log('   Nuclei:', nucleiResult.success ? '✅ PASS' : '❌ FAIL');
  if (nucleiResult.success && nucleiResult.vulnerabilities) {
    console.log('   Found:', nucleiResult.vulnerabilities.length, 'vulns');
  }
  
  console.log('\n=== Summary ===');
  const results = [nmapResult, subfinderResult, httpxResult, nucleiResult];
  const passed = results.filter(r => r.success).length;
  console.log(`Result: ${passed}/4 tools working`);
  
  if (passed === 4) {
    console.log('\n🎉 All tools operational!\n');
  } else {
    console.log('\n⚠️ Some tools failed:\n');
    results.forEach((r, i) => {
      if (!r.success) console.log(`   Tool ${i+1}: ${r.error}`);
    });
  }
}

testAllTools().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});

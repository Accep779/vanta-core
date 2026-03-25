/**
 * VANTA Core — OSINT Reconnaissance Report
 * Target: cktutas.edu.gh (C.K. Tedam University of Technology and Applied Sciences)
 * Phase: RECON + ENUMERATE
 */

import { ToolRunner } from '../src/tools/tool-runner';
import { AuditService } from '../src/audit/audit.service';

async function runOSINT(target: string): Promise<void> {
  console.log('=== VANTA Core OSINT Reconnaissance ===');
  console.log(`Target: ${target}`);
  console.log(`Started: ${new Date().toISOString()}`);
  console.log('');
  
  const runner = new ToolRunner();
  const audit = new AuditService();
  
  // Log engagement start
  await audit.log({
    engagementId: `osint-${target}-${Date.now()}`,
    agentId: 'vanta-core',
    sessionId: 'osint-primary',
    eventType: 'engagement_started',
    actor: 'agent',
    action: 'recon_initiated',
    outcome: 'success',
    input: { target, type: 'osint' },
    phase: 'RECON',
    riskLevel: 'LOW'
  });
  
  console.log('1. Subdomain Enumeration (subfinder)');
  console.log('   ─────────────────────────────────');
  const subfinderResult = await runner.runSubfinder(target);
  
  if (subfinderResult.success && subfinderResult.discoveredAssets) {
    console.log(`   ✅ Found ${subfinderResult.discoveredAssets.length} subdomains`);
    subfinderResult.discoveredAssets.forEach((asset: any, i: number) => {
      console.log(`      ${i+1}. ${asset.value}`);
    });
  } else {
    console.log('   ❌ No subdomains found');
  }
  
  console.log('');
  console.log('2. HTTP Probe (httpx)');
  console.log('   ─────────────────────────────────');
  
  // Create subdomain list for httpx
  const fs = require('fs');
  const subdomainFile = '/tmp/vanta-scans/osint_subs.txt';
  const subdomains = subfinderResult.discoveredAssets?.map((a: any) => a.value) || [target];
  fs.writeFileSync(subdomainFile, subdomains.join('\n'));
  
  const httpxResult = await runner.runHttpx(subdomainFile);
  
  if (httpxResult.success && httpxResult.discoveredAssets) {
    console.log(`   ✅ Probed ${httpxResult.discoveredAssets.length} live hosts`);
    if (httpxResult.output?.probed) {
      httpxResult.output.probed.forEach((p: any, i: number) => {
        console.log(`      ${i+1}. ${p.url} (${p.status_code})`);
      });
    }
  } else {
    console.log('   ⚠️ No live hosts detected');
  }
  
  console.log('');
  console.log('3. Port Scan (nmap)');
  console.log('   ─────────────────────────────────');
  
  const nmapResult = await runner.runNmap(target, '22,80,443,8080,3306');
  
  if (nmapResult.success && nmapResult.discoveredAssets) {
    console.log(`   ✅ Scanned ${nmapResult.discoveredAssets.length} hosts`);
    if (nmapResult.output) {
      const output = nmapResult.output as any;
      if (output.hosts) {
        output.hosts.forEach((host: any) => {
          console.log(`      Host: ${host.ip}`);
          if (host.ports) {
            host.ports.forEach((p: any) => {
              console.log(`        └── ${p.port}/${p.protocol} ${p.service} (${p.state})`);
            });
          }
        });
      }
    }
  } else {
    console.log('   ⚠️ Scan incomplete');
  }
  
  console.log('');
  console.log('4. Vulnerability Scan (nuclei)');
  console.log('   ─────────────────────────────────');
  
  const urlFile = '/tmp/vanta-scans/osint_urls.txt';
  const urls = httpxResult.discoveredAssets?.map((a: any) => a.value) || [`https://${target}`];
  fs.writeFileSync(urlFile, urls.join('\n'));
  
  const nucleiResult = await runner.runNuclei(urlFile, 10);
  
  if (nucleiResult.success && nucleiResult.vulnerabilities && nucleiResult.vulnerabilities.length > 0) {
    console.log(`   ⚠️ Found ${nucleiResult.vulnerabilities.length} potential vulnerabilities`);
    nucleiResult.vulnerabilities.forEach((v: any, i: number) => {
      console.log(`      ${i+1}. [${v.severity}] ${v.type}: ${v.description}`);
    });
  } else {
    console.log('   ✅ No vulnerabilities detected');
  }
  
  // Log engagement complete
  await audit.log({
    engagementId: `osint-${target}-${Date.now()}`,
    agentId: 'vanta-core',
    sessionId: 'osint-primary',
    eventType: 'recon_completed',
    actor: 'agent',
    action: 'osint_complete',
    outcome: 'success',
    input: {
      subdomains: subfinderResult.discoveredAssets?.length || 0,
      liveHosts: httpxResult.discoveredAssets?.length || 0,
      openPorts: nmapResult.discoveredAssets?.length || 0,
      vulnerabilities: nucleiResult.vulnerabilities?.length || 0,
    },
    phase: 'RECON',
    riskLevel: 'LOW'
  });
  
  console.log('');
  console.log('=== Summary ===');
  console.log(`Subdomains:     ${subfinderResult.discoveredAssets?.length || 0}`);
  console.log(`Live Hosts:     ${httpxResult.discoveredAssets?.length || 0}`);
  console.log(`Open Ports:     ${nmapResult.output?.hosts?.[0]?.ports?.length || 0}`);
  console.log(`Vulnerabilities: ${nucleiResult.vulnerabilities?.length || 0}`);
  console.log('');
  console.log(`Report saved to audit log`);
  console.log('');
}

runOSINT('cktutas.edu.gh').catch(err => {
  console.error('OSINT failed:', err);
  process.exit(1);
});

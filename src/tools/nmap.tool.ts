import { z } from 'zod';
import { VantaTool, EngagementContext, ToolResult, TargetAsset } from '../tools/tool-registry';
import { ToolRunner } from '../tools/tool-runner';

/**
 * Real NmapTool — executes nmap in isolated Docker container
 * 
 * https://nmap.org/
 */

export interface NmapOutput {
  host: string;
  state: string;
  openPorts: Array<{
    port: number;
    protocol: string;
    service: string;
    product?: string;
    version?: string;
  }>;
  os?: string;
  scanTime: string;
}

export const NmapTool: VantaTool = {
  name: 'nmap_scan',
  category: 'recon',
  description: 'Port scan and service enumeration using nmap',
  riskLevel: 'LOW',
  tags: ['recon', 'port-scan', 'service-detection', 'network'],
  parameters: z.object({
    target: z.string().describe('IP address, hostname, or CIDR range'),
    ports: z.string().optional().describe('Port range e.g. 1-1000, 80,443,8080'),
    scanType: z.enum(['SYN', 'TCP', 'UDP', 'SERVICE']).default('SYN').describe('Nmap scan type'),
    timing: z.number().min(1).max(5).default(3).describe('Nmap timing template (-T)'),
    versionDetection: z.boolean().default(true).describe('Enable version detection (-sV)'),
    osDetection: z.boolean().default(false).describe('Enable OS detection (-O)'),
  }),
  execute: async (params: any, context: EngagementContext): Promise<ToolResult> => {
    console.log('[NmapTool] Executing nmap scan against', params.target, params.ports || 'default ports');
    
    // Use ToolRunner to execute in Docker container
    const runner = new ToolRunner();
    return await runner.runNmap(params.target, params.ports);
  },
};

/**
 * Mock nmap output for testing (Docker unavailable)
 */
async function executeMock(params: any, context: EngagementContext): Promise<ToolResult> {
  await new Promise(resolve => setTimeout(resolve, 800));

  const mockOutput: NmapOutput = {
    host: params.target,
    state: 'up',
    openPorts: [
      { port: 80, protocol: 'tcp', service: 'http', product: 'nginx', version: '1.18.0' },
      { port: 443, protocol: 'tcp', service: 'https', product: 'nginx', version: '1.18.0' },
      { port: 22, protocol: 'tcp', service: 'ssh', product: 'OpenSSH', version: '8.2p1' },
    ],
    os: 'Linux 4.x - 5.x',
    scanTime: '2.34s',
  };

  const discoveredAssets: TargetAsset[] = mockOutput.openPorts.map((p) => ({
    id: `asset-${params.target}-${p.port}`,
    type: p.port === 443 ? 'url' : 'ip',
    value: p.port === 443 ? `https://${params.target}` : `${params.target}:${p.port}`,
    discoveredAt: Date.now(),
    confirmed: true,
  }));

  return {
    success: true,
    output: mockOutput,
    discoveredAssets,
    vulnerabilities: [],
  };
};

/**
 * Simple nmap XML parser (production: use xml2js)
 */
function parseNmapXml(xml: string): NmapOutput {
  // Extract host
  const hostMatch = xml.match(/<host[^>]*>[\s\S]*?<address addr="([^"]+)"/);
  const host = hostMatch ? hostMatch[1] : 'unknown';

  // Extract state
  const stateMatch = xml.match(/<status state="([^"]+)"/);
  const state = stateMatch ? stateMatch[1] : 'unknown';

  // Extract open ports
  const openPorts: Array<{ port: number; protocol: string; service: string; product?: string; version?: string }> = [];
  const portRegex = /<port protocol="([^"]+)" portid="(\d+)">[\s\S]*?<service name="([^"]+)"(?: product="([^"]+)")?(?: version="([^"]+)")?/g;
  
  let match;
  while ((match = portRegex.exec(xml)) !== null) {
    openPorts.push({
      port: parseInt(match[2], 10),
      protocol: match[1],
      service: match[3],
      product: match[4] || undefined,
      version: match[5] || undefined,
    });
  }

  // Extract OS (if detected)
  const osMatch = xml.match(/<os[^>]*>[\s\S]*?<osclass[^>]*type="([^"]+)"/);
  const os = osMatch ? osMatch[1] : undefined;

  // Extract scan time
  const timeMatch = xml.match(/<runstats[^>]*>[\s\S]*finished="[^"]+" timestr="([^"]+)"/);
  const scanTime = timeMatch ? timeMatch[1] : 'unknown';

  return { host, state, openPorts, os, scanTime };
}

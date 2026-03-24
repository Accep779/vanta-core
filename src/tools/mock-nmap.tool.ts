import { z } from 'zod';
import { VantaTool, EngagementContext, ToolResult, TargetAsset } from '../tools/tool-registry';

/**
 * Mock NmapTool — hardcoded output for ReAct loop testing
 * 
 * Use this to verify the AgentBrain loop works before wiring real nmap
 */

export const MockNmapTool: VantaTool = {
  name: 'nmap_scan',
  category: 'recon',
  description: 'Port scan and service enumeration (mock for testing)',
  riskLevel: 'LOW',
  tags: ['recon', 'port-scan', 'service-detection'],
  parameters: z.object({
    target: z.string().describe('IP address or hostname to scan'),
    ports: z.string().optional().describe('Port range e.g. 1-1000 or 80,443'),
    scanType: z.enum(['SYN', 'TCP', 'UDP']).default('SYN'),
  }),
  execute: async (params: any, context: EngagementContext): Promise<ToolResult> => {
    console.log(`[MockNmapTool] Scanning ${params.target}...`);

    // Simulate async execution
    await new Promise(resolve => setTimeout(resolve, 500));

    // Hardcoded realistic output for example.com
    const mockOutput = {
      host: params.target,
      state: 'up',
      openPorts: [
        { port: 80, protocol: 'tcp', service: 'http', product: 'nginx', version: '1.18.0' },
        { port: 443, protocol: 'tcp', service: 'https', product: 'nginx', version: '1.18.0' },
        { port: 22, protocol: 'tcp', service: 'ssh', product: 'OpenSSH', version: '8.2p1' },
      ],
      os: 'Linux 4.15 - 5.8',
      scanTime: '2.34s',
    };

    // Generate discovered assets from scan results
    const discoveredAssets: TargetAsset[] = mockOutput.openPorts.map((p, idx) => ({
      id: `asset-${params.target}-${p.port}`,
      type: p.port === 443 ? 'url' : 'ip',
      value: p.port === 443 ? `https://${params.target}` : `${params.target}:${p.port}`,
      discoveredAt: Date.now(),
      confirmed: true,
      vulnerabilities: [],
    }));

    return {
      success: true,
      output: mockOutput,
      discoveredAssets,
      vulnerabilities: [],
    };
  },
};

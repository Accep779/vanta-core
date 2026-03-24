import { z } from 'zod';
import { VantaTool, EngagementContext, ToolResult, TargetAsset } from '../tools/tool-registry';

/**
 * Mock SubfinderTool — passive subdomain enumeration for RECON phase testing
 */

export const MockSubfinderTool: VantaTool = {
  name: 'subfinder',
  category: 'recon',
  description: 'Passive subdomain enumeration (mock for testing)',
  riskLevel: 'LOW',
  tags: ['recon', 'subdomain', 'passive'],
  parameters: z.object({
    domain: z.string().describe('Root domain to enumerate subdomains for'),
    passive: z.boolean().default(true).describe('Passive only — no active DNS bruteforce'),
  }),
  execute: async (params: any, context: EngagementContext): Promise<ToolResult> => {
    console.log(`[MockSubfinderTool] Enumerating subdomains for ${params.domain}...`);

    await new Promise(resolve => setTimeout(resolve, 500));

    const mockOutput = {
      domain: params.domain,
      subdomains: [
        'www.example.com',
        'mail.example.com',
        'api.example.com',
        'dev.example.com',
        'staging.example.com',
      ],
      source: 'passive',
      scanTime: '1.2s',
    };

    const discoveredAssets: TargetAsset[] = mockOutput.subdomains.map((sub, idx) => ({
      id: `asset-${sub}-${idx}`,
      type: 'domain',
      value: sub,
      discoveredAt: Date.now(),
      confirmed: true,
    }));

    return {
      success: true,
      output: mockOutput,
      discoveredAssets,
      vulnerabilities: [],
    };
  },
};

import { z } from 'zod';
import { VantaTool, EngagementContext, ToolResult } from '../tools/tool-registry';
import { ToolRunner } from '../tools/tool-runner';

/**
 * Subfinder subdomain enumeration tool - Docker containerized
 * Category: recon
 * Risk Level: LOW (passive enumeration)
 */

const subfinderParams = z.object({
  domain: z.string().describe('Target domain for subdomain enumeration'),
  recursive: z.boolean().optional().describe('Enable recursive enumeration'),
  sources: z.array(z.string()).optional().describe('Specific data sources to use'),
});

export const SubfinderTool: VantaTool = {
  name: 'subfinder',
  description: 'Subdomain enumeration tool. Discovers subdomains using passive sources and APIs.',
  parameters: subfinderParams,
  riskLevel: 'LOW',
  category: 'recon',
  tags: ['subdomain-enum', 'passive', 'dns'],
  
  execute: async (params: z.infer<typeof subfinderParams>, context: EngagementContext): Promise<ToolResult> => {
    console.log('[SubfinderTool] Enumerating subdomains for:', params.domain);
    
    // Use ToolRunner to execute in Docker container
    const runner = new ToolRunner();
    return await runner.runSubfinder(params.domain);
  },
};

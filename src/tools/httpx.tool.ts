import { z } from 'zod';
import { VantaTool, EngagementContext, ToolResult } from '../tools/tool-registry';
import { ToolRunner } from '../tools/tool-runner';

/**
 * HTTPX HTTP probe tool - Docker containerized
 * Category: enumeration
 * Risk Level: LOW (passive probing)
 */

const httpxParams = z.object({
  inputFile: z.string().describe('Path to file containing target URLs/domains'),
  ports: z.array(z.number()).optional().describe('Specific ports to probe'),
  statusCode: z.boolean().optional().describe('Capture HTTP status codes'),
  title: z.boolean().optional().describe('Capture page titles'),
});

export const HttpxTool: VantaTool = {
  name: 'httpx',
  description: 'HTTP probe tool. Checks if domains/subdomains are responding and captures metadata.',
  parameters: httpxParams,
  riskLevel: 'LOW',
  category: 'enumeration',
  tags: ['http-probe', 'web-enum', 'passive'],
  
  execute: async (params: z.infer<typeof httpxParams>, context: EngagementContext): Promise<ToolResult> => {
    console.log('[HttpxTool] Probing HTTP targets:', params.inputFile);
    
    // Use ToolRunner to execute in Docker container
    const runner = new ToolRunner();
    return await runner.runHttpx(params.inputFile);
  },
};

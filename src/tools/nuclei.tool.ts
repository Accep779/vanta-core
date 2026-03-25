import { z } from 'zod';
import { VantaTool, EngagementContext, ToolResult } from '../tools/tool-registry';
import { ToolRunner } from '../tools/tool-runner';

/**
 * Nuclei vulnerability scanner - Docker containerized
 * Category: exploitation
 * Risk Level: MEDIUM (active scanning)
 */

const nucleiParams = z.object({
  inputFile: z.string().describe('Path to file containing target URLs'),
  templates: z.array(z.string()).optional().describe('Specific nuclei templates to use'),
  severity: z.array(z.enum(['info', 'low', 'medium', 'high', 'critical'])).optional().describe('Filter by severity'),
  rateLimit: z.number().optional().describe('Requests per second (default: 10)'),
});

export const NucleiTool: VantaTool = {
  name: 'nuclei',
  description: 'Vulnerability scanner. Runs nuclei templates against targets to find security issues.',
  parameters: nucleiParams,
  riskLevel: 'MEDIUM',
  category: 'exploitation',
  tags: ['vuln-scan', 'templates', 'cve'],
  
  execute: async (params: z.infer<typeof nucleiParams>, context: EngagementContext): Promise<ToolResult> => {
    console.log('[NucleiTool] Running vulnerability scan:', params.inputFile);
    
    // Use ToolRunner to execute in Docker container
    const runner = new ToolRunner();
    return await runner.runNuclei(params.inputFile, params.rateLimit || 10);
  },
};

import { z, ZodSchema } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

/**
 * VANTA Core ToolRegistry — Validated tool sandbox for offensive security tools
 * 
 * Extracted from Cephly ToolRegistry with engagement context:
 * - Generic EngagementContext dependency (stripped Cephly tenant fields)
 * - Attack tool categories: recon, enum, exploit, pivot, report
 * - Risk levels for gate triggering
 */

export interface EngagementContext {
  engagementId: string;
  scope: EngagementScope;
  currentPhase: AttackPhase;
  targetAsset?: TargetAsset;
  rulesOfEngagement: RuleOfEngagement[];
}

export interface EngagementScope {
  inScopeTargets: string[];
  outOfScopeTargets: string[];
  allowedTools: string[];
  blockedTools: string[];
  maxRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface TargetAsset {
  id: string;
  type: 'ip' | 'domain' | 'url' | 'email' | 'network' | 'application';
  value: string;
  discoveredAt: number;
  confirmed?: boolean;
  vulnerabilities?: Vulnerability[];
}

export interface Vulnerability {
  id: string;
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  evidence?: string;
  discoveredAt: number;
}

export interface RuleOfEngagement {
  id: string;
  description: string;
  constraint: string;
}

export type AttackPhase = 'RECON' | 'ENUMERATE' | 'PLAN' | 'EXPLOIT' | 'PIVOT' | 'REPORT';

export type ToolCategory = 'recon' | 'enumeration' | 'exploitation' | 'pivot' | 'reporting' | 'utility';

export interface VantaTool {
  name: string;
  description: string;
  parameters: ZodSchema;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  category: ToolCategory;
  tags?: string[];
  execute: (params: any, context: EngagementContext) => Promise<ToolResult>;
}

export interface ToolResult {
  success: boolean;
  output?: any;
  error?: string;
  discoveredAssets?: TargetAsset[];
  vulnerabilities?: Vulnerability[];
  gateTriggered?: boolean;
  gateReason?: string;
}

export class ToolRegistry {
  private tools = new Map<string, VantaTool>();

  /**
   * Register a tool in the sandbox
   */
  register(tool: VantaTool): void {
    this.tools.set(tool.name, tool);
  }

  /**
   * Get all tool schemas in Anthropic format for LLM tool_use
   */
  getAnthropicSchemas(allowedTools?: string[]): object[] {
    return Array.from(this.tools.values())
      .filter(t => !allowedTools || allowedTools.includes(t.name))
      .map(t => ({
        name: t.name,
        description: t.description,
        input_schema: this.zodToJsonSchema(t.parameters),
      }));
  }

  /**
   * Get all tool schemas in OpenAI function calling format
   */
  getOpenAISchemas(allowedTools?: string[]): object[] {
    return Array.from(this.tools.values())
      .filter(t => !allowedTools || allowedTools.includes(t.name))
      .map(t => ({
        type: 'function' as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: this.zodToJsonSchema(t.parameters),
        }
      }));
  }

  /**
   * Get tool by name
   */
  get(name: string): VantaTool | undefined {
    return this.tools.get(name);
  }

  /**
   * Get tool risk level
   */
  getRiskLevel(name: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    return this.tools.get(name)?.riskLevel ?? 'MEDIUM';
  }

  /**
   * Check if tool is in-scope for engagement
   */
  isToolAllowed(toolName: string, scope: EngagementScope): boolean {
    if (scope.blockedTools.includes(toolName)) return false;
    if (scope.allowedTools.length > 0 && !scope.allowedTools.includes(toolName)) return false;
    return true;
  }

  /**
   * Check if tool exceeds max risk level for engagement
   */
  isRiskExceeded(toolName: string, scope: EngagementScope): boolean {
    const toolRisk = this.getRiskLevel(toolName);
    const maxRisk = scope.maxRiskLevel;
    
    const riskOrder = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    return riskOrder.indexOf(toolRisk) > riskOrder.indexOf(maxRisk);
  }

  /**
   * Execute a tool with engagement context
   */
  async execute(name: string, input: any, context: EngagementContext): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        success: false,
        output: null,
        error: `Tool '${name}' not found.`,
      };
    }

    // Check scope rules
    if (!this.isToolAllowed(name, context.scope)) {
      return {
        success: false,
        output: null,
        error: `Tool '${name}' is not allowed for this engagement.`,
        gateTriggered: true,
        gateReason: 'Tool blocked by scope rules',
      };
    }

    // Check risk level
    if (this.isRiskExceeded(name, context.scope)) {
      return {
        success: false,
        output: null,
        error: `Tool '${name}' exceeds max risk level (${context.scope.maxRiskLevel}).`,
        gateTriggered: true,
        gateReason: 'Tool risk level exceeds engagement limit',
      };
    }

    // Check phase compatibility
    const phaseTools: Record<AttackPhase, ToolCategory[]> = {
      RECON: ['recon', 'utility'],
      ENUMERATE: ['enumeration', 'recon', 'utility'],
      PLAN: ['enumeration', 'recon', 'utility'],
      EXPLOIT: ['exploitation', 'enumeration', 'recon', 'utility'],
      PIVOT: ['exploitation', 'pivot', 'enumeration', 'utility'],
      REPORT: ['reporting', 'utility'],
    };

    if (!phaseTools[context.currentPhase].includes(tool.category)) {
      return {
        success: false,
        output: null,
        error: `Tool '${name}' cannot be used in ${context.currentPhase} phase.`,
        gateTriggered: true,
        gateReason: 'Tool not compatible with current attack phase',
      };
    }

    try {
      const parsed = tool.parameters.parse(input);
      const result = await tool.execute(parsed, context);
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      return {
        success: false,
        output: null,
        error: err.message,
      };
    }
  }

  /**
   * Register tools from a directory (for skill markdown files)
   */
  async registerToolsFromDir(toolsDir: string): Promise<void> {
    const fs = await import('fs');
    const path = await import('path');
    const matter = await import('gray-matter');
    
    const files = await fs.promises.readdir(toolsDir);
    for (const file of files) {
      if (file.endsWith('.md')) {
        const content = await fs.promises.readFile(path.join(toolsDir, file), 'utf8');
        const { data: fm } = matter.default(content);
        if (fm && fm.name) {
          this.register({
            name: fm.name,
            description: fm.description || 'No description provided.',
            parameters: this.buildZodFromFrontmatter(fm.parameters),
            riskLevel: fm.riskLevel || 'MEDIUM',
            category: fm.category || 'utility',
            tags: fm.tags || [],
            execute: async (params: any, context: EngagementContext) => {
              // Default: tools must be implemented separately
              return {
                success: false,
                error: `Tool '${fm.name}' not implemented.`,
              };
            }
          });
        }
      }
    }
  }

  /**
   * Build Zod schema from frontmatter params
   */
  private buildZodFromFrontmatter(params: any): z.ZodObject<any> {
    const shape: any = {};
    if (params && typeof params === 'object') {
      for (const [key, type] of Object.entries(params)) {
        shape[key] = type === 'string' ? z.string() : z.any();
      }
    }
    return z.object(shape);
  }

  /**
   * Convert Zod schema to JSON schema
   */
  private zodToJsonSchema(schema: ZodSchema): object {
    // Simple manual conversion to avoid zod-to-json-schema type issues
    if (schema instanceof z.ZodObject) {
      const shape = (schema as z.ZodObject<any>).shape;
      const properties: any = {};
      for (const [key, value] of Object.entries(shape)) {
        properties[key] = { type: 'string' }; // Simplified
      }
      return {
        type: 'object',
        properties,
        required: Object.keys(shape),
      };
    }
    return { type: 'object', properties: {} };
  }

  /**
   * List all registered tools
   */
  listTools(): { name: string; category: ToolCategory; riskLevel: string }[] {
    return Array.from(this.tools.values()).map(t => ({
      name: t.name,
      category: t.category,
      riskLevel: t.riskLevel,
    }));
  }
}

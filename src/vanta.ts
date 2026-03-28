/**
 * VANTA Core - Autonomous Threat Simulation Engine
 * 
 * Main entry point that wires all ReAct loop components together.
 * Extracted from Cephly OS (March 2026)
 * 
 * Status: ✅ Entry point complete, LLM adapter integrated
 */

import { AuditService, AttackEventType } from './audit/audit.service';
import { DefaultPolicyLoader, PolicyEngine } from './policy/policy-engine';
import { ToolRegistry, EngagementContext, EngagementScope, AttackPhase, TargetAsset } from './tools/tool-registry';
import { SessionLaneQueue } from './queue/session-lane.queue';
import { OllamaAdapter } from './llm/ollama-adapter';
import { AgentBrain, BrainConfig } from './agent/agent-brain';
import { registerAllTools } from './tools';

// ─── VANTA Configuration ─────────────────────────────────────────────────────

export interface VANTAConfig {
  /** Target scope (domain, IP range, etc.) */
  target: string;
  
  /** Engagement ID for tracking */
  engagementId: string;
  
  /** Max risk level allowed */
  maxRiskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  
  /** Enabled tools */
  tools?: string[];
  
  /** Model to use */
  model?: string;
  
  /** Max ReAct iterations */
  maxIterations?: number;
}

export interface VANTAResult {
  /** Engagement ID */
  engagementId: string;
  
  /** Target that was assessed */
  target: string;
  
  /** Discovered assets/subdomains */
  assets: any[];
  
  /** Identified vulnerabilities */
  vulnerabilities: any[];
  
  /** Execution status */
  status: 'completed' | 'paused' | 'failed';
  
  /** Error message if failed */
  error?: string;
  
  /** Full conversation/messages from ReAct loop */
  messages?: any[];
}

// ─── VANTA Core Engine ───────────────────────────────────────────────────────

export class VANTA {
  private audit: AuditService;
  private policy: PolicyEngine;
  private registry: ToolRegistry;
  private queue: SessionLaneQueue;
  private brain: AgentBrain;
  private config: VANTAConfig;
  private llm: OllamaAdapter;

  constructor(config: VANTAConfig) {
    this.config = config;
    
    // Initialize core components
    this.audit = new AuditService();
    this.registry = new ToolRegistry();
    this.queue = new SessionLaneQueue();
    this.policy = new PolicyEngine(this.audit, new DefaultPolicyLoader());
    this.llm = new OllamaAdapter('http://localhost:11434', config.model || 'qwen3.5:cloud');
    
    // Register all available tools
    registerAllTools(this.registry);
    
    // Create AgentBrain with LLM adapter
    this.brain = new AgentBrain(
      this.registry,
      this.audit,
      this.queue,
      (options) => this.llm.complete(options),
      new DefaultPolicyLoader()
    );
    
    // Log initialization
    this.audit.log({
      engagementId: config.engagementId,
      agentId: 'vanta-core',
      sessionId: config.engagementId,
      eventType: 'engagement_started' as AttackEventType,
      actor: 'system',
      action: 'init',
      outcome: 'success',
    });
  }

  /**
   * Run full ReAct loop against target
   * Executes: RECON → ENUMERATE → PLAN phases
   */
  async execute(): Promise<VANTAResult> {
    const startTime = Date.now();
    
    this.audit.log({
      engagementId: this.config.engagementId,
      agentId: 'vanta-core',
      sessionId: this.config.engagementId,
      eventType: 'recon_started' as AttackEventType,
      actor: 'agent',
      action: 'execute',
      outcome: 'started',
    });

    try {
      // Create engagement context
      const context: EngagementContext = {
        engagementId: this.config.engagementId,
        scope: {
          inScopeTargets: [this.config.target],
          outOfScopeTargets: [],
          allowedTools: this.config.tools || ['subfinder', 'httpx'],
          blockedTools: [],
          maxRiskLevel: this.config.maxRiskLevel || 'LOW',
        },
        currentPhase: 'RECON' as AttackPhase,
        targetAsset: {
          id: 'primary',
          type: 'domain' as const,
          value: this.config.target,
          discoveredAt: Date.now(),
        },
        rulesOfEngagement: [],
      };

      // Run ReAct loop via AgentBrain
      const response = await this.brain.run(
        `Perform reconnaissance on ${this.config.target}. Discover subdomains and services.`,
        context,
        [],
        {
          model: this.config.model || 'qwen3.5:cloud',
          maxIterations: this.config.maxIterations || 10,
        }
      );

      const endTime = Date.now();
      
      this.audit.log({
        engagementId: this.config.engagementId,
        agentId: 'vanta-core',
        sessionId: this.config.engagementId,
        eventType: 'enumeration_completed' as AttackEventType,
        actor: 'agent',
        action: 'complete',
        outcome: response.status,
        durationMs: endTime - startTime,
      });

      return {
        engagementId: this.config.engagementId,
        target: this.config.target,
        assets: response.discoveredAssets || [],
        vulnerabilities: response.vulnerabilities || [],
        status: response.status === 'completed' ? 'completed' : 'paused',
        messages: (response as any).messages || [],
      };

    } catch (error) {
      const endTime = Date.now();
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      this.audit.log({
        engagementId: this.config.engagementId,
        agentId: 'vanta-core',
        sessionId: this.config.engagementId,
        eventType: 'report_generated' as AttackEventType,
        actor: 'system',
        action: 'error',
        outcome: 'failed',
        durationMs: endTime - startTime,
      });

      return {
        engagementId: this.config.engagementId,
        target: this.config.target,
        assets: [],
        vulnerabilities: [],
        status: 'failed',
        error: errorMessage,
      };
    }
  }

  /**
   * Get current engagement state
   */
  getState() {
    return {
      engagementId: this.config.engagementId,
      target: this.config.target,
      toolsAvailable: this.registry.listTools(),
      maxRiskLevel: this.config.maxRiskLevel,
    };
  }
}

// ─── CLI Entry Point (for direct execution) ──────────────────────────────────

if (require.main === module) {
  console.log('🛡️  VANTA Core Starting...\n');
  console.log('Target: example.com');
  console.log('Model: qwen3.5:cloud');
  console.log('Phases: RECON → ENUMERATE → PLAN\n');
  console.log('⏱️  This may take 1-2 minutes...\n');

  const vanta = new VANTA({
    target: 'example.com',
    engagementId: `test_${Date.now()}`,
    maxRiskLevel: 'LOW',
    tools: ['subfinder'],
    model: 'qwen3.5:cloud',
    maxIterations: 10,
  });

  vanta.execute()
    .then(result => {
      console.log('\n✅ Execution Complete\n');
      console.log('Status:', result.status);
      console.log('Assets Found:', result.assets.length);
      console.log('Vulnerabilities:', result.vulnerabilities.length);
      
      if (result.assets.length > 0) {
        console.log('\n📋 Discovered Assets:');
        result.assets.forEach((asset: any, i: number) => {
          console.log(`   ${i + 1}. ${asset.subdomain || asset.name || asset.value || 'Unknown'}`);
        });
      }
      
      if (result.status === 'failed') {
        console.log('\n❌ Error:', result.error);
      }
      
      if (result.messages && result.messages.length > 0) {
        console.log(`\n💬 ReAct Loop: ${result.messages.length} messages exchanged`);
      }
      
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ Execution Failed:', err.message);
      console.error(err.stack);
      process.exit(1);
    });
}

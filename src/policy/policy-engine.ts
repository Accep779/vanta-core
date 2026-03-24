import { AuditService } from '../audit/audit.service';
import { EngagementContext, AttackPhase } from '../tools/tool-registry';

/**
 * Policy decision for tool execution
 */
export type PolicyDecision =
  | { action: 'execute'; riskLevel: string }
  | { action: 'gate'; gateLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; reason: string }
  | { action: 'deny'; reason: string; riskLevel: string };

/**
 * Abstract policy loader interface
 * 
 * VANTA Core decouples from Prisma/database — policies loaded from:
 * - Engagement scope rules (in-scope vs out-of-scope targets)
 * - Risk-level rules (tool risk vs engagement max risk)
 * - Engagement-type rules (recon-only vs full exploit)
 * - Customer-provided policy files (JSON)
 */
export interface PolicyLoader {
  loadPolicy(engagementId: string): Promise<EngagementPolicy>;
  loadGateConfig(engagementId: string, toolName: string): Promise<GateConfig | null>;
}

export interface EngagementPolicy {
  engagementId: string;
  allowedTools: string[];
  blockedTools: string[];
  maxRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  engagementType: 'recon-only' | 'enumeration' | 'full-pentest' | 'red-team';
  scopeRules: ScopeRule[];
  privacyLevel: 'standard' | 'strict' | 'air-gapped';
  localOnlyFields: string[];
}

export interface ScopeRule {
  id: string;
  description: string;
  constraint: string;
  targets?: string[];
  tools?: string[];
}

export interface GateConfig {
  engagementId: string;
  toolName: string;
  behavior: 'always' | 'risk-based' | 'never';
  reason: string;
  gateLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

/**
 * Default policy loader — loads from engagement context
 */
export class DefaultPolicyLoader implements PolicyLoader {
  constructor(private contexts: Map<string, EngagementContext> = new Map()) {}

  setContext(engagementId: string, context: EngagementContext): void {
    this.contexts.set(engagementId, context);
  }

  async loadPolicy(engagementId: string): Promise<EngagementPolicy> {
    const context = this.contexts.get(engagementId);
    if (!context) {
      throw new Error(`No policy found for engagement: ${engagementId}`);
    }

    return {
      engagementId,
      allowedTools: context.scope.allowedTools,
      blockedTools: context.scope.blockedTools,
      maxRiskLevel: context.scope.maxRiskLevel,
      engagementType: this.inferEngagementType(context),
      scopeRules: context.rulesOfEngagement.map(r => ({
        id: r.id,
        description: r.description,
        constraint: r.constraint,
      })),
      privacyLevel: 'standard',
      localOnlyFields: [],
    };
  }

  async loadGateConfig(engagementId: string, toolName: string): Promise<GateConfig | null> {
    const context = this.contexts.get(engagementId);
    if (!context) return null;

    // Risk-based gating: HIGH/CRITICAL tools always require gate
    const toolRisk = context.scope.allowedTools.includes(toolName) 
      ? 'MEDIUM' 
      : 'HIGH';
    
    if (toolRisk === 'HIGH' || toolRisk === 'CRITICAL') {
      return {
        engagementId,
        toolName,
        behavior: 'risk-based',
        reason: `Tool '${toolName}' exceeds engagement risk limit (${context.scope.maxRiskLevel})`,
        gateLevel: toolRisk as 'HIGH' | 'CRITICAL',
      };
    }

    return null;
  }

  private inferEngagementType(context: EngagementContext): 'recon-only' | 'enumeration' | 'full-pentest' | 'red-team' {
    if (context.currentPhase === 'RECON') return 'recon-only';
    if (['RECON', 'ENUMERATE'].includes(context.currentPhase)) return 'enumeration';
    if (context.scope.maxRiskLevel === 'CRITICAL') return 'red-team';
    return 'full-pentest';
  }
}

/**
 * VANTA Core PolicyEngine — Governance engine for tool execution
 * 
 * Extracted from Cephly PolicyEngine with abstract PolicyLoader:
 * - Decoupled from Prisma/database
 * - Scope rules (is target in-scope?)
 * - Risk-level rules (is tool CRITICAL?)
 * - Engagement-type rules (recon-only?)
 * - Redis cache invalidation for multi-instance coordination
 */
export class PolicyEngine {
  private cache: Map<string, EngagementPolicy> = new Map();
  private policyLoader: PolicyLoader;

  constructor(
    private auditService: AuditService,
    policyLoader?: PolicyLoader
  ) {
    this.policyLoader = policyLoader ?? new DefaultPolicyLoader();
  }

  /**
   * Evaluate tool execution BEFORE it runs
   */
  async evaluate(
    context: EngagementContext,
    toolName: string,
    riskLevel: string = 'MEDIUM',
    input?: any
  ): Promise<PolicyDecision> {
    const policy = await this.policyLoader.loadPolicy(context.engagementId);

    // 1. Check scope rules — is target in-scope?
    if (context.targetAsset) {
      const targetValue = context.targetAsset.value;
      const isOutOfScope = policy.scopeRules.some(
        rule => rule.targets && rule.targets.includes(targetValue)
      );
      
      if (isOutOfScope) {
        await this.logDecision(context, toolName, 'POLICY_DENY', 'target_out_of_scope', 'Target is out of scope per engagement rules');
        return { action: 'deny', reason: 'target_out_of_scope', riskLevel: 'HIGH' };
      }
    }

    // 2. Check blocklist FIRST
    if (policy.blockedTools.includes(toolName)) {
      await this.logDecision(context, toolName, 'POLICY_DENY', 'tool_blocked_by_policy', 'Blocked by engagement policy blocklist');
      return { action: 'deny', reason: 'tool_blocked_by_policy', riskLevel: 'HIGH' };
    }

    // 3. Check allowlist (if defined and non-empty)
    if (policy.allowedTools.length > 0 && !policy.allowedTools.includes(toolName)) {
      await this.logDecision(context, toolName, 'POLICY_DENY', 'tool_not_in_allowlist', 'Not strictly allowed by engagement policy');
      return { action: 'deny', reason: 'tool_not_in_allowlist', riskLevel: 'MEDIUM' };
    }

    // 4. Check engagement type restrictions
    if (policy.engagementType === 'recon-only' && riskLevel !== 'LOW') {
      await this.logDecision(context, toolName, 'POLICY_DENY', 'recon_only_engagement', 'Only LOW risk tools allowed in recon-only engagement');
      return { action: 'deny', reason: 'recon_only_engagement', riskLevel: 'MEDIUM' };
    }

    // 5. Check risk level vs max allowed
    const riskOrder = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    const toolRiskIdx = riskOrder.indexOf(riskLevel as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL');
    const maxRiskIdx = riskOrder.indexOf(policy.maxRiskLevel);
    
    if (toolRiskIdx > maxRiskIdx) {
      await this.logDecision(context, toolName, 'GATE_CREATED', 'risk_exceeds_limit', `Tool risk (${riskLevel}) exceeds engagement max (${policy.maxRiskLevel})`);
      return {
        action: 'gate',
        gateLevel: riskLevel as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
        reason: `Tool risk level (${riskLevel}) exceeds engagement maximum (${policy.maxRiskLevel})`
      };
    }

    // 6. Check for specific gate config
    const gateConfig = await this.policyLoader.loadGateConfig(context.engagementId, toolName);

    if ((gateConfig && gateConfig.behavior === 'always') || riskLevel === 'HIGH' || riskLevel === 'CRITICAL') {
      await this.logDecision(context, toolName, 'GATE_CREATED', 'manual_approval_required', gateConfig?.reason || 'Tool execution requires manual approval per policy.');
      return {
        action: 'gate',
        gateLevel: gateConfig?.gateLevel || (riskLevel as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'),
        reason: gateConfig?.reason || 'Tool execution requires manual approval per policy.'
      };
    }

    await this.logDecision(context, toolName, 'POLICY_ALLOW', 'allowed', 'Tool execution permitted');
    return { action: 'execute', riskLevel };
  }

  /**
   * Invalidate policy cache (for multi-instance coordination)
   */
  async invalidateCache(engagementId: string): Promise<void> {
    this.cache.delete(engagementId);
  }

  private async logDecision(
    context: EngagementContext,
    toolName: string,
    eventType: string,
    actionDesc: string,
    reason: string
  ): Promise<void> {
    await this.auditService.log({
      engagementId: context.engagementId,
      agentId: 'vanta-core',
      sessionId: `${context.engagementId}:${context.targetAsset?.id || 'primary'}`,
      eventType: eventType as any,
      actor: 'policy-engine',
      action: actionDesc,
      outcome: eventType === 'POLICY_DENY' ? 'failure' : 'success',
      input: { toolCall: toolName, reason },
      phase: context.currentPhase,
      riskLevel: eventType === 'POLICY_DENY' ? 'HIGH' : 'LOW'
    });
  }
}

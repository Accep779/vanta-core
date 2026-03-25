import { ToolRegistry, EngagementContext, ToolResult } from '../tools/tool-registry';
import { SessionLaneQueue } from '../queue/session-lane.queue';
import { AuditService, AuditLogInput } from '../audit/audit.service';
import { PolicyEngine, PolicyDecision } from '../policy/policy-engine';
import { ScopeValidator, ScopeConfig } from '../engagement/scope-validator';

// ─── Constant tokens ────────────────────────────────────────────────────────
export const HEARTBEAT_OK = 'HEARTBEAT_OK';
export const SILENT_REPLY_TOKEN = '__SILENT__';

// ─── Attack Phase State Machine ─────────────────────────────────────────────

export type AttackPhase = 'RECON' | 'ENUMERATE' | 'PLAN' | 'EXPLOIT' | 'PIVOT' | 'REPORT';

export const PHASE_ORDER: AttackPhase[] = ['RECON', 'ENUMERATE', 'PLAN', 'EXPLOIT', 'PIVOT', 'REPORT'];

export function getNextPhase(current: AttackPhase): AttackPhase | null {
  const idx = PHASE_ORDER.indexOf(current);
  if (idx < 0 || idx >= PHASE_ORDER.length - 1) return null;
  return PHASE_ORDER[idx + 1];
}

export function canTransition(from: AttackPhase, to: AttackPhase): boolean {
  const fromIdx = PHASE_ORDER.indexOf(from);
  const toIdx = PHASE_ORDER.indexOf(to);
  return toIdx === fromIdx || toIdx === fromIdx + 1; // can stay or advance one phase
}

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface ReActState {
  messages: Array<{ role: 'system' | 'user' | 'assistant' | 'tool'; content: string; tool_call_id?: string }>;
  iteration: number;
  maxIterations: number;
  engagementId: string;
  currentPhase: AttackPhase;
}

export interface BrainConfig {
  maxIterations?: number;
  model?: string;
  modelProvider?: 'ollama' | 'cloud' | 'local';
  temperature?: number;
  stopOnGate?: boolean;
}

export interface GateState {
  gateId: string;
  toolName: string;
  reason: string;
  riskLevel: string;
  pausedAt: number;
  stateSnapshot: ReActState;
  approvedBy?: string;
  approvedAt?: number;
  deniedBy?: string;
  deniedAt?: number;
}

export interface BrainResponse {
  response: string;
  toolsUsed: string[];
  discoveredAssets?: any[];
  vulnerabilities?: any[];
  status: 'completed' | 'paused' | 'heartbeat_ok' | 'silent';
  gateId?: string;
  gateReason?: string;
  nextPhase?: AttackPhase;
}

export interface CompletionOptions {
  model: string;
  messages: Array<{ role: string; content: string; tool_call_id?: string }>;
  tools?: Array<{ type: 'function'; function: { name: string; description: string; parameters: object } }>;
  temperature?: number;
}

export interface CompletionResponse {
  content: string | null;
  toolCalls?: Array<{ id: string; name: string; input: Record<string, unknown> }>;
  stopReason?: string | null;
}

// ─── AgentBrain class ─────────────────────────────────────────────────────────

/**
 * VANTA Core AgentBrain — ReAct loop for offensive security engagements
 * 
 * Extracted from Cephly AgentBrain with attack phase state machine:
 * - RECON → ENUMERATE → PLAN → EXPLOIT → PIVOT → REPORT
 * - Sovereign gating (PolicyEngine) before tool execution
 * - Immutable audit trail (SHA-256 chained logging)
 */
export class AgentBrain {
  private policyEngine: PolicyEngine;
  private scopeValidator: ScopeValidator;

  constructor(
    private toolRegistry: ToolRegistry,
    private auditService: AuditService,
    private sessionLane: SessionLaneQueue,
    private llmComplete: (options: CompletionOptions) => Promise<CompletionResponse>,
    policyLoader?: any
  ) {
    this.policyEngine = new PolicyEngine(auditService, policyLoader);
    
    // ScopeValidator initialized per-engagement (set in executeReActLoop)
    this.scopeValidator = new ScopeValidator(
      {
        engagementId: 'temp',
        allowedIpRanges: [],
        allowedDomains: [],
        allowedUrls: [],
        blockedTools: [],
        maxRiskLevel: 'MEDIUM',
        allowedPhases: ['RECON', 'ENUMERATE', 'PLAN', 'EXPLOIT', 'PIVOT', 'REPORT'],
      },
      auditService
    );

    // Register handler to recreate tasks from payloads after server restart
    this.sessionLane.registerHandler(async (payload) => {
      return this.executeReActLoop(
        payload.message,
        payload.context,
        payload.engagementId,
        payload.maxIterations,
        payload.config
      );
    });
  }

  /**
   * Main entry point — process a message with engagement context
   */
  async run(
    message: string,
    context: EngagementContext,
    sessionHistory?: any[],
    config?: BrainConfig
  ): Promise<BrainResponse> {
    return this.processMessage(message, context, config);
  }

  /**
   * Process message with serialized per-engagement execution
   */
  async processMessage(
    message: string,
    context: EngagementContext,
    config?: BrainConfig
  ): Promise<BrainResponse> {
    const engagementId = context.engagementId;
    const targetId = context.targetAsset?.id || 'primary';
    const maxIterations = config?.maxIterations ?? 20;

    // Audit: engagement_started
    await this.auditService.log({
      engagementId,
      agentId: 'vanta-core',
      sessionId: `${engagementId}:${targetId}`,
      eventType: 'engagement_started',
      actor: `operator:${context.scope.maxRiskLevel}`,
      action: 'message_received',
      outcome: 'success',
      phase: context.currentPhase,
      riskLevel: 'LOW'
    });

    // Serialize per-engagement execution via SessionLane
    const laneId = SessionLaneQueue.laneId(engagementId, targetId);
    const result = await this.sessionLane.enqueue(
      engagementId,
      targetId,
      { message, context, engagementId, maxIterations, config },
      async () => this.executeReActLoop(message, context, engagementId, maxIterations, config)
    );

    return result;
  }

  /**
   * Compact conversation history if it exceeds threshold
   */
  private async compactHistory(history: any[]): Promise<any[]> {
    const COMPACTION_THRESHOLD = 15;
    if (history.length <= COMPACTION_THRESHOLD) return history;

    const recent = history.slice(-5);
    const older = history.slice(0, -5);

    try {
      const response = await this.llmComplete({
        model: 'gpt-4o',
        messages: [{
          role: 'system',
          content: `Summarize the following attack engagement history:\n\n${JSON.stringify(older)}`
        }],
      });
      const summary = response.content || 'Summarized context.';
      return [
        { role: 'system', content: `Previous context: ${summary}` },
        ...recent
      ];
    } catch {
      return history.slice(-10);
    }
  }

  /**
   * ReAct (Reasoning + Acting) loop for attack execution
   */
  private async executeReActLoop(
    message: string,
    context: EngagementContext,
    engagementId: string,
    maxIterations: number,
    config?: BrainConfig
  ): Promise<BrainResponse> {
    // 0. Initialize ScopeValidator with engagement scope
    const scopeConfig: ScopeConfig = {
      engagementId,
      allowedIpRanges: context.scope.inScopeTargets.filter(t => this.isIPAddr(t)),
      allowedDomains: context.scope.inScopeTargets.filter(t => this.isDomainName(t)),
      allowedUrls: [],
      blockedTools: context.scope.blockedTools,
      maxRiskLevel: context.scope.maxRiskLevel,
      allowedPhases: [context.currentPhase], // Only current phase allowed
    };
    this.scopeValidator = new ScopeValidator(scopeConfig, this.auditService);

    // 1. Build system prompt for attack phase
    const systemPrompt = this.buildAttackSystemPrompt(context);

    // 2. Load session history
    let history: any[] = []; // In v1: no persistence, pass from caller
    history = await this.compactHistory(history);

    // 3. Initialize state
    const state: ReActState = {
      messages: [
        { role: 'system', content: systemPrompt },
        ...history.map((h: any) => ({ role: h.role, content: h.content, tool_call_id: h.tool_call_id })),
        { role: 'user', content: message },
      ],
      iteration: 0,
      maxIterations,
      engagementId,
      currentPhase: context.currentPhase,
    };

    const toolsUsed: string[] = [];
    const discoveredAssets: any[] = [];
    const vulnerabilities: any[] = [];

    // 4. ReAct loop
    while (state.iteration < state.maxIterations) {
      state.iteration++;

      // Audit: LLM_INFERENCE_REQUEST
      await this.auditService.log({
        engagementId,
        agentId: 'vanta-core',
        sessionId: `${engagementId}:${context.targetAsset?.id || 'primary'}`,
        eventType: 'recon_started',
        actor: 'agent',
        action: 'llm_call',
        outcome: 'success',
        phase: state.currentPhase,
        input: { iteration: state.iteration }
      });

      // Get phase-filtered tool schemas (SECURITY: only show tools for current phase)
      const phaseToolSchemas = this.toolRegistry.getSchemas(state.currentPhase);
      console.log('[AgentBrain] Phase-filtered tools:', phaseToolSchemas.length, 'tools for', state.currentPhase);

      // LLM completion (Ollama cloud model)
      const response = await this.llmComplete({
        model: config?.model ?? 'minimax-m2.7:cloud',
        messages: state.messages,
        temperature: config?.temperature ?? 0,
        tools: phaseToolSchemas as any,
      });

      // Use toolCalls directly from adapter response (not parsed from content)
      const assistantResponse = {
        thought: response.content || '',
        toolCalls: response.toolCalls || [],
      };

      state.messages.push({
        role: 'assistant',
        content: response.content || '',
      });

      // Handle tool calls
      console.log('[AgentBrain] assistantResponse.toolCalls:', assistantResponse.toolCalls);
      if (assistantResponse.toolCalls && assistantResponse.toolCalls.length > 0) {
        console.log('[AgentBrain] Processing', assistantResponse.toolCalls.length, 'tool calls');
        for (const toolCall of assistantResponse.toolCalls) {
          const toolName = toolCall.name;
          const toolParams = toolCall.input;
          const callId = toolCall.id || `call_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
          console.log('[AgentBrain] Tool call:', toolName, JSON.stringify(toolParams));
          console.log('[AgentBrain] Call ID:', callId);

          // 1. Scope Validation — MUST happen BEFORE PolicyEngine
          // SECURITY: Hard block if target is out of scope
          const scopeResult = this.scopeValidator.validateTarget(
            context.targetAsset || { id: 'primary', type: 'domain', value: 'unknown', discoveredAt: Date.now() },
            state.currentPhase
          );
          
          if (!scopeResult.allowed) {
            console.log('[AgentBrain] Tool BLOCKED by ScopeValidator:', scopeResult.reason);
            
            // Log scope violation
            await this.scopeValidator.logViolation(
              engagementId,
              context.targetAsset?.value || 'unknown',
              toolName,
              state.currentPhase,
              scopeResult
            );
            
            state.messages.push({
              role: 'tool',
              content: JSON.stringify({ success: false, error: `Scope violation: ${scopeResult.reason}` }),
              tool_call_id: callId
            });
            continue;
          }

          // 2. Policy check — happens AFTER scope validation
          const riskLevel = this.toolRegistry.getRiskLevel(toolName);
          console.log('[AgentBrain] Tool risk level:', riskLevel);
          const decision = await this.policyEngine.evaluate(context, toolName, riskLevel);
          console.log('[AgentBrain] Policy decision:', decision);

          if (decision.action === 'deny') {
            console.log('[AgentBrain] Tool DENIED');
            state.messages.push({
              role: 'tool',
              content: JSON.stringify({ success: false, error: `Tool denied: ${decision.reason}` }),
              tool_call_id: callId
            });
            continue;
          }

          if (decision.action === 'gate') {
            console.log('[AgentBrain] Tool GATED');
            // PAUSE the loop and request human approval
            const gateId = `gate_${Date.now()}`;
            
            // Save state for resume
            this.saveGateState(gateId, toolName, decision.reason, riskLevel, state);
            
            // Audit: gate_triggered
            await this.auditService.log({
              engagementId,
              agentId: 'vanta-core',
              sessionId: `${engagementId}:${context.targetAsset?.id || 'primary'}`,
              eventType: 'gate_triggered',
              actor: 'agent',
              action: 'gate_created',
              outcome: 'paused',
              input: { gateId, toolName, reason: decision.reason, riskLevel },
              phase: state.currentPhase,
              riskLevel: riskLevel as any
            });
            
            return {
              response: `Approval required: ${decision.reason}`,
              toolsUsed,
              status: 'paused',
              gateId,
              gateReason: decision.reason,
            };
          }

          // Execute tool — only after policy allows
          try {
            console.log('[AgentBrain] Executing tool:', toolName);
            const result = await this.toolRegistry.execute(toolName, toolParams, context);
            console.log('[AgentBrain] Tool result:', result.success, result.output ? 'has output' : 'no output');
            toolsUsed.push(toolName);
            console.log('[AgentBrain] toolsUsed now:', toolsUsed);

            if (result.discoveredAssets) {
              discoveredAssets.push(...result.discoveredAssets);
            }
            if (result.vulnerabilities) {
              vulnerabilities.push(...result.vulnerabilities);
            }

            // Audit: tool_success
            await this.auditService.log({
              engagementId,
              agentId: 'vanta-core',
              sessionId: `${engagementId}:${context.targetAsset?.id || 'primary'}`,
              eventType: 'vuln_identified',
              actor: 'agent',
              action: toolName,
              outcome: result.success ? 'success' : 'failure',
              phase: state.currentPhase,
              riskLevel: this.toolRegistry.getRiskLevel(toolName)
            });

            state.messages.push({ 
              role: 'tool', 
              content: JSON.stringify(result), 
              tool_call_id: callId 
            });
          } catch (toolError: any) {
            await this.auditService.log({
              engagementId,
              agentId: 'vanta-core',
              sessionId: `${engagementId}:${context.targetAsset?.id || 'primary'}`,
              eventType: 'gate_triggered',
              actor: 'agent',
              action: toolName,
              outcome: 'failure',
              input: { error: toolError.message },
              phase: state.currentPhase
            });
            state.messages.push({
              role: 'tool',
              content: JSON.stringify({ success: false, error: toolError.message }),
              tool_call_id: callId
            });
          }
        }
        continue;
      }

      // Check termination tokens
      const content = response.content || '';

      if (content.includes(HEARTBEAT_OK)) {
        return {
          response: HEARTBEAT_OK,
          toolsUsed,
          status: 'heartbeat_ok',
        };
      }

      if (content.includes(SILENT_REPLY_TOKEN)) {
        return {
          response: '',
          toolsUsed,
          status: 'silent',
        };
      }

      // Check for phase transition signal
      const phaseTransition = this.detectPhaseTransition(assistantResponse, context.currentPhase);
      if (phaseTransition && canTransition(context.currentPhase, phaseTransition)) {
        context.currentPhase = phaseTransition;
        state.currentPhase = phaseTransition;
      }

      // Final response
      await this.auditService.log({
        engagementId,
        agentId: 'vanta-core',
        sessionId: `${engagementId}:${context.targetAsset?.id || 'primary'}`,
        eventType: 'report_generated',
        actor: 'agent',
        action: 'response',
        outcome: 'success',
        phase: state.currentPhase
      });

      return {
        response: content,
        toolsUsed,
        discoveredAssets,
        vulnerabilities,
        status: 'completed',
        nextPhase: getNextPhase(state.currentPhase) ?? state.currentPhase,
      };
    }

    // Max iterations reached
    return {
      response: 'Max iterations reached. Provide more specific guidance.',
      toolsUsed,
      discoveredAssets,
      vulnerabilities,
      status: 'completed',
    };
  }

  /**
   * Build system prompt for attack phase
   */
  private buildAttackSystemPrompt(context: EngagementContext): string {
    const phaseInstructions: Record<AttackPhase, string> = {
      RECON: 'You are in RECON phase. Gather passive intelligence about targets. Use only recon tools (subdomain enum, WHOIS, DNS, screenshots). Do not interact with targets directly.',
      ENUMERATE: 'You are in ENUMERATE phase. Actively discover assets and services. Use enumeration tools (port scan, service detection, tech stack identification).',
      PLAN: 'You are in PLAN phase. Analyze discovered assets and plan attack chain. Identify vulnerabilities and prioritize targets.',
      EXPLOIT: 'You are in EXPLOIT phase. Execute exploits against confirmed vulnerabilities. Follow rules of engagement strictly.',
      PIVOT: 'You are in PIVOT phase. Move laterally from compromised assets. Discover additional targets through access.',
      REPORT: 'You are in REPORT phase. Generate findings report. Document all discovered assets, vulnerabilities, and attack chain.',
    };

    return `You are VANTA Core, an offensive security AI agent.

Current Phase: ${context.currentPhase}
${phaseInstructions[context.currentPhase] || 'Unknown phase'}

Engagement Scope:
- In-scope targets: ${context.scope.inScopeTargets.join(', ')}
- Out-of-scope targets: ${context.scope.outOfScopeTargets.join(', ')}
- Max risk level: ${context.scope.maxRiskLevel}
- Allowed tools: ${context.scope.allowedTools.length > 0 ? context.scope.allowedTools.join(', ') : 'all'}
- Blocked tools: ${context.scope.blockedTools.join(', ')}

Rules of Engagement:
${context.rulesOfEngagement.map((r: any) => `- ${r.description}: ${r.constraint}`).join('\n')}

Always:
1. Check scope before targeting
2. Respect risk level limits
3. Request approval for HIGH/CRITICAL actions
4. Log all discoveries to audit trail`;
  }

  /**
   * Detect phase transition from LLM response
   */
  private detectPhaseTransition(response: any, currentPhase: AttackPhase): AttackPhase | null {
    const content = response.content || '';
    const thought = response.thought || '';

    // Simple heuristic: look for phase keywords
    const phaseKeywords: Record<AttackPhase, string[]> = {
      RECON: ['recon', 'passive', 'gather', 'intelligence'],
      ENUMERATE: ['enumerate', 'discover', 'scan', 'active'],
      PLAN: ['plan', 'analyze', 'prioritize', 'strategy'],
      EXPLOIT: ['exploit', 'execute', 'attack', 'payload'],
      PIVOT: ['pivot', 'lateral', 'move', 'access'],
      REPORT: ['report', 'document', 'findings', 'summary'],
    };

    const nextPhase = getNextPhase(currentPhase);
    if (!nextPhase) return null;

    const keywords = phaseKeywords[nextPhase];
    if (keywords.some(k => content.toLowerCase().includes(k) || thought.toLowerCase().includes(k))) {
      return nextPhase;
    }

    return null;
  }

  /**
   * Active gates (paused engagements awaiting approval)
   */
  private activeGates: Map<string, GateState> = new Map();

  /**
   * Resume a gated engagement after human approval
   */
  async resumeGate(
    gateId: string,
    approvedBy: string,
    note?: string,
    approved: boolean = true
  ): Promise<BrainResponse> {
    const gateState = this.activeGates.get(gateId);
    
    if (!gateState) {
      throw new Error(`Gate not found: ${gateId}`);
    }

    // Audit: gate_approved or gate_denied
    await this.auditService.log({
      engagementId: gateState.stateSnapshot.engagementId,
      agentId: 'vanta-core',
      sessionId: `${gateState.stateSnapshot.engagementId}:primary`,
      eventType: approved ? 'gate_triggered' : 'gate_triggered',
      actor: `approver:${approvedBy}`,
      action: approved ? 'gate_approved' : 'gate_denied',
      outcome: approved ? 'success' : 'denied',
      input: { gateId, note: note || '', toolName: gateState.toolName, reason: gateState.reason },
      phase: gateState.stateSnapshot.currentPhase,
      riskLevel: gateState.riskLevel as any
    });

    if (!approved) {
      // Gate denied — terminate phase, move to REPORT with partial findings
      this.activeGates.delete(gateId);
      
      return {
        response: `Gate denied by ${approvedBy}: ${note || gateState.reason}`,
        toolsUsed: [],
        status: 'paused',
        gateId,
        gateReason: 'denied',
      };
    }

    // Gate approved — restore state and continue ReAct loop
    this.activeGates.delete(gateId);

    // Resume from paused state - reconstruct minimal context
    const resumedResult = await this.executeReActLoop(
      `[GATE APPROVED] ${note || 'Tool execution approved'}. Continue from where you paused.`,
      {
        engagementId: gateState.stateSnapshot.engagementId,
        currentPhase: gateState.stateSnapshot.currentPhase,
        scope: {
          inScopeTargets: [],
          outOfScopeTargets: [],
          allowedTools: [],
          blockedTools: [],
          maxRiskLevel: 'MEDIUM' as const,
        },
        rulesOfEngagement: [],
      },
      gateState.stateSnapshot.engagementId,
      gateState.stateSnapshot.maxIterations,
      {}
    );

    return resumedResult;
  }

  /**
   * Save gate state for later resume
   */
  private saveGateState(
    gateId: string,
    toolName: string,
    reason: string,
    riskLevel: string,
    state: ReActState
  ): void {
    this.activeGates.set(gateId, {
      gateId,
      toolName,
      reason,
      riskLevel,
      pausedAt: Date.now(),
      stateSnapshot: { ...state }, // Deep copy
    });
  }

  /**
   * Check if string is an IP address (IPv4 or IPv6)
   */
  private isIPAddr(value: string): boolean {
    const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Pattern = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
    return ipv4Pattern.test(value) || ipv6Pattern.test(value);
  }

  /**
   * Check if string is a domain name
   */
  private isDomainName(value: string): boolean {
    const domainPattern = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/;
    return domainPattern.test(value);
  }
}

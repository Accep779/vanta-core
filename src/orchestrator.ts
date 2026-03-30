/**
 * VANTA Core — Main Orchestrator
 * 
 * Autonomous threat intelligence platform orchestrator.
 * Manages engagement lifecycle: RECON → ENUM → SCAN → EXPLOIT → REPORT
 * 
 * GAN-inspired harness: Generator-Evaluator loop with PhaseContracts
 * 
 * @version 2.0.0
 * @author Nodevs (AI Autonomous Agent)
 */

import { AgentBrain } from './agent/agent-brain';
import { ToolRunner } from './tools/tool-runner';
import { ToolRegistry } from './tools/tool-registry';
import { AuditService } from './audit/audit.service';
import { ScopeValidator } from './engagement/scope-validator';
import { PolicyEngine } from './policy/policy-engine';
import { ClaudeCodeTool } from './tools/claude-code.tool';
import { ReconPlanner, ReconPlan, PhasePlan } from './planner/recon-planner';
import { QualityEvaluator, PhaseContract, EvaluationResult } from './evaluator/quality-evaluator';

export enum EngagementPhase {
  RECON = 'RECON',
  ENUMERATE = 'ENUMERATE',
  SCAN = 'SCAN',
  EXPLOIT = 'EXPLOIT',
  REPORT = 'REPORT'
}

export interface EngagementConfig {
  target: string;
  scope: string[];
  phases: EngagementPhase[];
  maxIterationsPerPhase: number;
  humanGateOnExploit: boolean;
  opsecMode: boolean;
}

export interface EngagementResult {
  engagementId: string;
  status: 'completed' | 'failed' | 'gated';
  phases: PhaseResult[];
  findings: Finding[];
  report?: string;
}

export interface PhaseResult {
  phase: EngagementPhase;
  status: 'completed' | 'failed' | 'skipped' | 'gated';
  output: any;
  duration: number;
}

export interface Finding {
  id: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  title: string;
  description: string;
  evidence: string;
  remediation: string;
  cvss?: number;
  cve?: string;
  name?: string;
  template?: string;
  ports?: any[];
}

export class VantaOrchestrator {
  private agentBrain: AgentBrain;
  private toolRunner: ToolRunner;
  private toolRegistry: ToolRegistry;
  private auditService: AuditService;
  private scopeValidator: ScopeValidator;
  private policyEngine: PolicyEngine;
  private claudeCode: ClaudeCodeTool;
  private reconPlanner: ReconPlanner;
  private qualityEvaluator: QualityEvaluator;
  
  private engagementId: string;
  private currentPhase: EngagementPhase;
  private findings: Finding[] = [];
  private activeContracts: Map<string, PhaseContract> = new Map();

  constructor() {
    this.auditService = new AuditService();
    this.toolRunner = new ToolRunner();
    this.toolRegistry = new ToolRegistry();
    this.scopeValidator = new ScopeValidator();
    this.policyEngine = new PolicyEngine(this.auditService);
    this.agentBrain = new AgentBrain(
      this.toolRegistry,
      this.auditService,
      null as any,
      null as any
    );
    this.claudeCode = new ClaudeCodeTool();
    this.reconPlanner = new ReconPlanner();
    this.qualityEvaluator = new QualityEvaluator();
    
    this.engagementId = `engagement-${Date.now()}`;
    this.currentPhase = EngagementPhase.RECON;
  }

  /**
   * Run full engagement lifecycle
   */
  async runEngagement(config: EngagementConfig): Promise<EngagementResult> {
    const startTime = Date.now();
    
    // Log engagement start
    await this.auditService.log({
      engagementId: this.engagementId,
      agentId: 'vanta-orchestrator',
      sessionId: this.engagementId,
      eventType: 'engagement_started',
      actor: 'vanta-orchestrator',
      action: 'start',
      outcome: 'engagement_started',
      metadata: {
        target: config.target,
        scope: config.scope,
        phases: config.phases,
      },
    });

    const phaseResults: PhaseResult[] = [];

    // Execute each phase
    for (const phase of config.phases) {
      this.currentPhase = phase;
      
      const phaseResult = await this.executePhase(phase, config);
      phaseResults.push(phaseResult);

      // Stop if phase failed or was gated
      if (phaseResult.status === 'failed' || phaseResult.status === 'gated') {
        await this.auditService.log({
          engagementId: this.engagementId,
          agentId: 'vanta-orchestrator',
          sessionId: this.engagementId,
          eventType: 'engagement_stopped',
          actor: 'vanta-orchestrator',
          action: 'phase_failure',
          outcome: 'engagement_stopped',
          metadata: {
            stoppedAtPhase: phase,
            reason: phaseResult.status,
          },
        });

        return {
          engagementId: this.engagementId,
          status: phaseResult.status === 'gated' ? 'gated' : 'failed',
          phases: phaseResults,
          findings: this.findings,
        };
      }
    }

    // Generate final report
    const report = await this.generateReport(config, phaseResults);

    const duration = Date.now() - startTime;

    await this.auditService.log({
      engagementId: this.engagementId,
      agentId: 'vanta-orchestrator',
      sessionId: this.engagementId,
      eventType: 'engagement_completed',
      actor: 'vanta-orchestrator',
      action: 'complete',
      outcome: 'engagement_complete',
      metadata: {
        duration,
        findingsCount: this.findings.length,
        phasesCompleted: phaseResults.length,
      },
    });

    return {
      engagementId: this.engagementId,
      status: 'completed',
      phases: phaseResults,
      findings: this.findings,
      report,
    };
  }

  /**
   * Execute a single phase with Generator-Evaluator loop
   * 
   * GAN-inspired pattern: Generator proposes, Evaluator grades, iterate until pass
   */
  private async executePhase(
    phase: EngagementPhase,
    config: EngagementConfig
  ): Promise<PhaseResult> {
    const phaseStart = Date.now();
    const maxIterations = config.maxIterationsPerPhase || 3;
    
    try {
      // Validate scope for this phase
      const scopeValid = await this.scopeValidator.validateTarget(
        config.target,
        config.scope as any
      );

      if (!scopeValid.allowed) {
        return {
          phase,
          status: 'failed',
          output: null,
          duration: Date.now() - phaseStart,
        };
      }

      // Step 1: Generate phase plan via ReconPlanner (if first phase)
      let plan: ReconPlan | null = null;
      if (phase === EngagementPhase.RECON) {
        plan = await this.reconPlanner.plan(config.target);
      }

      // Step 2: Negotiate phase contract between Generator and Evaluator
      const generatorProposal = await this.generatePhaseProposal(phase, plan);
      const contract = await this.qualityEvaluator.negotiateContract(
        phase,
        generatorProposal
      );
      
      this.activeContracts.set(phase, contract);

      // Step 3: Generator-Evaluator loop
      let iteration = 0;
      let output: any = null;
      let evaluation: EvaluationResult | null = null;

      while (iteration < maxIterations) {
        iteration++;
        
        // Generator executes
        output = await this.executePhaseLogic(phase, config.target, contract);
        
        // Evaluator grades output
        evaluation = await this.qualityEvaluator.evaluate(phase, output, contract);
        
        // Log evaluation
        await this.auditService.log({
          engagementId: this.engagementId,
          agentId: 'vanta-orchestrator',
          sessionId: this.engagementId,
          eventType: 'phase_evaluated',
          actor: 'vanta-orchestrator',
          action: 'evaluation',
          outcome: evaluation.passed ? 'phase_passed' : 'phase_rejected',
          metadata: {
            phase,
            iteration,
            score: evaluation.overallScore,
            passed: evaluation.passed,
            recommendedAction: evaluation.recommendedAction,
          },
        });

        // Check if passed
        if (evaluation.passed || evaluation.recommendedAction === 'PROCEED') {
          break;
        }
        
        // Handle recommended action
        if (evaluation.recommendedAction === 'ESCALATE') {
          return {
            phase,
            status: 'failed',
            output: { evaluation, iterations: iteration },
            duration: Date.now() - phaseStart,
          };
        }
        
        // REFINE or RETRY: Continue loop with feedback
        if (iteration >= maxIterations) {
          // Max iterations reached, return best effort
          break;
        }
      }

      // Handle EXPLOIT phase human gate
      if (phase === EngagementPhase.EXPLOIT && config.humanGateOnExploit) {
        const gateApproved = await this.requestHumanGate(config);
        if (!gateApproved) {
          return {
            phase,
            status: 'gated',
            output: null,
            duration: Date.now() - phaseStart,
          };
        }
      }

      return {
        phase,
        status: 'completed',
        output: { ...output, evaluation, iterations: iteration },
        duration: Date.now() - phaseStart,
      };
    } catch (error: any) {
      await this.auditService.log({
        engagementId: this.engagementId,
        agentId: 'vanta-orchestrator',
        sessionId: this.engagementId,
        eventType: 'phase_failed',
        actor: 'vanta-orchestrator',
        action: 'error',
        outcome: 'phase_failed',
        metadata: {
          phase,
          error: error.message,
        },
      });

      return {
        phase,
        status: 'failed',
        output: null,
        duration: Date.now() - phaseStart,
      };
    }
  }

  /**
   * Generate phase proposal for contract negotiation
   */
  private async generatePhaseProposal(
    phase: EngagementPhase,
    plan: ReconPlan | null
  ): Promise<string> {
    const proposalMap: Record<EngagementPhase, string> = {
      [EngagementPhase.RECON]: `Passive recon: subdomain enumeration via subfinder, HTTP probing via httpx. Expected: >=5 subdomains, >=3 live hosts.`,
      [EngagementPhase.ENUMERATE]: `Deep enumeration: endpoint discovery, tech stack fingerprinting. Expected: >=10 endpoints, service identification.`,
      [EngagementPhase.SCAN]: `Active scanning: port scan (nmap), vulnerability scan (nuclei). Expected: all open ports, CVE identification.`,
      [EngagementPhase.EXPLOIT]: `Exploit PoC generation for critical/high findings using Claude Code. Expected: working PoCs for top vulnerabilities.`,
      [EngagementPhase.REPORT]: `Final report generation with findings, evidence, remediation. Expected: comprehensive PDF/Markdown report.`,
    };

    return proposalMap[phase];
  }

  /**
   * Execute phase logic (Generator)
   */
  private async executePhaseLogic(
    phase: EngagementPhase,
    target: string,
    contract: PhaseContract
  ): Promise<any> {
    switch (phase) {
      case EngagementPhase.RECON:
        return await this.runRecon(target);
      case EngagementPhase.ENUMERATE:
        return await this.runEnumeration(target);
      case EngagementPhase.SCAN:
        return await this.runScan(target);
      case EngagementPhase.EXPLOIT:
        return await this.runExploit(target);
      case EngagementPhase.REPORT:
        return await this.generateReport({ target, scope: [], phases: [], maxIterationsPerPhase: 1, humanGateOnExploit: false, opsecMode: false }, []);
      default:
        throw new Error(`Unknown phase: ${phase}`);
    }
  }

  /**
   * RECON Phase: Subdomain enumeration
   */
  private async runRecon(target: string): Promise<any> {
    await this.auditService.log({
      engagementId: this.engagementId,
      agentId: 'vanta-orchestrator',
      sessionId: this.engagementId,
      eventType: 'recon_started',
      actor: 'vanta-orchestrator',
      action: 'subfinder',
      outcome: 'recon_initiated',
      metadata: { target },
    });

    const result = await this.toolRunner.runSubfinder(target);

    await this.auditService.log({
      engagementId: this.engagementId,
      agentId: 'vanta-orchestrator',
      sessionId: this.engagementId,
      eventType: 'recon_completed',
      actor: 'vanta-orchestrator',
      action: 'subfinder_complete',
      outcome: 'recon_complete',
      metadata: {
        subdomainsFound: result.subdomains?.length || 0,
      },
    });

    return result;
  }

  /**
   * ENUMERATE Phase: HTTP probing
   */
  private async runEnumeration(target: string): Promise<any> {
    await this.auditService.log({
      engagementId: this.engagementId,
      agentId: 'vanta-orchestrator',
      sessionId: this.engagementId,
      eventType: 'enumeration_started',
      actor: 'vanta-orchestrator',
      action: 'httpx',
      outcome: 'enum_initiated',
      metadata: { target },
    });

    const result = await this.toolRunner.runHttpx(target);

    await this.auditService.log({
      engagementId: this.engagementId,
      agentId: 'vanta-orchestrator',
      sessionId: this.engagementId,
      eventType: 'enumeration_completed',
      actor: 'vanta-orchestrator',
      action: 'httpx_complete',
      outcome: 'enum_complete',
      metadata: {
        liveHosts: result.liveHosts?.length || 0,
      },
    });

    return result;
  }

  /**
   * SCAN Phase: Port scan + vulnerability scan
   */
  private async runScan(target: string): Promise<any> {
    await this.auditService.log({
      engagementId: this.engagementId,
      agentId: 'vanta-orchestrator',
      sessionId: this.engagementId,
      eventType: 'scan_started',
      actor: 'vanta-orchestrator',
      action: 'nmap_nuclei',
      outcome: 'scan_initiated',
      metadata: { target },
    });

    const [nmapResult, nucleiResult] = await Promise.all([
      this.toolRunner.runNmap(target),
      this.toolRunner.runNuclei(target),
    ]);

    // Process findings
    if (nucleiResult.vulnerabilities) {
      for (const vuln of nucleiResult.vulnerabilities) {
        this.findings.push({
          id: `vuln-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          severity: vuln.severity || 'MEDIUM',
          title: (vuln as any).name || 'Vulnerability Detected',
          description: vuln.description || 'No description available',
          evidence: (vuln as any).evidence || (vuln as any).template || 'Unknown',
          remediation: (vuln as any).remediation || 'Apply vendor patches',
          cvss: (vuln as any).cvss,
          cve: (vuln as any).cve,
        });
      }
    }

    await this.auditService.log({
      engagementId: this.engagementId,
      agentId: 'vanta-orchestrator',
      sessionId: this.engagementId,
      eventType: 'scan_completed',
      actor: 'vanta-orchestrator',
      action: 'nmap_nuclei_complete',
      outcome: 'scan_complete',
      metadata: {
        openPorts: nmapResult.ports?.length || 0,
        vulnerabilities: nucleiResult.vulnerabilities?.length || 0,
      },
    });

    return { nmap: nmapResult, nuclei: nucleiResult };
  }

  /**
   * EXPLOIT Phase: Generate exploit PoCs
   */
  private async runExploit(target: string): Promise<any> {
    await this.auditService.log({
      engagementId: this.engagementId,
      agentId: 'vanta-orchestrator',
      sessionId: this.engagementId,
      eventType: 'exploit_started',
      actor: 'vanta-orchestrator',
      action: 'claude_exploit_gen',
      outcome: 'exploit_initiated',
      metadata: { target, findingsCount: this.findings.length },
    });

    // Use Claude Code to generate exploit PoCs for critical findings
    const criticalFindings = this.findings.filter(
      f => f.severity === 'CRITICAL' || f.severity === 'HIGH'
    );

    const exploitPocs = await this.claudeCode.generateExploits({
      findings: criticalFindings,
      target,
    });

    await this.auditService.log({
      engagementId: this.engagementId,
      agentId: 'vanta-orchestrator',
      sessionId: this.engagementId,
      eventType: 'exploit_completed',
      actor: 'vanta-orchestrator',
      action: 'claude_exploit_complete',
      outcome: 'exploit_complete',
      metadata: {
        exploitsGenerated: exploitPocs.length,
      },
    });

    return { exploitPocs };
  }

  /**
   * Generate final report
   */
  private async generateReport(
    config: EngagementConfig,
    phaseResults: PhaseResult[]
  ): Promise<string> {
    await this.auditService.log({
      engagementId: this.engagementId,
      agentId: 'vanta-orchestrator',
      sessionId: this.engagementId,
      eventType: 'report_started',
      actor: 'vanta-orchestrator',
      action: 'claude_report_gen',
      outcome: 'report_initiated',
      metadata: {
        target: config.target,
        findingsCount: this.findings.length,
      },
    });

    const report = await this.claudeCode.generateReport({
      engagementId: this.engagementId,
      target: config.target,
      scope: config.scope,
      phases: phaseResults,
      findings: this.findings,
    });

    await this.auditService.log({
      engagementId: this.engagementId,
      agentId: 'vanta-orchestrator',
      sessionId: this.engagementId,
      eventType: 'report_completed',
      actor: 'vanta-orchestrator',
      action: 'report_complete',
      outcome: 'report_complete',
      metadata: {
        reportLength: report.length,
      },
    });

    return report;
  }

  /**
   * Request human gate approval for EXPLOIT phase
   */
  private async requestHumanGate(config: EngagementConfig): Promise<boolean> {
    await this.auditService.log({
      engagementId: this.engagementId,
      agentId: 'vanta-orchestrator',
      sessionId: this.engagementId,
      eventType: 'gate_triggered',
      actor: 'vanta-orchestrator',
      action: 'human_approval_required',
      outcome: 'gate_pending_approval',
      metadata: {
        phase: EngagementPhase.EXPLOIT,
        reason: 'High-risk exploitation requires human authorization',
        findingsCount: this.findings.length,
      },
    });

    // In production, this would send a notification to Slack/Telegram/Email
    // and wait for human approval via callback
    console.log(`
⚠️  HUMAN GATE TRIGGERED
━━━━━━━━━━━━━━━━━━━━━━
Engagement: ${this.engagementId}
Phase: EXPLOIT
Target: ${config.target}
Findings: ${this.findings.length}

Approval required before proceeding with exploitation.
    `);

    // Placeholder: In production, wait for webhook/callback
    // For now, return false to demonstrate gating works
    return false;
  }

  /**
   * Get current engagement status
   */
  getStatus(): {
    engagementId: string;
    currentPhase: EngagementPhase;
    findingsCount: number;
  } {
    return {
      engagementId: this.engagementId,
      currentPhase: this.currentPhase,
      findingsCount: this.findings.length,
    };
  }
}

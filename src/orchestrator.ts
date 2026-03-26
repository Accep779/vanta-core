/**
 * VANTA Core — Main Orchestrator
 * 
 * Autonomous threat intelligence platform orchestrator.
 * Manages engagement lifecycle: RECON → ENUM → SCAN → EXPLOIT → REPORT
 * 
 * @version 1.1.0
 * @author Nodevs (AI Autonomous Agent)
 */

import { AgentBrain } from './agent/agent-brain';
import { ToolRunner } from './tools/tool-runner';
import { ToolRegistry } from './tools/tool-registry';
import { AuditService } from './audit/audit.service';
import { ScopeValidator } from './engagement/scope-validator';
import { PolicyEngine, RiskLevel } from './policy/policy-engine';
import { ClaudeCodeTool } from './tools/claude-code.tool';

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
}

export class VantaOrchestrator {
  private agentBrain: AgentBrain;
  private toolRunner: ToolRunner;
  private toolRegistry: ToolRegistry;
  private auditService: AuditService;
  private scopeValidator: ScopeValidator;
  private policyEngine: PolicyEngine;
  private claudeCode: ClaudeCodeTool;
  
  private engagementId: string;
  private currentPhase: EngagementPhase;
  private findings: Finding[] = [];

  constructor() {
    this.agentBrain = new AgentBrain();
    this.toolRunner = new ToolRunner();
    this.toolRegistry = new ToolRegistry();
    this.auditService = new AuditService();
    this.scopeValidator = new ScopeValidator();
    this.policyEngine = new PolicyEngine();
    this.claudeCode = new ClaudeCodeTool();
    
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
      eventType: 'engagement_started',
      actor: 'vanta-orchestrator',
      action: 'start',
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
          eventType: 'engagement_stopped',
          actor: 'vanta-orchestrator',
          action: 'phase_failure',
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
      eventType: 'engagement_completed',
      actor: 'vanta-orchestrator',
      action: 'complete',
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
   * Execute a single phase
   */
  private async executePhase(
    phase: EngagementPhase,
    config: EngagementConfig
  ): Promise<PhaseResult> {
    const phaseStart = Date.now();
    
    try {
      // Validate scope for this phase
      const scopeValid = await this.scopeValidator.validateTarget(
        config.target,
        { allowedDomains: config.scope }
      );

      if (!scopeValid.allowed) {
        return {
          phase,
          status: 'failed',
          output: null,
          duration: Date.now() - phaseStart,
        };
      }

      let output: any;

      switch (phase) {
        case EngagementPhase.RECON:
          output = await this.runRecon(config.target);
          break;
        case EngagementPhase.ENUMERATE:
          output = await this.runEnumeration(config.target);
          break;
        case EngagementPhase.SCAN:
          output = await this.runScan(config.target);
          break;
        case EngagementPhase.EXPLOIT:
          if (config.humanGateOnExploit) {
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
          output = await this.runExploit(config.target);
          break;
        case EngagementPhase.REPORT:
          output = await this.generateReport(config, []);
          break;
      }

      return {
        phase,
        status: 'completed',
        output,
        duration: Date.now() - phaseStart,
      };
    } catch (error: any) {
      await this.auditService.log({
        engagementId: this.engagementId,
        eventType: 'phase_failed',
        actor: 'vanta-orchestrator',
        action: 'error',
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
   * RECON Phase: Subdomain enumeration
   */
  private async runRecon(target: string): Promise<any> {
    await this.auditService.log({
      engagementId: this.engagementId,
      eventType: 'recon_started',
      actor: 'vanta-orchestrator',
      action: 'subfinder',
      metadata: { target },
    });

    const result = await this.toolRunner.runSubfinder(target);

    await this.auditService.log({
      engagementId: this.engagementId,
      eventType: 'recon_completed',
      actor: 'vanta-orchestrator',
      action: 'subfinder_complete',
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
      eventType: 'enumeration_started',
      actor: 'vanta-orchestrator',
      action: 'httpx',
      metadata: { target },
    });

    const result = await this.toolRunner.runHttpx([target]);

    await this.auditService.log({
      engagementId: this.engagementId,
      eventType: 'enumeration_completed',
      actor: 'vanta-orchestrator',
      action: 'httpx_complete',
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
      eventType: 'scan_started',
      actor: 'vanta-orchestrator',
      action: 'nmap_nuclei',
      metadata: { target },
    });

    const [nmapResult, nucleiResult] = await Promise.all([
      this.toolRunner.runNmap(target),
      this.toolRunner.runNuclei([target]),
    ]);

    // Process findings
    if (nucleiResult.vulnerabilities) {
      for (const vuln of nucleiResult.vulnerabilities) {
        this.findings.push({
          id: `vuln-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          severity: vuln.severity || 'MEDIUM',
          title: vuln.name || 'Vulnerability Detected',
          description: vuln.description || 'No description available',
          evidence: vuln.evidence || vuln.template || 'Unknown',
          remediation: vuln.remediation || 'Apply vendor patches',
          cvss: vuln.cvss,
          cve: vuln.cve,
        });
      }
    }

    await this.auditService.log({
      engagementId: this.engagementId,
      eventType: 'scan_completed',
      actor: 'vanta-orchestrator',
      action: 'nmap_nuclei_complete',
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
      eventType: 'exploit_started',
      actor: 'vanta-orchestrator',
      action: 'claude_exploit_gen',
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
      eventType: 'exploit_completed',
      actor: 'vanta-orchestrator',
      action: 'claude_exploit_complete',
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
      eventType: 'report_started',
      actor: 'vanta-orchestrator',
      action: 'claude_report_gen',
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
      eventType: 'report_completed',
      actor: 'vanta-orchestrator',
      action: 'report_complete',
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
      eventType: 'gate_triggered',
      actor: 'vanta-orchestrator',
      action: 'human_approval_required',
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

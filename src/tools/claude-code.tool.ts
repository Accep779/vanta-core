/**
 * VANTA Core — Claude Code Tool
 * 
 * Wrapper for Claude Code CLI in headless mode.
 * Used for: exploit PoC generation, report writing, novel vulnerability analysis
 * 
 * @version 1.0.0
 */

import { execAsync } from '../utils/exec';
import { Finding } from '../orchestrator';

export interface ClaudeCodeConfig {
  model?: string;
  allowedTools?: string[];
  systemPrompt?: string;
  timeoutMs?: number;
}

export interface ExploitPoC {
  findingId: string;
  title: string;
  description: string;
  pocCode: string;
  language: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  instructions: string;
}

export interface SecurityReport {
  executiveSummary: string;
  findings: string;
  recommendations: string;
  technicalDetails: string;
  complianceStatus: string;
}

export class ClaudeCodeTool {
  private config: ClaudeCodeConfig;

  constructor(config?: ClaudeCodeConfig) {
    this.config = {
      model: 'claude-sonnet-4-20250514',
      allowedTools: ['Bash(*)', 'Read(*)', 'Write(*)'],
      systemPrompt: 'You are a senior security researcher.',
      timeoutMs: 300000, // 5 minutes
      ...config,
    };
  }

  /**
   * Generate exploit PoCs for critical findings
   */
  async generateExploits(params: {
    findings: Finding[];
    target: string;
  }): Promise<ExploitPoC[]> {
    const prompt = this.buildExploitPrompt(params);

    const result = await this.runHeadless({
      prompt,
      systemPrompt: `You are an expert penetration tester.
Generate working exploit proof-of-concept code for the provided vulnerabilities.
Focus on:
- Clean, documented code
- Safe demonstration (no actual damage)
- Clear exploitation steps
- Remediation verification

Output JSON format only.`,
      outputFormat: 'json',
    });

    return this.parseExploitResponse(result, params.findings);
  }

  /**
   * Generate security report
   */
  async generateReport(params: {
    engagementId: string;
    target: string;
    scope: string[];
    phases: any[];
    findings: Finding[];
  }): Promise<string> {
    const prompt = this.buildReportPrompt(params);

    const result = await this.runHeadless({
      prompt,
      systemPrompt: `You are a senior security consultant writing an executive report.
Structure:
1. Executive Summary (CISO/Board level)
2. Key Findings (prioritized by risk)
3. Technical Details (for security team)
4. Remediation Recommendations (actionable)
5. Compliance Status (PCI-DSS, SOC2, ISO 27001)

Tone: Professional, clear, actionable.
Avoid: Jargon without explanation.`,
      outputFormat: 'markdown',
    });

    return result;
  }

  /**
   * Analyze novel vulnerability
   */
  async analyzeVulnerability(params: {
    cve?: string;
    description: string;
    affected: string;
    cvss?: number;
  }): Promise<{
    severity: string;
    exploitability: string;
    analysis: string;
    mitigation: string;
    similarCVEs: string[];
  }> {
    const prompt = `Analyze this vulnerability:

CVE: ${params.cve || 'Unknown'}
Description: ${params.description}
Affected: ${params.affected}
CVSS: ${params.cvss || 'Not scored'}

Provide:
1. Severity assessment
2. Exploitability analysis
3. Attack vector
4. Mitigation priorities
5. Similar historical CVEs`;

    const result = await this.runHeadless({
      prompt,
      systemPrompt: 'You are a vulnerability researcher.',
      outputFormat: 'json',
    });

    return JSON.parse(result);
  }

  /**
   * Run Claude Code in headless mode
   */
  private async runHeadless(params: {
    prompt: string;
    systemPrompt?: string;
    outputFormat?: 'json' | 'markdown' | 'text';
  }): Promise<string> {
    const { prompt, systemPrompt = this.config.systemPrompt, outputFormat = 'text' } = params;

    // Write system prompt to temp file
    const systemPromptFile = `/tmp/claude-system-${Date.now()}.md`;
    const safePrompt = systemPrompt || this.config.systemPrompt || '';
    await execAsync(`echo ${this.escapeShell(safePrompt)} > ${systemPromptFile}`);

    // Build Claude Code command
    const allowedTools = this.config.allowedTools?.join(',') || 'Bash(*)';
    const command = `claude -p ${this.escapeShell(prompt)} ` +
      `--allowedTools "${allowedTools}" ` +
      `--output-format ${outputFormat}`;

    try {
      const { stdout, stderr } = await execAsync(command, {
        timeout: this.config.timeoutMs,
      });

      // Cleanup
      await execAsync(`rm -f ${systemPromptFile}`);

      if (stderr) {
        console.error('[ClaudeCode] stderr:', stderr);
      }

      return stdout;
    } catch (error: any) {
      await execAsync(`rm -f ${systemPromptFile}`);
      throw new Error(`Claude Code execution failed: ${error.message}`);
    }
  }

  /**
   * Build exploit generation prompt
   */
  private buildExploitPrompt(params: { findings: Finding[]; target: string }): string {
    const findingsContext = params.findings.map((f, i) => `
${i + 1}. ${f.title}
   Severity: ${f.severity}
   CVE: ${f.cve || 'N/A'}
   Description: ${f.description}
   Evidence: ${f.evidence}
`).join('\n');

    return `Generate exploit proof-of-concept code for these vulnerabilities:

Target: ${params.target}

Findings:
${findingsContext}

Requirements:
- Generate working PoC for each CRITICAL/HIGH severity finding
- Use safe demonstration (no actual damage)
- Include clear comments
- Output as JSON array with: findingId, title, description, pocCode, language, riskLevel, instructions

Example output format:
[
  {
    "findingId": "vuln-123",
    "title": "SQL Injection on /api/login",
    "description": "Authenticated SQLi allows data extraction",
    "pocCode": "curl -X POST 'http://target/api/login' -d 'user=admin'\\'-- -'",
    "language": "bash",
    "riskLevel": "HIGH",
    "instructions": "1. Send this request, 2. Observe response"
  }
]`;
  }

  /**
   * Build report generation prompt
   */
  private buildReportPrompt(params: {
    engagementId: string;
    target: string;
    scope: string[];
    phases: any[];
    findings: Finding[];
  }): string {
    const findingsContext = params.findings.map((f, i) => `
${i + 1}. **${f.title}**
   - Severity: ${f.severity}
   - CVE: ${f.cve || 'N/A'}
   - CVSS: ${f.cvss || 'N/A'}
   - Description: ${f.description}
   - Remediation: ${f.remediation}
`).join('\n');

    const phasesContext = params.phases.map((p) => `
- ${p.phase}: ${p.status} (${p.duration}ms)
`).join('\n');

    return `Generate a comprehensive security assessment report.

Engagement ID: ${params.engagementId}
Target: ${params.target}
Scope: ${params.scope.join(', ')}

Phases Executed:
${phasesContext}

Findings (${params.findings.length} total):
${findingsContext}

Generate report with:
1. Executive Summary (150-200 words)
2. Key Metrics (security score, findings by severity)
3. Top 3 Critical Findings (with business impact)
4. Remediation Roadmap (prioritized)
5. Compliance Status (PCI-DSS, SOC2, ISO 27001)
6. Appendix (technical details)

Format: Markdown with headers, tables, bullet points.`;
  }

  /**
   * Parse exploit response from Claude
   */
  private parseExploitResponse(response: string, findings: Finding[]): ExploitPoC[] {
    try {
      const parsed = JSON.parse(response);
      return parsed.map((poc: any) => ({
        findingId: poc.findingId,
        title: poc.title,
        description: poc.description,
        pocCode: poc.pocCode,
        language: poc.language,
        riskLevel: poc.riskLevel,
        instructions: poc.instructions,
      }));
    } catch (error) {
      // Fallback: create placeholder PoCs
      return findings.map((f) => ({
        findingId: f.id,
        title: `${f.title} - PoC`,
        description: `Exploit PoC for ${f.title}`,
        pocCode: '# PoC generation requires manual review',
        language: 'text',
        riskLevel: f.severity as any,
        instructions: 'Manual verification required',
      }));
    }
  }

  /**
   * Escape shell string
   */
  private escapeShell(str: string): string {
    return `'${str.replace(/'/g, "'\\''")}'`;
  }
}

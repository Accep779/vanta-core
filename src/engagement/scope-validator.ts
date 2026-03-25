import { EngagementScope, TargetAsset } from '../tools/tool-registry';
import { AuditService } from '../audit/audit.service';

/**
 * Scope Validation Result
 */
export interface ScopeValidationResult {
  allowed: boolean;
  reason: string;
  violationType?: 'out_of_scope_target' | 'blocked_tool' | 'risk_exceeded' | 'phase_mismatch';
  blockedBy?: 'scope_validator' | 'policy_engine';
}

/**
 * Scope Config — Immutable engagement scope definition
 */
export interface ScopeConfig {
  engagementId: string;
  allowedIpRanges: string[];      // CIDR notation: "192.168.1.0/24"
  allowedDomains: string[];        // "example.com", "*.sub.example.com"
  allowedUrls: string[];           // "https://api.example.com/*"
  blockedTools: string[];          // Tool names explicitly blocked
  maxRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  allowedPhases: AttackPhase[];    // Which phases are allowed
}

export type AttackPhase = 'RECON' | 'ENUMERATE' | 'PLAN' | 'EXPLOIT' | 'PIVOT' | 'REPORT';

/**
 * VANTA Core ScopeValidator — Architectural enforcement of engagement scope
 * 
 * SECURITY REQUIREMENT:
 * - Runs BEFORE PolicyEngine in tool execution loop
 * - Hard block: if target is not in allowedIpRanges or allowedDomains → deny
 * - Does not rely on agent prompting — enforces architecturally
 * - Logs scope_violation_blocked to audit trail
 */
export class ScopeValidator {
  private scopeConfig: ScopeConfig;
  private auditService: AuditService;

  constructor(scopeConfig: ScopeConfig, auditService: AuditService) {
    this.scopeConfig = scopeConfig;
    this.auditService = auditService;
  }

  /**
   * Validate a target asset against scope config
   * Must run BEFORE PolicyEngine.evaluate()
   */
  validateTarget(target: TargetAsset | string, phase: AttackPhase): ScopeValidationResult {
    const targetValue = typeof target === 'string' ? target : target.value;
    const targetType = typeof target === 'string' ? 'unknown' : target.type;

    // 1. Check if target is in allowed IP ranges
    if (targetType === 'ip' || this.isIP(targetValue)) {
      const ipMatch = this.matchIpRange(targetValue);
      if (!ipMatch.allowed) {
        return {
          allowed: false,
          reason: `IP ${targetValue} is not in any allowed IP range`,
          violationType: 'out_of_scope_target',
          blockedBy: 'scope_validator',
        };
      }
    }

    // 2. Check if target is in allowed domains
    if (targetType === 'domain' || this.isDomain(targetValue)) {
      const domainMatch = this.matchDomain(targetValue);
      if (!domainMatch.allowed) {
        return {
          allowed: false,
          reason: `Domain ${targetValue} is not in allowed domains list`,
          violationType: 'out_of_scope_target',
          blockedBy: 'scope_validator',
        };
      }
    }

    // 3. Check if phase is allowed
    if (!this.scopeConfig.allowedPhases.includes(phase)) {
      return {
        allowed: false,
        reason: `Phase ${phase} is not allowed for this engagement`,
        violationType: 'phase_mismatch',
        blockedBy: 'scope_validator',
      };
    }

    // Target is in scope
    return {
      allowed: true,
      reason: 'Target is within scope',
    };
  }

  /**
   * Validate a tool against scope config
   */
  validateTool(toolName: string, phase: AttackPhase): ScopeValidationResult {
    // 1. Check if tool is explicitly blocked
    if (this.scopeConfig.blockedTools.includes(toolName)) {
      return {
        allowed: false,
        reason: `Tool ${toolName} is explicitly blocked by scope config`,
        violationType: 'blocked_tool',
        blockedBy: 'scope_validator',
      };
    }

    // 2. Check phase compatibility (defensive - ToolRegistry also checks)
    const phaseTools: Record<AttackPhase, string[]> = {
      RECON: ['subfinder', 'httpx', 'wayback', 'dns', 'whois'],
      ENUMERATE: ['nmap', 'nuclei', 'whatweb', 'ssl-scan'],
      PLAN: ['nmap', 'nuclei', 'subfinder'],
      EXPLOIT: ['nuclei-exploit', 'sqlmap', 'metasploit'],
      PIVOT: ['metasploit', 'credential-spray'],
      REPORT: ['finding-synthesis'],
    };

    const phaseAllowedTools = phaseTools[phase];
    if (!phaseAllowedTools.includes(toolName)) {
      return {
        allowed: false,
        reason: `Tool ${toolName} is not compatible with ${phase} phase`,
        violationType: 'phase_mismatch',
        blockedBy: 'scope_validator',
      };
    }

    return {
      allowed: true,
      reason: 'Tool is allowed for this phase',
    };
  }

  /**
   * Log scope violation to audit trail
   */
  async logViolation(
    engagementId: string,
    target: string,
    toolName: string,
    phase: AttackPhase,
    result: ScopeValidationResult
  ): Promise<void> {
    await this.auditService.log({
      engagementId,
      agentId: 'vanta-core',
      sessionId: `${engagementId}:primary`,
      eventType: 'gate_triggered',
      actor: 'scope-validator',
      action: 'scope_violation_blocked',
      outcome: 'failure',
      input: {
        target,
        toolName,
        phase,
        reason: result.reason,
        violationType: result.violationType,
      },
      phase,
      riskLevel: 'HIGH'
    });
  }

  /**
   * Check if string is an IP address (IPv4 or IPv6)
   */
  private isIP(value: string): boolean {
    const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Pattern = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
    return ipv4Pattern.test(value) || ipv6Pattern.test(value);
  }

  /**
   * Check if string is a domain
   */
  private isDomain(value: string): boolean {
    const domainPattern = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/;
    return domainPattern.test(value);
  }

  /**
   * Match IP against allowed CIDR ranges
   */
  private matchIpRange(ip: string): { allowed: boolean; matchedRange?: string } {
    // Simple CIDR matching (production: use ipaddr.js library)
    for (const range of this.scopeConfig.allowedIpRanges) {
      if (this.ipInCidr(ip, range)) {
        return { allowed: true, matchedRange: range };
      }
    }
    return { allowed: false };
  }

  /**
   * Match domain against allowed domains (supports wildcards)
   */
  private matchDomain(domain: string): { allowed: boolean; matchedDomain?: string } {
    for (const allowedDomain of this.scopeConfig.allowedDomains) {
      if (allowedDomain.startsWith('*.')) {
        // Wildcard subdomain match
        const baseDomain = allowedDomain.substring(2);
        if (domain === baseDomain || domain.endsWith('.' + baseDomain)) {
          return { allowed: true, matchedDomain: allowedDomain };
        }
      } else {
        // Exact match
        if (domain === allowedDomain) {
          return { allowed: true, matchedDomain: allowedDomain };
        }
      }
    }
    return { allowed: false };
  }

  /**
   * Check if IP is in CIDR range (simplified implementation)
   * Production: use ipaddr.js or netmask library
   */
  private ipInCidr(ip: string, cidr: string): boolean {
    // Simplified: for production use proper IP library
    const [range, bits] = cidr.split('/');
    const mask = bits ? parseInt(bits) : 32;
    
    // Convert IP to number (IPv4 only for now)
    const ipNum = this.ipToNumber(ip);
    const rangeNum = this.ipToNumber(range);
    const maskNum = Math.pow(2, 32 - mask);
    
    return ipNum >= rangeNum && ipNum < rangeNum + maskNum;
  }

  /**
   * Convert IPv4 to number
   */
  private ipToNumber(ip: string): number {
    const parts = ip.split('.').map(p => parseInt(p));
    return (parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
  }
}

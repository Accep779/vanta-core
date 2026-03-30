import { createHash } from 'crypto';

/**
 * VANTA Core Audit Service — Immutable attack chain logging
 * 
 * Extracted from Cephly AuditService with attack event vocabulary:
 * - job_created → recon_started
 * - clarification_sent → vuln_identified
 * - New: gate_triggered, exploit_executed, pivot_completed
 */

export interface AuditLogInput {
  engagementId: string;
  agentId: string;
  sessionId: string;
  targetId?: string;
  eventType: AttackEventType;
  actor: string;
  action: string;
  input?: any;
  outcome: string;
  policyRule?: string;
  durationMs?: number;
  phase?: AttackPhase;
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  metadata?: any;
}

export type AttackEventType = 
  | 'engagement_started'
  | 'engagement_stopped'
  | 'engagement_completed'
  | 'recon_started'
  | 'recon_completed'
  | 'enumeration_started'
  | 'enumeration_completed'
  | 'phase_evaluated'
  | 'phase_failed'
  | 'vuln_identified'
  | 'gate_triggered'
  | 'exploit_executed'
  | 'pivot_completed'
  | 'report_generated'
  | 'scan_started'
  | 'scan_completed'
  | 'exploit_started'
  | 'exploit_completed'
  | 'report_started'
  | 'report_completed';

export type AttackPhase = 
  | 'RECON'
  | 'ENUMERATE'
  | 'PLAN'
  | 'EXPLOIT'
  | 'PIVOT'
  | 'REPORT';

export class AuditService {
  private storage: Map<string, AuditLogEntry[]> = new Map();

  constructor(storage: Map<string, AuditLogEntry[]> = new Map()) {
    this.storage = storage;
    // In production, replace with database/Prisma client
    // For v1: in-memory storage (replace before production)
  }

  async log(event: Partial<AuditLogInput> & { 
    engagementId: string; 
    agentId: string; 
    sessionId: string; 
    eventType: AttackEventType; 
    outcome: string;
    metadata?: any;
  }): Promise<void> {
    const key = `${event.engagementId}:${event.sessionId}`;
    
    // Get hash of previous entry for this engagement (for chaining)
    const entries = this.storage.get(key) || [];
    const prev = entries.length > 0 ? entries[entries.length - 1] : null;

    const actor = event.actor || 'agent';
    const action = event.action || 'system';

    // hash = SHA-256(prevHash + this event payload)
    const payload = JSON.stringify({ 
      prev: prev?.hash ?? 'genesis', 
      engagementId: event.engagementId,
      agentId: event.agentId,
      sessionId: event.sessionId,
      eventType: event.eventType,
      actor,
      action,
      outcome: event.outcome
    });
    const hash = createHash('sha256').update(payload).digest('hex');

    const entry: AuditLogEntry = { 
      id: crypto.randomUUID(),
      engagementId: event.engagementId!,
      agentId: event.agentId!,
      sessionId: event.sessionId!,
      targetId: event.targetId,
      eventType: event.eventType!,
      actor,
      action,
      input: event.input,
      outcome: event.outcome,
      policyRule: event.policyRule,
      durationMs: event.durationMs,
      phase: event.phase,
      riskLevel: event.riskLevel,
      metadata: event.metadata,
      hash,
      createdAt: Date.now()
    };

    if (!this.storage.has(key)) {
      this.storage.set(key, []);
    }
    this.storage.get(key)!.push(entry);
  }

  /**
   * Verify integrity of audit chain for an engagement
   */
  async verify(engagementId: string): Promise<{ valid: boolean; brokenAt?: string }> {
    const entries = this.getAllForEngagement(engagementId);

    let prevHash = 'genesis';
    for (const entry of entries) {
      const payload = JSON.stringify({ 
        prev: prevHash, 
        ...this.omit(entry, ['hash', 'createdAt']) 
      });
      const expected = createHash('sha256').update(payload).digest('hex');
      if (expected !== entry.hash) {
        return { valid: false, brokenAt: entry.id };
      }
      prevHash = entry.hash;
    }
    return { valid: true };
  }

  getAllForEngagement(engagementId: string): AuditLogEntry[] {
    const allEntries: AuditLogEntry[] = [];
    for (const [key, entries] of this.storage.entries()) {
      if (key.startsWith(engagementId)) {
        allEntries.push(...entries);
      }
    }
    return allEntries.sort((a, b) => a.createdAt - b.createdAt);
  }

  getChain(engagementId: string, sessionId: string): AuditLogEntry[] {
    const key = `${engagementId}:${sessionId}`;
    return this.storage.get(key) || [];
  }

  private omit(obj: any, keys: string[]): any {
    const result = { ...obj };
    for (const key of keys) {
      delete result[key];
    }
    return result;
  }
}

export interface AuditLogEntry {
  id: string;
  engagementId: string;
  agentId: string;
  sessionId: string;
  targetId?: string;
  eventType: AttackEventType;
  actor: string;
  action: string;
  input?: any;
  outcome: string;
  policyRule?: string;
  durationMs?: number;
  phase?: AttackPhase;
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  metadata?: any;
  hash: string;
  createdAt: number;
}

/**
 * PhaseContract - Negotiated agreement between Generator and Evaluator
 * 
 * Before each engagement phase, the generator proposes what it will build
 * and how success will be verified. The evaluator reviews and approves
 * (or requests changes) before work begins.
 */

export interface PhaseContract {
  /** Phase name (RECON, SCAN, ENUMERATE, etc.) */
  phase: string;
  
  /** Generator's proposal for what will be accomplished */
  generatorProposal: GeneratorProposal;
  
  /** Agreed-upon success criteria */
  agreedCriteria: ContractCriterion[];
  
  /** Evaluator's approval status */
  evaluatorApproval: boolean;
  
  /** Number of negotiation iterations */
  iterations: number;
  
  /** Timestamp of contract agreement */
  agreedAt: Date;
}

export interface GeneratorProposal {
  /** What the generator intends to accomplish */
  objective: string;
  
  /** Tools that will be used */
  tools: string[];
  
  /** Expected outputs */
  expectedOutputs: string[];
  
  /** How success will be verified */
  verificationMethod: string;
  
  /** Estimated duration in minutes */
  estimatedDurationMin: number;
}

export interface ContractCriterion {
  /** Criterion name (e.g., "subdomains", "open_ports") */
  name: string;
  
  /** Success threshold (e.g., ">=5", "all discovered", ">=80%") */
  threshold: string;
  
  /** Importance weight (0-1) */
  weight: number;
  
  /** Whether this can be automatically verified */
  verifiable: boolean;
  
  /** Evidence type required (screenshot, log, json, etc.) */
  evidenceType?: string;
}

export interface ContractEvaluation {
  /** The contract being evaluated */
  contract: PhaseContract;
  
  /** Actual outputs from the generator */
  actualOutputs: Record<string, any>;
  
  /** Evaluation results per criterion */
  criterionResults: CriterionResult[];
  
  /** Overall score (0-100) */
  overallScore: number;
  
  /** Whether the phase passed */
  passed: boolean;
  
  /** Recommended next action */
  recommendedAction: 'PROCEED' | 'REFINE' | 'RETRY' | 'ESCALATE';
}

export interface CriterionResult {
  /** Criterion being evaluated */
  criterion: string;
  
  /** Score achieved (0-100) */
  score: number;
  
  /** Whether criterion passed */
  passed: boolean;
  
  /** Evidence found */
  evidence: string;
  
  /** Suggested improvement if failed */
  improvement?: string;
}

/**
 * Contract negotiation states
 */
export enum ContractState {
  /** Generator is drafting proposal */
  DRAFTING = 'drafting',
  
  /** Evaluator is reviewing proposal */
  REVIEWING = 'reviewing',
  
  /** Negotiation in progress (counter-proposals) */
  NEGOTIATING = 'negotiating',
  
  /** Contract agreed and active */
  ACTIVE = 'active',
  
  /** Contract fulfilled (phase complete) */
  FULFILLED = 'fulfilled',
  
  /** Contract failed (phase needs retry) */
  FAILED = 'failed',
  
  /** Escalated to human */
  ESCALATED = 'escalated',
}

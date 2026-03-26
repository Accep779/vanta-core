/**
 * QualityEvaluator - Grades engagement output quality per phase
 * 
 * Separates evaluation from execution (GAN-inspired pattern)
 * Uses concrete criteria to turn subjective judgments into gradable scores
 */

export interface EvaluationResult {
  phase: string;
  overallScore: number; // 0-100
  passed: boolean;
  criteriaResults: CriterionResult[];
  feedback: string;
  recommendedAction: 'PROCEED' | 'REFINE' | 'RETRY' | 'ESCALATE';
}

export interface CriterionResult {
  criterion: string;
  score: number; // 0-100
  passed: boolean;
  evidence: string;
  improvement: string;
}

export interface PhaseContract {
  phase: string;
  agreedCriteria: ContractCriterion[];
  generatorProposal: string;
  evaluatorApproval: boolean;
  iterations: number;
}

export interface ContractCriterion {
  name: string;
  threshold: string;
  weight: number; // 0-1 importance
  verifiable: boolean;
}

export class QualityEvaluator {
  private gradingCriteria = {
    // Adapted from Anthropic's frontend design criteria
    completeness: {
      description: 'Did we find all assets/endpoints or just surface-level?',
      weight: 0.3,
    },
    accuracy: {
      description: 'Are findings backed by evidence or just assertions?',
      weight: 0.25,
    },
    coverage: {
      description: 'Did we test all discovered assets or skip some?',
      weight: 0.25,
    },
    evidenceQuality: {
      description: 'Are findings backed by screenshots/logs?',
      weight: 0.2,
    },
  };

  async evaluate(
    phase: string,
    output: any,
    contract: PhaseContract
  ): Promise<EvaluationResult> {
    const criteriaResults: CriterionResult[] = [];
    
    // Evaluate each contract criterion
    for (const criterion of contract.agreedCriteria) {
      const result = await this.evaluateCriterion(criterion, output);
      criteriaResults.push(result);
    }
    
    // Calculate overall score
    const overallScore = this.calculateOverallScore(criteriaResults);
    
    // Determine pass/fail
    const passed = overallScore >= 70; // Configurable threshold
    
    // Generate feedback
    const feedback = this.generateFeedback(criteriaResults);
    
    // Recommend action
    const recommendedAction = this.recommendAction(overallScore, criteriaResults);
    
    return {
      phase,
      overallScore,
      passed,
      criteriaResults,
      feedback,
      recommendedAction,
    };
  }

  async negotiateContract(
    phase: string,
    generatorProposal: string
  ): Promise<PhaseContract> {
    // TODO: Implement negotiation loop between generator and evaluator
    // For now, return baseline contract
    return {
      phase,
      agreedCriteria: this.getDefaultCriteria(phase),
      generatorProposal,
      evaluatorApproval: true,
      iterations: 1,
    };
  }

  private async evaluateCriterion(
    criterion: ContractCriterion,
    output: any
  ): Promise<CriterionResult> {
    // TODO: Implement actual evaluation logic
    // This should parse output and verify against threshold
    
    // Placeholder implementation
    const score = Math.random() * 40 + 60; // 60-100 for demo
    const passed = score >= 70;
    
    return {
      criterion: criterion.name,
      score,
      passed,
      evidence: `Found ${output.count || 0} items`,
      improvement: passed ? '' : 'Need deeper enumeration',
    };
  }

  private calculateOverallScore(criteriaResults: CriterionResult[]): number {
    if (criteriaResults.length === 0) return 0;
    
    const totalWeight = criteriaResults.reduce((sum, r) => sum + 1, 0);
    const weightedSum = criteriaResults.reduce((sum, r) => sum + r.score, 0);
    
    return Math.round(weightedSum / totalWeight);
  }

  private generateFeedback(criteriaResults: CriterionResult[]): string {
    const failures = criteriaResults.filter(r => !r.passed);
    
    if (failures.length === 0) {
      return 'All criteria met. Strong execution.';
    }
    
    const issues = failures.map(f => 
      `${f.criterion}: ${f.improvement}`
    ).join('; ');
    
    return `Areas for improvement: ${issues}`;
  }

  private recommendAction(
    overallScore: number,
    criteriaResults: CriterionResult[]
  ): 'PROCEED' | 'REFINE' | 'RETRY' | 'ESCALATE' {
    if (overallScore >= 85) return 'PROCEED';
    if (overallScore >= 70) return 'REFINE';
    if (overallScore >= 50) return 'RETRY';
    return 'ESCALATE';
  }

  private getDefaultCriteria(phase: string): ContractCriterion[] {
    const criteriaMap: Record<string, ContractCriterion[]> = {
      'RECON': [
        { name: 'subdomains', threshold: '>=5', weight: 0.4, verifiable: true },
        { name: 'live_hosts', threshold: '>=3', weight: 0.3, verifiable: true },
        { name: 'tech_stack', threshold: '>=2 services', weight: 0.3, verifiable: true },
      ],
      'SCAN': [
        { name: 'open_ports', threshold: 'all discovered', weight: 0.5, verifiable: true },
        { name: 'service_versions', threshold: '>=80%', weight: 0.5, verifiable: true },
      ],
      'ENUMERATE': [
        { name: 'endpoints', threshold: '>=10', weight: 0.4, verifiable: true },
        { name: 'vulnerabilities', threshold: 'all CVEs', weight: 0.4, verifiable: true },
        { name: 'evidence', threshold: 'screenshots for all', weight: 0.2, verifiable: true },
      ],
    };
    
    return criteriaMap[phase] || [];
  }
}

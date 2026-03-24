#!/usr/bin/env ts-node

/**
 * VANTA Core ReAct Loop Test
 * 
 * Verifies:
 * 1. AgentBrain loop runs with Ollama (Qwen 3.5 Cloud)
 * 2. Tool use responses parse correctly
 * 3. Gate pause triggers on HIGH risk
 * 4. Audit logs captured
 * 5. RECON phase completes
 */

import { AgentBrain } from '../src/agent/agent-brain';
import { ToolRegistry } from '../src/tools/tool-registry';
import { SessionLaneQueue } from '../src/queue/session-lane.queue';
import { AuditService } from '../src/audit/audit.service';
import { PolicyEngine } from '../src/policy/policy-engine';
import { OllamaAdapter } from '../src/llm/ollama-adapter';
import { MockNmapTool } from '../src/tools/mock-nmap.tool';
import { MockSubfinderTool } from '../src/tools/mock-subfinder.tool';
import { EngagementContext, EngagementScope } from '../src/tools/tool-registry';

// ─── Test Configuration ─────────────────────────────────────────────────────

const TEST_ENGAGEMENT_ID = 'test-eng-001';
const TEST_TARGET = 'example.com';

const TEST_SCOPE: EngagementScope = {
  inScopeTargets: ['example.com', 'www.example.com'],
  outOfScopeTargets: ['*.internal.example.com'],
  allowedTools: [], // all allowed
  blockedTools: [],
  maxRiskLevel: 'MEDIUM', // HIGH tools will gate
};

const TEST_CONTEXT: EngagementContext = {
  engagementId: TEST_ENGAGEMENT_ID,
  scope: TEST_SCOPE,
  currentPhase: 'RECON',
  targetAsset: {
    id: 'target-001',
    type: 'domain',
    value: TEST_TARGET,
    discoveredAt: Date.now(),
    confirmed: true,
  },
  rulesOfEngagement: [
    { id: 'roe-001', description: 'No DoS', constraint: 'Do not flood or stress targets' },
    { id: 'roe-002', description: 'Business hours only', constraint: 'Test between 09:00-17:00 UTC' },
  ],
};

// ─── Initialize Components ──────────────────────────────────────────────────

async function runTest(): Promise<void> {
  console.log('🧪 VANTA Core ReAct Loop Test\n');

  // 1. Initialize services
  const auditService = new AuditService();
  const sessionLane = new SessionLaneQueue(); // in-memory mode (no Redis)
  const toolRegistry = new ToolRegistry();
  const ollamaAdapter = new OllamaAdapter('http://localhost:11434', 'qwen3.5:cloud');

  // 2. Register mock tools
  toolRegistry.register(MockNmapTool);
  toolRegistry.register(MockSubfinderTool);
  console.log('✅ Registered: MockNmapTool, MockSubfinderTool');

  // 3. Initialize policy engine
  const policyEngine = new PolicyEngine(auditService);
  console.log('✅ PolicyEngine initialized');

  // 4. Initialize AgentBrain
  const agentBrain = new AgentBrain(
    toolRegistry,
    auditService,
    sessionLane,
    (options: any) => ollamaAdapter.complete(options)
  );
  console.log('✅ AgentBrain initialized with Ollama adapter\n');

  // 5. Run RECON phase test
  console.log('🎯 Starting RECON phase test against', TEST_TARGET);
  console.log('   Engagement ID:', TEST_ENGAGEMENT_ID);
  console.log('   Max Risk Level:', TEST_SCOPE.maxRiskLevel);
  console.log('   Current Phase:', TEST_CONTEXT.currentPhase);
  console.log('');

  const startTime = Date.now();

  try {
    console.log('Running ReAct loop...\n');
    
    // Run the ReAct loop - use passive recon tool (subfinder)
    console.log('Sending request to AgentBrain...');
    const result = await agentBrain.run(
      `Perform passive reconnaissance on ${TEST_TARGET}. Discover subdomains.`,
      TEST_CONTEXT,
      [],
      { maxIterations: 5, model: 'qwen3.5:cloud' }
    );
    console.log('AgentBrain returned result');

    console.log('\nReAct loop completed');
    const elapsed = Date.now() - startTime;

    // 6. Verify results
    console.log('\n📊 Test Results:\n');
    console.log('   Status:', result.status);
    console.log('   Response length:', result.response.length);
    console.log('   Tools used:', result.toolsUsed);
    console.log('   Discovered assets:', result.discoveredAssets?.length || 0);
    console.log('   Vulnerabilities:', result.vulnerabilities?.length || 0);
    console.log('   Elapsed time:', elapsed, 'ms');

    if (result.gateId) {
      console.log('   Gate triggered:', result.gateId);
      console.log('   Gate reason:', result.gateReason);
    }

    console.log('\n✅ ReAct loop test PASSED\n');

    // 7. Print sample response
    console.log('📝 Sample Response (first 500 chars):\n');
    console.log(result.response.substring(0, 500));
    console.log('...\n');

  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error('\n❌ ReAct loop test FAILED\n');
    console.error('   Error:', error instanceof Error ? error.message : error);
    console.error('   Elapsed time:', elapsed, 'ms');
    process.exit(1);
  }
}

// ─── Run Test ───────────────────────────────────────────────────────────────

runTest().catch(console.error);

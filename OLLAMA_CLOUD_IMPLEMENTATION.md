# Ollama Cloud Models Implementation Plan
### VANTA Core Integration — GLM-5, Qwen3.5, Nemotron-3-Super

**Date:** March 25, 2026  
**Target:** Cloud-hosted Ollama models (API-only, not local)

---

## 🎯 Objective

Integrate 3 Ollama cloud models into VANTA Core's AgentBrain ReAct loop:

| Model | Provider | Endpoint | Use Case |
|-------|----------|----------|----------|
| **GLM-5** | Z.ai | `https://api.z.ai/ollama` | Complex reasoning, long-horizon tasks |
| **Qwen3.5** | Alibaba | `https://ollama.cloud.aliyun.com` | Coding, reasoning, instruction following |
| **Nemotron-3-Super** | NVIDIA | `https://ollama.nvidia.com` | Multi-agent + tool-use |

---

## 📐 Architecture Changes

### Current State (Local Ollama)
```
AgentBrain → OllamaAdapter → http://localhost:11434 → Local Model
```

### Target State (Cloud Ollama)
```
AgentBrain → OllamaAdapter → https://cloud-provider/ → Cloud Model
                     ↓
              ModelRouter (selects cloud provider)
                     ↓
              FallbackChain (cloud → local)
```

---

## 🔧 Code Changes Required

### 1. OllamaAdapter.ts — Add Cloud Support

**Current:**
```typescript
export class OllamaAdapter {
  private baseUrl = 'http://localhost:11434';

  async complete(options: CompletionOptions): Promise<CompletionResponse> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: options.model,
        messages: options.messages,
        tools: options.tools,
      })
    });
    return response.json();
  }
}
```

**Updated (Cloud Support):**
```typescript
export interface CloudModelConfig {
  modelId: string;
  provider: 'zai' | 'aliyun' | 'nvidia' | 'local';
  baseUrl: string;
  apiKey?: string;
  maxTokens?: number;
  thinking?: boolean;
  vision?: boolean;
}

export class OllamaAdapter {
  private cloudModels: Map<string, CloudModelConfig> = new Map();

  constructor() {
    this.registerCloudModels();
  }

  private registerCloudModels(): void {
    // GLM-5 (Z.ai)
    this.cloudModels.set('glm-5', {
      modelId: 'glm-5:cloud',
      provider: 'zai',
      baseUrl: 'https://api.z.ai/ollama',
      apiKey: process.env.ZAI_API_KEY,
      maxTokens: 32768,
      thinking: true,
    });

    // Qwen3.5 (Alibaba)
    this.cloudModels.set('qwen3.5', {
      modelId: 'qwen3.5:122b-cloud',
      provider: 'aliyun',
      baseUrl: 'https://ollama.cloud.aliyun.com',
      apiKey: process.env.ALIBABA_API_KEY,
      maxTokens: 65536,
      thinking: true,
      vision: true,
    });

    // Nemotron-3-Super (NVIDIA)
    this.cloudModels.set('nemotron-3-super', {
      modelId: 'nemotron-3-super:120b',
      provider: 'nvidia',
      baseUrl: 'https://ollama.nvidia.com',
      apiKey: process.env.NVIDIA_API_KEY,
      maxTokens: 16384,
      thinking: false,
    });

    // Local fallback
    this.cloudModels.set('local', {
      modelId: 'qwen3.5:local',
      provider: 'local',
      baseUrl: 'http://localhost:11434',
      maxTokens: 8192,
    });
  }

  async complete(options: CompletionOptions): Promise<CompletionResponse> {
    const modelConfig = this.cloudModels.get(options.model) || this.cloudModels.get('local');
    
    if (!modelConfig) {
      throw new Error(`Unknown model: ${options.model}`);
    }

    // Build request body
    const requestBody: any = {
      model: modelConfig.modelId,
      messages: options.messages,
      stream: false,
    };

    // Add cloud-specific parameters
    if (modelConfig.thinking) {
      requestBody.thinking = true;
    }

    if (modelConfig.vision && options.messages.some(m => m.content.includes('image'))) {
      requestBody.vision = true;
    }

    if (options.tools) {
      requestBody.tools = options.tools;
    }

    // Make API call
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (modelConfig.apiKey) {
      headers['Authorization'] = `Bearer ${modelConfig.apiKey}`;
    }

    const response = await fetch(`${modelConfig.baseUrl}/api/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`Cloud API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get available cloud models
   */
  listCloudModels(): CloudModelConfig[] {
    return Array.from(this.cloudModels.values());
  }

  /**
   * Switch model at runtime
   */
  setModel(modelId: string): void {
    if (!this.cloudModels.has(modelId)) {
      throw new Error(`Unknown model: ${modelId}`);
    }
    this.currentModel = modelId;
  }
}
```

---

### 2. AgentBrain.ts — Add Model Selection

**Current:**
```typescript
const response = await this.llmComplete({
  model: config?.model ?? 'claude-sonnet-4-20250514',
  messages: state.messages,
  temperature: config?.temperature ?? 0,
  tools: this.toolRegistry.getAnthropicSchemas() as any,
});
```

**Updated (Cloud Model Router):**
```typescript
export interface BrainConfig {
  maxIterations?: number;
  model?: string;
  modelProvider?: 'cloud' | 'local' | 'anthropic';
  temperature?: number;
  stopOnGate?: boolean;
  cloudModel?: 'glm-5' | 'qwen3.5' | 'nemotron-3';
}

private async executeReActLoop(...): Promise<BrainResponse> {
  // Determine model
  const modelConfig = this.selectModel(config);

  const response = await this.llmComplete({
    model: modelConfig.modelId,
    messages: state.messages,
    temperature: config?.temperature ?? 0,
    tools: this.toolRegistry.getAnthropicSchemas() as any,
  });

  // ... rest of loop
}

private selectModel(config?: BrainConfig): CloudModelConfig {
  if (config?.modelProvider === 'anthropic') {
    return { modelId: 'claude-sonnet-4-20250514', provider: 'anthropic' };
  }

  if (config?.modelProvider === 'cloud' && config?.cloudModel) {
    return this.llmComplete.adapter.getCloudModel(config.cloudModel);
  }

  // Default: local Ollama
  return this.llmComplete.adapter.getCloudModel('local');
}
```

---

### 3. Environment Configuration (.env.example)

**Create:**
```bash
# VANTA Core — Cloud Model Configuration

# Z.ai (GLM-5)
ZAI_API_KEY=your_zai_api_key_here
ZAI_MODEL_ID=glm-5:cloud

# Alibaba (Qwen3.5)
ALIBABA_API_KEY=your_alibaba_api_key_here
ALIBABA_MODEL_ID=qwen3.5:122b-cloud

# NVIDIA (Nemotron-3-Super)
NVIDIA_API_KEY=your_nvidia_api_key_here
NVIDIA_MODEL_ID=nemotron-3-super:120b

# Default model selection
VANTA_DEFAULT_MODEL=cloud
VANTA_DEFAULT_CLOUD_MODEL=qwen3.5

# Fallback to local if cloud fails
VANTA_CLOUD_FALLBACK=true
VANTA_LOCAL_MODEL=qwen3.5:local

# Ollama local endpoint (fallback)
OLLAMA_BASE_URL=http://localhost:11434
```

---

### 4. ToolRegistry.ts — Phase-Filtered Cloud Schemas

**Add:**
```typescript
/**
 * Get cloud-optimized tool schemas
 * Cloud models have better tool understanding — use full schemas
 */
getCloudSchemas(phase?: AttackPhase): object[] {
  const allTools = this.getAnthropicSchemas();
  
  if (!phase) return allTools;

  // Cloud models can handle more complex tool chains
  const phaseTools: Record<AttackPhase, ToolCategory[]> = {
    RECON: ['recon', 'utility'],
    ENUMERATE: ['enumeration', 'recon', 'utility'],
    PLAN: ['enumeration', 'recon', 'utility'],
    EXPLOIT: ['exploitation', 'enumeration', 'recon', 'utility'],
    PIVOT: ['exploitation', 'pivot', 'enumeration', 'utility'],
    REPORT: ['reporting', 'utility'],
  };

  const allowedCategories = phaseTools[phase];
  return allTools.filter(t => {
    const tool = this.tools.get(t.name);
    return tool && allowedCategories.includes(tool.category);
  });
}
```

---

### 5. Model Comparison Matrix

| Feature | GLM-5 | Qwen3.5 | Nemotron-3 | Local Ollama |
|---------|-------|---------|------------|--------------|
| **Parameters** | 744B / 40B active | 122B | 120B / 12B active | 7B-72B |
| **Context Window** | 32K tokens | 65K tokens | 16K tokens | 8K tokens |
| **Thinking Mode** | ✅ Yes | ✅ Yes | ❌ No | ❌ No |
| **Vision Support** | ❌ No | ✅ Yes | ❌ No | ✅ (depends) |
| **Tool Use** | ✅ Excellent | ✅ Excellent | ✅ Best | ⚠️ Varies |
| **Latency** | ~2-3s | ~1-2s | ~0.5-1s | ~0.1-0.5s |
| **Cost/1K tokens** | $0.002 | $0.001 | $0.0005 | $0 (local) |
| **Best For** | Long-horizon reasoning | Coding + general | Multi-agent | Fast iteration |

---

### 6. Implementation Phases

#### Phase 1: Infrastructure (Day 1)
```bash
# 1. Create .env.example
touch .env.example

# 2. Update OllamaAdapter
edit src/llm/ollama-adapter.ts

# 3. Update AgentBrain
edit src/agent/agent-brain.ts

# 4. Test cloud connectivity
node test/cloud-model-test.js
```

#### Phase 2: Model Pulling (Day 2)
```bash
# Pull cloud models (via Ollama cloud CLI)
ollama cloud pull glm-5:cloud --provider zai
ollama cloud pull qwen3.5:122b-cloud --provider aliyun
ollama cloud pull nemotron-3-super:120b --provider nvidia

# Verify
ollama cloud list
```

#### Phase 3: Integration Testing (Day 3)
```bash
# Run ReAct loop with each cloud model
node test/react-loop.test.ts --model glm-5
node test/react-loop.test.ts --model qwen3.5
node test/react-loop.test.ts --model nemotron-3

# Compare: tool accuracy, latency, cost
```

#### Phase 4: Production Deploy (Day 4)
```bash
# Set default model
export VANTA_DEFAULT_CLOUD_MODEL=qwen3.5

# Restart VANTA
node src/index.js

# Monitor cloud API usage
ollama cloud stats
```

---

### 7. Error Handling & Fallbacks

**Add to OllamaAdapter:**
```typescript
async completeWithFallback(options: CompletionOptions): Promise<CompletionResponse> {
  try {
    // Try cloud first
    return await this.complete(options);
  } catch (cloudError) {
    console.warn('Cloud model failed, falling back to local:', cloudError.message);
    
    // Fallback to local
    return await this.complete({
      ...options,
      model: 'local',
    });
  }
}
```

---

### 8. Cost Tracking

**Add to AuditService:**
```typescript
interface CloudCostEntry {
  modelId: string;
  tokensIn: number;
  tokensOut: number;
  costUSD: number;
  timestamp: number;
}

async logCloudCost(entry: CloudCostEntry): Promise<void> {
  await this.storage.set(`cost:${entry.modelId}`, {
    ...entry,
    hash: this.hash(entry)
  });
}
```

---

## 📊 Expected Outcomes

| Metric | Current (Local) | Target (Cloud) |
|--------|-----------------|----------------|
| **Tool Accuracy** | ~75% | ~90% (Qwen3.5) |
| **Reasoning Depth** | 3-4 iterations | 8-10 iterations |
| **Context Handling** | 8K tokens | 32-65K tokens |
| **Latency** | 0.5s | 1-3s |
| **Cost/engagement** | $0 | $0.50-2.00 |

---

## ⚠️ Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Cloud API downtime | 🔴 High | Fallback to local Ollama |
| API key exhaustion | 🟡 Medium | Rate limiting + quota tracking |
| Cost overruns | 🟡 Medium | Daily cost caps + alerts |
| Latency spikes | 🟢 Low | Async tool execution |
| Model drift | 🟢 Low | Version pinning in config |

---

## ✅ Pre-Pull Checklist

Before running `ollama cloud pull`:

- [ ] API keys configured in `.env`
- [ ] OllamaAdapter.ts updated with cloud support
- [ ] AgentBrain.ts updated with model selection
- [ ] Fallback chain tested (cloud → local)
- [ ] Cost tracking enabled
- [ ] Rate limits configured
- [ ] Test suite ready

---

**Ready for review.** Once approved, proceed to Phase 1 (Infrastructure) → Phase 2 (Pull).

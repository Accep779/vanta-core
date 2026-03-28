# VANTA Core 🛡️

**Autonomous Threat Simulation Engine**

> Extracted from Cephly OS — March 2026

VANTA Core is an AI-powered security engagement engine that simulates penetration testing workflows using autonomous agents. It orchestrates multi-phase security assessments (reconnaissance → scanning → enumeration → exploit simulation) with built-in policy gating, audit trails, and quality evaluation.

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Ollama running locally (`ollama serve`)
- Neon PostgreSQL database (or local PostgreSQL)

### Installation

```bash
# Clone repository
git clone https://github.com/nodevs/vanta-core.git
cd vanta-core

# Install dependencies
npm install

# Initialize database
node scripts/init-db.js

# Start orchestrator
node src/orchestrator.ts
```

### Test Run

```bash
# Run reconnaissance on example.com
node -e "
const { VANTA } = require('./src/vanta');
const vanta = new VANTA({
  target: 'example.com',
  engagementId: 'test_' + Date.now(),
  maxRiskLevel: 'LOW',
  tools: ['subfinder'],
  model: 'qwen3.5:cloud',
});
vanta.execute().then(console.log);
"
```

---

## 🏗️ Architecture

### Core Components

| Component | File | Responsibility |
|-----------|------|----------------|
| **AgentBrain** | `src/agent/agent-brain.ts` | ReAct loop, tool execution, phase transitions |
| **PolicyEngine** | `src/policy/policy-engine.ts` | Risk evaluation, action gating |
| **ToolRegistry** | `src/tools/tool-registry.ts` | Tool registration, execution, Docker fallbacks |
| **SessionLaneQueue** | `src/queue/session-lane.queue.ts` | Phase isolation, task queue management |
| **AuditService** | `src/audit/audit.service.ts` | Audit trail, compliance logging |

### ReAct Loop Flow

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Planner    │────▶│  AgentBrain  │────▶│  Evaluator  │
│  (Recon)    │     │  (Executor)  │     │  (Quality)  │
└─────────────┘     └──────┬───────┘     └─────────────┘
                           │
                           ▼
                  ┌────────────────┐
                  │ ToolRegistry   │
                  │ - Subfinder    │
                  │ - Nmap         │
                  │ - Nuclei       │
                  │ - HTTPx        │
                  └────────┬───────┘
                           │
                           ▼
                  ┌────────────────┐
                  │ PolicyEngine   │
                  │ (Risk Gating)  │
                  └────────────────┘
```

---

## 📋 Engagement Phases

| Phase | Tools | Risk Level | Description |
|-------|-------|------------|-------------|
| **RECON** | Subfinder, HTTPx | LOW | Passive reconnaissance, subdomain discovery |
| **ENUMERATE** | Nmap, HTTPx | LOW-MEDIUM | Port scanning, service detection |
| **PLAN** | Claude Code | LOW | Vulnerability analysis, exploit planning |
| **EXPLOIT-SIM** | Nuclei, Custom | HIGH (gated) | Simulated exploitation (requires approval) |

---

## 🔧 Available Tools

| Tool | File | Risk | Description |
|------|------|------|-------------|
| `subfinder` | `src/tools/subfinder.tool.ts` | LOW | Subdomain enumeration |
| `httpx` | `src/tools/httpx.tool.ts` | LOW | Web technology detection |
| `nmap` | `src/tools/nmap.tool.ts` | MEDIUM | Port scanning (Docker fallback) |
| `nuclei` | `src/tools/nuclei.tool.ts` | MEDIUM | Vulnerability scanning |
| `claude-code` | `src/tools/claude-code.tool.ts` | LOW | Code analysis, planning |

---

## 📊 API Endpoints

### Orchestrator API (Port 39995)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/status` | GET | System health check |
| `/api/backlogs` | GET | All agent backlogs |
| `/api/engagements` | GET/POST | List/create engagements |
| `/api/engagements/:id` | GET | Engagement details |
| `/api/engagements/:id/approve` | POST | Approve high-risk action |
| `/api/findings` | GET | List vulnerabilities |
| `/api/audit` | GET | Audit log |

### Example: Create Engagement

```bash
curl -X POST http://localhost:39995/api/engagements \
  -H "Content-Type: application/json" \
  -d '{
    "target": "acme-corp.com",
    "tier": "SMB",
    "scope": {
      "inScopeTargets": ["acme-corp.com"],
      "maxRiskLevel": "LOW"
    }
  }'
```

---

## 🗄️ Database Schema

VANTA Core uses Neon PostgreSQL with 14 tables:

- `engagements` — Security assessments
- `findings` — Vulnerabilities/issues
- `phase_contracts` — Negotiated "done" criteria
- `audit_log` — Action audit trail
- `leads`, `campaigns`, `outreach_messages` — LeadFlow CRM
- Plus: agents, tasks, approvals, content_calendar, etc.

See `infra/neon-schema.sql` for full schema.

---

## 🎯 Pricing Tiers

| Tier | Price | Target | Scope |
|------|-------|--------|-------|
| **SMB** | $20k | 500-5,000 employees | External recon + vuln scan |
| **Enterprise** | $60k | 5,000-50,000 employees | Full pentest simulation |
| **Intelligence** | $500k | Government/Finance | Advanced threat simulation |
| **Nation-State** | $2M+ | Critical infrastructure | Red team exercises |

See `VANTA_ENTERPRISE_DESIGN_DOC.md` for detailed specs.

---

## 📁 Project Structure

```
vanta-core/
├── src/
│   ├── vanta.ts              # Main entry point
│   ├── orchestrator.ts        # Agent coordination
│   ├── agent/
│   │   └── agent-brain.ts     # ReAct loop
│   ├── tools/
│   │   ├── tool-registry.ts
│   │   ├── subfinder.tool.ts
│   │   ├── nmap.tool.ts
│   │   └── ...
│   ├── policy/
│   │   └── policy-engine.ts   # Risk gating
│   ├── queue/
│   │   └── session-lane.queue.ts
│   ├── audit/
│   │   └── audit.service.ts
│   └── api/
│       └── index.ts           # API endpoints
├── infra/
│   └── neon-schema.sql        # Database schema
├── scripts/
│   ├── init-db.js
│   ├── lead-generator.js
│   ├── send-campaign.js
│   └── ...
├── test/
│   └── *.test.ts              # Integration tests
├── README.md
├── PRODUCT_DEFINITION.md
├── ORCHESTRATOR_DESIGN_DOC.md
├── VANTA_ENTERPRISE_DESIGN_DOC.md
└── vanta_opsec.md
```

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific test
npx jest test/react-loop.test.ts

# Test Ollama integration
npx jest test/e2e-ollama.test.ts
```

---

## 🔐 Security & OpSec

VANTA Core is designed for security engagement simulation. Key principles:

- **Policy gating:** High-risk actions require human approval
- **Audit trail:** Every action logged for compliance
- **Phase isolation:** Recon tools cannot run exploit code
- **Docker fallback:** Dangerous tools (nmap) run in isolated containers

See `vanta_opsec.md` for complete OpSec plan (evasion, cleanup, encryption, infrastructure).

---

## 📈 Status

- **Extraction:** ✅ 100% complete (5/5 components)
- **Entry Point:** ✅ Integrated (`src/vanta.ts`)
- **API Layer:** ✅ Complete
- **Database:** ✅ Schema defined (14 tables)
- **Tests:** ✅ ReAct loop tested (5 subdomains discovered on example.com)
- **Documentation:** ✅ Design docs, API specs, user journeys

---

## 🤝 Contributing

1. Fork repository
2. Create feature branch (`git checkout -b feat/my-feature`)
3. Commit changes (`git commit -m 'feat: add my feature'`)
4. Push to branch (`git push origin feat/my-feature`)
5. Open Pull Request

---

## 📄 License

MIT License — see LICENSE file

---

## 📞 Contact

- **Product:** Zaif (Telegram)
- **Engineering:** Nodevs (AI Agent)
- **Twitter:** [@No_devs](https://twitter.com/No_devs)

---

**Built with** ❤️ **by Nodevs — Autonomous AI Agent**

*VANTA Core v1.0.0 — March 28, 2026*

# VANTA Core — Enterprise Design Document

**Version:** 1.0  
**Date:** March 26, 2026  
**Classification:** CONFIDENTIAL  
**Audience:** Engineering, Product, Security, Enterprise Sales

---

## 1. Executive Summary

### 1.1 Product Vision

**VANTA Core** is an autonomous security engagement engine that simulates penetration testing workflows using AI agents. It delivers enterprise-grade security assessments without human intervention, from reconnaissance through exploit simulation.

### 1.2 Value Proposition

| Customer Segment | Pain Point | VANTA Solution |
|-----------------|------------|----------------|
| **MSSPs** | Manual pentests are slow, expensive, inconsistent | Automated engagements, 10x throughput, standardized quality |
| **Enterprises (500-5000 employees)** | Continuous security validation is impossible manually | 24/7 autonomous assessments, always-on security posture |
| **Security Consultancies** | Scaling requires hiring expensive pentesters | AI agents handle recon/scanning, humans focus on high-value findings |
| **Compliance Teams** | Audit evidence is fragmented, manual | Full audit trail, SOC2/ISO27001-ready reports |

### 1.3 Market Opportunity

| Metric | Value |
|--------|-------|
| Global Pentest Market (2026) | $4.2B |
| CAGR (2026-2030) | 18.3% |
| Addressable Market (SMB + Enterprise) | $1.8B |
| Target (Year 1) | $2.4M ARR (100 enterprise customers) |

### 1.4 Competitive Landscape

| Competitor | Type | Weakness | VANTA Advantage |
|------------|------|----------|-----------------|
| **Cobalt.io** | Crowdsourced pentest | Human-dependent, slow | Autonomous, 24/7, faster |
| **Synack** | Crowdsourced + AI | Human-in-the-loop | Fully autonomous option |
| **Vanta (compliance)** | Compliance automation | Not pentesting | We do actual security testing |
| **Burp Suite** | Tool (manual) | Requires expert operator | Autonomous operation |
| **Nessus** | Scanner | Point solution, no orchestration | Full engagement lifecycle |

---

## 2. Product Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         VANTA CORE ENTERPRISE                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    PRESENTATION LAYER                            │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │    │
│  │  │   Web App    │  │  API (REST)  │  │   Webhooks   │           │    │
│  │  │  (React)     │  │  (Express)   │  │  (Events)    │           │    │
│  │  │  Port: 39997 │  │  Port: 39996 │  │              │           │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘           │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                      APPLICATION LAYER                           │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │    │
│  │  │  VANTA       │  │   Agent      │  │   Policy     │           │    │
│  │  │  Orchestrator│  │   Brain      │  │   Engine     │           │    │
│  │  │              │  │  (ReAct)     │  │  (Risk Gate) │           │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘           │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │    │
│  │  │   Planner    │  │  Evaluator   │  │   Session    │           │    │
│  │  │  (Recon)     │  │  (Quality)   │ │    Lane      │           │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘           │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                       TOOL LAYER                                 │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │    │
│  │  │Subfinder │ │   Nmap   │ │  Nuclei  │ │  HTTPx   │           │    │
│  │  │ (Recon)  │ │  (Scan)  │ │ (Vuln)   │ │ (Enum)   │           │    │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │    │
│  │  │ClaudeCode│ │  Whois   │ │  DNS     │ │  SSL     │           │    │
│  │  │ (Analysis)│ │ (Recon)  │ │ (Recon)  │ │ (Recon)  │           │    │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                       DATA LAYER                                 │    │
│  │  ┌──────────────────────────────────────────────────────────┐   │    │
│  │  │              Neon PostgreSQL (Serverless)                 │   │    │
│  │  │  - engagements, findings, recon_results, audit_log        │   │    │
│  │  │  - phase_contracts, reports, customers, subscriptions     │   │    │
│  │  └──────────────────────────────────────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Component Specifications

| Component | Technology | Responsibility |
|-----------|------------|----------------|
| **Web App** | React + TypeScript | Dashboard, engagement management, reports |
| **API Server** | Express.js + TypeScript | REST API, authentication, rate limiting |
| **VANTA Orchestrator** | Node.js + TypeScript | Main engagement loop, agent coordination |
| **AgentBrain** | Node.js + Ollama | ReAct loop, tool execution, reasoning |
| **PolicyEngine** | Node.js | Risk evaluation, approval gating |
| **Planner** | Node.js + Ollama | Engagement planning, scope expansion |
| **Evaluator** | Node.js + Ollama | Output quality grading |
| **ToolRegistry** | Node.js | Tool registration, execution, Docker fallback |
| **Database** | Neon PostgreSQL | Persistent storage, audit trail |

---

## 3. Pricing & Tiers

### 3.1 Pricing Strategy

**Value-Based Pricing** — 16% of delivered value (based on security team cost savings)

| Tier | Target | Price | Delivered Value |
|------|--------|-------|-----------------|
| **SMB** | 50-500 employees | $20,000/year | $125,000 savings (1 FTE pentester) |
| **Enterprise** | 500-5,000 employees | $60,000/year | $375,000 savings (3 FTE pentesters) |
| **Intelligence** | 5,000-20,000 employees | $500,000/year | $3M+ savings (continuous + threat sim) |
| **Nation-State** | 20,000+ employees / Gov | $2M+/year | Custom (APT simulation, red team) |

### 3.2 Tier Features

| Feature | SMB | Enterprise | Intelligence | Nation-State |
|---------|-----|------------|--------------|--------------|
| Engagements/Month | 2 | 8 | Unlimited | Unlimited |
| Concurrent Engagements | 1 | 3 | 10 | 50+ |
| Report Customization | Basic | Branded | White-label | Custom |
| API Access | Read-only | Full | Full + Webhooks | Full + Priority |
| SLA | 99% | 99.5% | 99.9% | 99.99% |
| Support | Email | Email + Chat | Priority | Dedicated |
| Audit Trail | 90 days | 1 year | 7 years | Unlimited |
| Custom Tools | ❌ | ❌ | ✅ | ✅ |
| APT Simulation | ❌ | ❌ | ✅ | ✅ |
| On-Prem Deploy | ❌ | ❌ | ✅ | ✅ |

---

## 4. API Specification

### 4.1 Authentication

**Method:** JWT Bearer Tokens  
**Endpoint:** `POST /api/auth/login`

```json
// Request
{
  "email": "admin@acme-corp.com",
  "password": "********"
}

// Response
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 3600,
  "user": {
    "id": "uuid",
    "email": "admin@acme-corp.com",
    "role": "admin",
    "organization": "acme-corp"
  }
}
```

### 4.2 Core Endpoints

#### Engagements

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/engagements` | Create engagement | JWT |
| `GET` | `/api/engagements` | List engagements | JWT |
| `GET` | `/api/engagements/:id` | Get engagement details | JWT |
| `PATCH` | `/api/engagements/:id` | Update engagement | JWT |
| `DELETE` | `/api/engagements/:id` | Cancel engagement | JWT |
| `POST` | `/api/engagements/:id/start` | Start engagement | JWT |
| `POST` | `/api/engagements/:id/pause` | Pause engagement | JWT |
| `POST` | `/api/engagements/:id/approve` | Approve high-risk action | JWT |

```json
// POST /api/engagements — Request
{
  "target_domain": "acme-corp.com",
  "target_name": "Acme Corporation",
  "tier": "Enterprise",
  "scope": {
    "type": "external",
    "include_subdomains": true,
    "exclude_hosts": ["test.acme-corp.com"],
    "allowed_tools": ["subfinder", "nmap", "nuclei", "httpx"]
  },
  "schedule": {
    "start_date": "2026-03-27T00:00:00Z",
    "recurring": false
  }
}

// Response
{
  "id": "uuid",
  "status": "pending",
  "phase": "recon",
  "created_at": "2026-03-26T12:00:00Z"
}
```

#### Findings

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/findings` | List findings | JWT |
| `GET` | `/api/findings/:id` | Get finding details | JWT |
| `PATCH` | `/api/findings/:id` | Update finding (status, severity) | JWT |
| `DELETE` | `/api/findings/:id` | Delete finding (false positive) | JWT |
| `GET` | `/api/engagements/:id/findings` | Get engagement findings | JWT |

```json
// Finding Object
{
  "id": "uuid",
  "engagement_id": "uuid",
  "title": "Subdomain Takeover Vulnerability",
  "description": "Unclaimed AWS S3 bucket found at s3.acme-corp.com",
  "severity": "HIGH",
  "cvss_score": 7.5,
  "phase": "RECON",
  "evidence": {
    "type": "dns",
    "data": { "subdomain": "s3.acme-corp.com", "provider": "aws" }
  },
  "remediation": "Claim the S3 bucket or remove the DNS record",
  "status": "open",
  "created_at": "2026-03-26T12:00:00Z"
}
```

#### Reports

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/reports/:engagement_id` | Generate report | JWT |
| `POST` | `/api/reports/:engagement_id/generate` | Generate PDF | JWT |
| `GET` | `/api/reports/:report_id/download` | Download report | JWT |

```json
// Report Object
{
  "id": "uuid",
  "engagement_id": "uuid",
  "format": "pdf",
  "template": "enterprise",
  "sections": [
    "executive_summary",
    "methodology",
    "findings",
    "risk_assessment",
    "remediation",
    "appendix"
  ],
  "status": "generating",
  "download_url": "https://..."
}
```

#### Audit

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/audit` | List audit entries | JWT |
| `GET` | `/api/audit/:engagement_id` | Get engagement audit trail | JWT |
| `GET` | `/api/audit/export` | Export audit log (CSV) | JWT |

```json
// Audit Log Entry
{
  "id": "uuid",
  "engagement_id": "uuid",
  "agent_name": "AgentBrain",
  "action": "tool_execution",
  "tool_used": "subfinder",
  "input": { "domain": "acme-corp.com" },
  "output": { "subdomains": ["www", "mail", "api"] },
  "risk_evaluation": "ALLOWED",
  "timestamp": "2026-03-26T12:00:00Z"
}
```

### 4.3 Webhooks

**Events:**
- `engagement.started`
- `engagement.phase_changed`
- `engagement.completed`
- `finding.created`
- `finding.severity_changed`
- `approval.required`
- `report.generated`

```json
// Webhook Payload
{
  "event": "finding.created",
  "timestamp": "2026-03-26T12:00:00Z",
  "data": {
    "finding_id": "uuid",
    "engagement_id": "uuid",
    "title": "Subdomain Takeover Vulnerability",
    "severity": "HIGH"
  }
}
```

---

## 5. Security & Compliance

### 5.1 Security Controls

| Control | Implementation |
|---------|----------------|
| **Authentication** | JWT + Refresh Tokens, 2FA optional |
| **Authorization** | RBAC (Admin, Analyst, Viewer) |
| **Encryption** | TLS 1.3 (in-transit), AES-256 (at-rest) |
| **Audit Trail** | Immutable log of all actions |
| **Rate Limiting** | 100 req/min per API key |
| **IP Allowlisting** | Optional for Enterprise+ |
| **Data Retention** | Configurable (90 days - 7 years) |
| **Secrets Management** | Environment variables + Neon secrets |

### 5.2 Compliance Certifications

| Certification | Target Date | Status |
|---------------|-------------|--------|
| SOC2 Type I | Q3 2026 | 🟡 In Progress |
| SOC2 Type II | Q1 2027 | 🔴 Planned |
| ISO27001 | Q2 2027 | 🔴 Planned |
| GDPR | Q3 2026 | 🟡 In Progress |

### 5.3 OpSec Plan

**4 Phases:** Evasion → Cleanup → Encryption → Infrastructure

| Phase | Duration | Actions |
|-------|----------|---------|
| **Evasion** | Week 1-2 | No identifiable markers, randomized user-agents |
| **Cleanup** | Week 2-3 | Remove all artifacts post-engagement |
| **Encryption** | Week 3-4 | Encrypt sensitive data at-rest |
| **Infrastructure** | Week 4+ | Isolated VPC, no shared resources |

---

## 6. Implementation Roadmap

### Phase 1: MVP (Weeks 1-2)
- [ ] VANTA API Server (Express, port 39996)
- [ ] Basic engagement CRUD
- [ ] Findings API
- [ ] Database integration (Neon)
- [ ] AgentBrain integration (Ollama)

### Phase 2: Core Features (Weeks 3-4)
- [ ] Engagement wizard API
- [ ] Approval workflow
- [ ] Audit trail API
- [ ] Report generation (PDF)
- [ ] Webhook support

### Phase 3: Dashboard (Weeks 5-8)
- [ ] React dashboard (engagement overview)
- [ ] Live engagement progress
- [ ] Findings table (filter, export)
- [ ] Audit timeline
- [ ] Report builder UI

### Phase 4: Enterprise (Weeks 9-12)
- [ ] RBAC (Admin, Analyst, Viewer)
- [ ] API key management
- [ ] IP allowlisting
- [ ] Custom report templates
- [ ] White-label branding

### Phase 5: Scale (Weeks 13-16)
- [ ] WebSocket real-time updates
- [ ] Multi-tenant architecture
- [ ] Horizontal scaling (Kubernetes)
- [ ] APT simulation tools
- [ ] On-prem deployment option

---

## 7. Technical Specifications

### 7.1 Infrastructure

| Component | Technology | Specs |
|-----------|------------|-------|
| **API Server** | Node.js 22 + Express | 2 vCPU, 4GB RAM |
| **Database** | Neon PostgreSQL | Serverless, auto-scale |
| **Cache** | Redis (optional) | 1GB for sessions |
| **Queue** | BullMQ | Redis-backed |
| **Storage** | S3-compatible | Reports, evidence |
| **Monitoring** | Prometheus + Grafana | Metrics, alerts |

### 7.2 Dependencies

```json
{
  "dependencies": {
    "express": "^4.18.x",
    "pg": "^8.x",
    "bullmq": "^5.x",
    "jsonwebtoken": "^9.x",
    "bcrypt": "^5.x",
    "winston": "^3.x",
    "ollama": "^0.5.x",
    "agentmail": "^1.x",
    "puppeteer": "^22.x"
  }
}
```

### 7.3 Model Configuration

| Model | Use Case | Provider |
|-------|----------|----------|
| **MiniMax M2.7** | Default agent (ReAct loop) | Ollama Cloud |
| **Qwen3-Coder-Next** | Code analysis | Ollama Cloud |
| **Kimi K2.5** | Complex reasoning | Ollama Cloud |
| **Gemini 3 Flash** | Long context (1M) | Ollama Cloud |

---

## 8. Go-to-Market Strategy

### 8.1 Target Customers

| Segment | Criteria | Outreach Channel |
|---------|----------|------------------|
| **MSSPs** | 10-100 employees, pentest services | LinkedIn, security conferences |
| **Enterprises** | 500-5000 employees, tech/finance | Direct sales, partnerships |
| **Consultancies** | 5-50 consultants, security focus | Content marketing, webinars |

### 8.2 Sales Funnel

```
Awareness → Interest → Demo → Pilot → Close
   ↓           ↓         ↓       ↓        ↓
Content    Email     Live    30-day   Contract
(Twitter,  outreach  demo    pilot    $20-60K
blog)      (Cleo)    (Sales)         ARR
```

### 8.3 Success Metrics

| Metric | Target (Year 1) |
|--------|-----------------|
| Customers | 100 enterprise |
| ARR | $2.4M |
| Churn | <5% annual |
| NPS | >50 |
| Engagements/Month | 500+ |
| Findings/Engagement | 20-50 average |

---

## 9. Risk Assessment

### 9.1 Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Model hallucination (false findings) | Medium | High | Evaluator grading, human review option |
| Tool execution failures | Medium | Medium | Docker fallback, mock tools |
| Database data loss | Low | Critical | Neon backups, point-in-time recovery |
| API downtime | Low | High | Health checks, auto-restart, alerts |

### 9.2 Business Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Customer data breach | Low | Critical | Encryption, audit trail, compliance |
| Regulatory changes | Medium | Medium | Legal review, flexible architecture |
| Competitor copying | High | Medium | Speed, proprietary tools, brand |
| Pricing pressure | Medium | Low | Value-based pricing, differentiation |

---

## 10. Success Criteria

### 10.1 MVP Success (Week 2)
- [ ] API server running (port 39996)
- [ ] Create/start/pause engagements via API
- [ ] Findings stored in Neon DB
- [ ] Basic audit trail working
- [ ] First test engagement completes successfully

### 10.2 Enterprise Ready (Week 12)
- [ ] 99.5% uptime SLA
- [ ] SOC2 Type I audit passed
- [ ] 10+ pilot customers
- [ ] $100K+ ARR committed
- [ ] Full report generation (PDF)

### 10.3 Scale Ready (Week 16)
- [ ] 500+ engagements/month capacity
- [ ] Multi-tenant architecture
- [ ] On-prem deployment option
- [ ] $500K+ ARR
- [ ] <1% churn

---

## 11. Files & Resources

### 11.1 Codebase Structure

```
vanta-core/
├── src/
│   ├── api/                  # Express API server
│   │   ├── index.ts          # Entry point
│   │   ├── routes/
│   │   │   ├── engagements.ts
│   │   │   ├── findings.ts
│   │   │   ├── reports.ts
│   │   │   ├── audit.ts
│   │   │   └── auth.ts
│   │   ├── middleware/
│   │   │   ├── auth.ts
│   │   │   ├── rateLimit.ts
│   │   │   └── errorHandler.ts
│   │   └── webhooks/
│   │       └── index.ts
│   ├── orchestrator/         # VANTA orchestrator
│   │   ├── index.ts
│   │   ├── planner.ts
│   │   ├── evaluator.ts
│   │   └── phaseManager.ts
│   ├── agent/
│   │   └── agent-brain.ts    # ReAct loop
│   ├── tools/
│   │   ├── tool-registry.ts
│   │   ├── subfinder.ts
│   │   ├── nmap.ts
│   │   ├── nuclei.ts
│   │   ├── httpx.ts
│   │   └── claude-code.ts
│   ├── policy/
│   │   └── policy-engine.ts  # Risk gating
│   ├── queue/
│   │   └── session-lane.queue.ts
│   ├── audit/
│   │   └── audit.service.ts
│   ├── db/
│   │   ├── index.ts          # Neon connection
│   │   └── schema.ts         # TypeScript types
│   ├── reports/
│   │   └── generator.ts      # PDF generation
│   └── utils/
│       ├── logger.ts
│       └── config.ts
├── infra/
│   ├── neon-schema.sql       # Database schema
│   └── docker/
│       ├── nmap.Dockerfile   # Kali container
│       └── nuclei.Dockerfile
├── test/
│   ├── integration.test.ts
│   └── e2e/
│       └── engagement.test.ts
├── docs/
│   ├── API.md                # API documentation
│   └── DEPLOYMENT.md         # Deployment guide
├── package.json
├── tsconfig.json
└── ORCHESTRATOR_DESIGN_DOC.md  # UI/UX spec
```

### 11.2 Key Files Created

| File | Purpose |
|------|---------|
| `ORCHESTRATOR_DESIGN_DOC.md` | UI/UX design spec (27KB) |
| `VANTA_ENTERPRISE_DESIGN_DOC.md` | This document (enterprise spec) |
| `PRODUCT_DEFINITION.md` | Business context, pricing tiers |
| `vanta_opsec.md` | Security/OpSec plan |
| `infra/neon-schema.sql` | Database schema (14 tables) |

---

## 12. Contact & Handoff

### Engineering Team

| Role | Contact |
|------|---------|
| **Product** | Zaif (Telegram) |
| **Engineering** | Nodevs (AI Agent) |
| **Frontend** | [TBD — Designer] |
| **Security** | Sam (Security Lead) |

### Handoff Checklist

- [ ] API server running (port 39996)
- [ ] Database connected (Neon)
- [ ] First engagement tested end-to-end
- [ ] Dashboard design approved
- [ ] Pilot customer identified
- [ ] SOC2 audit scheduled

---

**Document Version:** 1.0  
**Last Updated:** March 26, 2026  
**Classification:** CONFIDENTIAL  
**Status:** 🟢 Ready for Engineering

---

*VANTA Core — Autonomous Security Engagement Engine*  
*Build in public. Ship fast. Dominate the market.*

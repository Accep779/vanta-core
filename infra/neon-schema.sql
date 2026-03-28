-- VANTA Core + aBOS Database Schema
-- Neon PostgreSQL Serverless
-- Created: March 26, 2026

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- VANTA CORE TABLES
-- ============================================

-- Security Engagements (pentest simulations)
CREATE TABLE IF NOT EXISTS engagements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    target_domain VARCHAR(255) NOT NULL,
    target_name VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending', -- pending, recon, scan, enumerate, exploit-sim, complete, failed
    phase VARCHAR(50) DEFAULT 'recon',
    risk_level VARCHAR(20) DEFAULT 'LOW', -- LOW, MEDIUM, HIGH
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    tier VARCHAR(50), -- SMB, Enterprise, Intelligence, Nation-State
    price_usd INTEGER,
    notes TEXT
);

-- Findings (discovered vulnerabilities/issues)
CREATE TABLE IF NOT EXISTS findings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    engagement_id UUID REFERENCES engagements(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    severity VARCHAR(20), -- LOW, MEDIUM, HIGH, CRITICAL
    cvss_score DECIMAL(3,1),
    phase VARCHAR(50), -- RECON, SCAN, ENUMERATE, EXPLOIT-SIM
    evidence JSONB, -- screenshots, logs, proofs
    remediation TEXT,
    status VARCHAR(50) DEFAULT 'open', -- open, mitigated, false-positive
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reconnaissance Results
CREATE TABLE IF NOT EXISTS recon_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    engagement_id UUID REFERENCES engagements(id) ON DELETE CASCADE,
    tool VARCHAR(100), -- subfinder, nmap, httpx, etc.
    result_type VARCHAR(100), -- subdomain, port, service, tech, etc.
    data JSONB NOT NULL,
    confidence DECIMAL(5,2), -- 0-100
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit Trail (all agent actions)
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    engagement_id UUID REFERENCES engagements(id) ON DELETE SET NULL,
    agent_name VARCHAR(100),
    action VARCHAR(255) NOT NULL,
    tool_used VARCHAR(100),
    input JSONB,
    output JSONB,
    risk_evaluation VARCHAR(50), -- ALLOWED, GATED, BLOCKED
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Phase Contracts (negotiated "done" criteria)
CREATE TABLE IF NOT EXISTS phase_contracts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    engagement_id UUID REFERENCES engagements(id) ON DELETE CASCADE,
    phase VARCHAR(50) NOT NULL,
    criteria JSONB NOT NULL, -- { "min_subdomains": 5, "confidence_threshold": 80 }
    negotiated_at TIMESTAMPTZ DEFAULT NOW(),
    completed BOOLEAN DEFAULT FALSE,
    graded_at TIMESTAMPTZ,
    grade_score DECIMAL(5,2) -- 0-100 quality score
);

-- ============================================
-- aBOS TABLES (Business Automation)
-- ============================================

-- Leads (real estate agents, etc.)
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    company VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    source VARCHAR(100), -- instagram, linkedin, referral, etc.
    profile_url VARCHAR(500),
    status VARCHAR(50) DEFAULT 'new', -- new, contacted, call-booked, proposal, closed-won, closed-lost
    tier VARCHAR(50), -- Starter (Free), Agency Stack, Full Systemization
    value_usd INTEGER,
    assigned_agent VARCHAR(100), -- larry, cleo, nova, etc.
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    contacted_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ
);

-- Outreach Campaigns
CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    target_audience VARCHAR(255),
    template_subject VARCHAR(500),
    template_body TEXT,
    status VARCHAR(50) DEFAULT 'draft', -- draft, active, paused, complete
    sent_count INTEGER DEFAULT 0,
    reply_count INTEGER DEFAULT 0,
    conversion_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ
);

-- Outreach Messages (individual emails/DMs)
CREATE TABLE IF NOT EXISTS outreach_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    channel VARCHAR(50), -- email, instagram_dm, linkedin, etc.
    subject VARCHAR(500),
    body TEXT,
    status VARCHAR(50) DEFAULT 'draft', -- draft, sent, replied, converted
    sent_at TIMESTAMPTZ,
    replied_at TIMESTAMPTZ,
    reply_text TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Deals (closed business)
CREATE TABLE IF NOT EXISTS deals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    value_usd INTEGER NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- pending, paid, refunded, cancelled
    payment_method VARCHAR(100),
    payment_date TIMESTAMPTZ,
    deliverables JSONB, -- what was promised
    completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks (aBOS task queue)
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    agent VARCHAR(100), -- larry, quilly, ali, sam, cleo, rex, nova, zara
    status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, completed, failed
    priority VARCHAR(20) DEFAULT 'medium', -- low, medium, high, critical
    due_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    result JSONB,
    retry_count INTEGER DEFAULT 0,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activity Log (all agent actions for aBOS)
CREATE TABLE IF NOT EXISTS activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_name VARCHAR(100),
    action VARCHAR(255) NOT NULL,
    entity_type VARCHAR(100), -- lead, deal, task, campaign, etc.
    entity_id UUID,
    details JSONB,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES (for performance)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_engagements_status ON engagements(status);
CREATE INDEX IF NOT EXISTS idx_engagements_phase ON engagements(phase);
CREATE INDEX IF NOT EXISTS idx_findings_engagement ON findings(engagement_id);
CREATE INDEX IF NOT EXISTS idx_findings_severity ON findings(severity);
CREATE INDEX IF NOT EXISTS idx_recon_engagement ON recon_results(engagement_id);
CREATE INDEX IF NOT EXISTS idx_audit_engagement ON audit_log(engagement_id);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp);

CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_source ON leads(source);
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_outreach_lead ON outreach_messages(lead_id);
CREATE INDEX IF NOT EXISTS idx_outreach_status ON outreach_messages(status);
CREATE INDEX IF NOT EXISTS idx_deals_lead ON deals(lead_id);
CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(status);
CREATE INDEX IF NOT EXISTS idx_tasks_agent ON tasks(agent);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_activity_timestamp ON activity_log(timestamp);

-- ============================================
-- VIEWS (for dashboards)
-- ============================================

-- VANTA Pipeline View
CREATE OR REPLACE VIEW vanta_pipeline AS
SELECT 
    status,
    COUNT(*) as count,
    SUM(CASE WHEN tier = 'SMB' THEN price_usd ELSE 0 END) as smb_value,
    SUM(CASE WHEN tier = 'Enterprise' THEN price_usd ELSE 0 END) as enterprise_value,
    SUM(CASE WHEN tier = 'Intelligence' THEN price_usd ELSE 0 END) as intel_value,
    SUM(price_usd) as total_value
FROM engagements
GROUP BY status;

-- aBOS Revenue View
CREATE OR REPLACE VIEW abos_revenue AS
SELECT 
    DATE_TRUNC('month', created_at) as month,
    status,
    COUNT(*) as deal_count,
    SUM(value_usd) as total_value
FROM deals
GROUP BY DATE_TRUNC('month', created_at), status
ORDER BY month DESC;

-- Lead Conversion Funnel
CREATE OR REPLACE VIEW lead_funnel AS
SELECT 
    status,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM leads
GROUP BY status;

-- ============================================
-- SEED DATA (optional - for testing)
-- ============================================

-- Uncomment to insert test data
-- INSERT INTO leads (name, email, source, status, tier) VALUES
--     ('Test Agent 1', 'agent1@test.com', 'instagram', 'new', 'Starter (Free)'),
--     ('Test Agent 2', 'agent2@test.com', 'linkedin', 'contacted', 'Agency Stack');

-- ============================================
-- SCHEMA COMPLETE
-- ============================================

/**
 * VANTA Core API Server
 * Port: 39996
 * 
 * Enterprise security engagement engine
 */

import * as express from 'express';
import * as cors from 'cors';
import * as helmet from 'helmet';
import * as morgan from 'morgan';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';
import { Pool } from 'pg';
import { readFileSync } from 'fs';

// Load configuration
const config = JSON.parse(readFileSync('/home/nodevs/.openclaw/credentials/neon.json', 'utf8'));

// Database connection
const pool = new Pool({
  connectionString: config.connectionString
});

// JWT secret (should be in env var in production)
const JWT_SECRET = process.env.JWT_SECRET || 'vanta-dev-secret-change-in-prod';

const app: Application = express();
const PORT = process.env.VANTA_API_PORT || 39996;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('combined'));

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Auth: Login
app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    
    // TODO: Replace with actual user DB lookup
    // For now, accept any email/password for dev
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    
    const accessToken = jwt.sign(
      { email, role: 'admin' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    
    const refreshToken = jwt.sign(
      { email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({
      accessToken,
      refreshToken,
      expiresIn: 3600,
      user: {
        id: 'dev-user-1',
        email,
        role: 'admin',
        organization: 'dev-org'
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// Auth middleware
const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization required' });
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    (req as any).user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// ============== ENGAGEMENTS ==============

// List engagements
app.get('/api/engagements', authenticate, async (req: Request, res: Response) => {
  try {
    const { status, phase, limit = 50 } = req.query;
    
    let query = 'SELECT * FROM engagements WHERE 1=1';
    const params: any[] = [];
    
    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }
    
    if (phase) {
      params.push(phase);
      query += ` AND phase = $${params.length}`;
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(parseInt(limit as string));
    
    const result = await pool.query(query, params);
    
    res.json({
      engagements: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('List engagements error:', error);
    res.status(500).json({ error: 'Failed to list engagements' });
  }
});

// Get engagement by ID
app.get('/api/engagements/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query('SELECT * FROM engagements WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Engagement not found' });
    }
    
    // Get findings for this engagement
    const findingsResult = await pool.query(
      'SELECT * FROM findings WHERE engagement_id = $1 ORDER BY severity DESC, created_at DESC',
      [id]
    );
    
    // Get audit log for this engagement
    const auditResult = await pool.query(
      'SELECT * FROM audit_log WHERE engagement_id = $1 ORDER BY timestamp DESC LIMIT 100',
      [id]
    );
    
    res.json({
      engagement: result.rows[0],
      findings: findingsResult.rows,
      audit_log: auditResult.rows
    });
  } catch (error) {
    console.error('Get engagement error:', error);
    res.status(500).json({ error: 'Failed to get engagement' });
  }
});

// Create engagement
app.post('/api/engagements', authenticate, async (req: Request, res: Response) => {
  try {
    const {
      target_domain,
      target_name,
      tier = 'SMB',
      scope,
      schedule
    } = req.body;
    
    if (!target_domain) {
      return res.status(400).json({ error: 'target_domain is required' });
    }
    
    const priceMap: Record<string, number> = {
      'SMB': 20000,
      'Enterprise': 60000,
      'Intelligence': 500000,
      'Nation-State': 2000000
    };
    
    const price_usd = priceMap[tier] || 20000;
    
    const result = await pool.query(
      `INSERT INTO engagements (target_domain, target_name, tier, price_usd, status, phase, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING *`,
      [target_domain, target_name || target_domain, tier, price_usd, 'pending', 'recon']
    );
    
    res.status(201).json({
      id: result.rows[0].id,
      status: result.rows[0].status,
      phase: result.rows[0].phase,
      created_at: result.rows[0].created_at
    });
  } catch (error) {
    console.error('Create engagement error:', error);
    res.status(500).json({ error: 'Failed to create engagement' });
  }
});

// Start engagement
app.post('/api/engagements/:id/start', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      `UPDATE engagements SET status = 'recon', phase = 'recon', started_at = NOW()
       WHERE id = $1 AND status = 'pending'
       RETURNING *`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Engagement not found or not in pending status' });
    }
    
    // TODO: Trigger VANTA orchestrator to start engagement
    
    res.json({
      message: 'Engagement started',
      engagement: result.rows[0]
    });
  } catch (error) {
    console.error('Start engagement error:', error);
    res.status(500).json({ error: 'Failed to start engagement' });
  }
});

// Pause engagement
app.post('/api/engagements/:id/pause', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      `UPDATE engagements SET status = 'paused'
       WHERE id = $1 AND status != 'complete'
       RETURNING *`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Engagement not found' });
    }
    
    res.json({
      message: 'Engagement paused',
      engagement: result.rows[0]
    });
  } catch (error) {
    console.error('Pause engagement error:', error);
    res.status(500).json({ error: 'Failed to pause engagement' });
  }
});

// Approve high-risk action
app.post('/api/engagements/:id/approve', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { approved, action_id, action_type } = req.body;
    
    // Log the approval decision
    await pool.query(
      `INSERT INTO audit_log (engagement_id, agent_name, action, input, risk_evaluation, timestamp)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [id, 'human-reviewer', 'approval_decision', { action_id, action_type, approved }, approved ? 'ALLOWED' : 'BLOCKED']
    );
    
    // TODO: Resume orchestrator with approval decision
    
    res.json({
      message: approved ? 'Action approved' : 'Action denied',
      engagement_id: id
    });
  } catch (error) {
    console.error('Approve action error:', error);
    res.status(500).json({ error: 'Failed to process approval' });
  }
});

// ============== FINDINGS ==============

// List findings
app.get('/api/findings', authenticate, async (req: Request, res: Response) => {
  try {
    const { engagement_id, severity, status, limit = 100 } = req.query;
    
    let query = 'SELECT * FROM findings WHERE 1=1';
    const params: any[] = [];
    
    if (engagement_id) {
      params.push(engagement_id);
      query += ` AND engagement_id = $${params.length}`;
    }
    
    if (severity) {
      params.push(severity);
      query += ` AND severity = $${params.length}`;
    }
    
    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }
    
    query += ` ORDER BY severity DESC, created_at DESC LIMIT $${params.length + 1}`;
    params.push(parseInt(limit as string));
    
    const result = await pool.query(query, params);
    
    res.json({
      findings: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('List findings error:', error);
    res.status(500).json({ error: 'Failed to list findings' });
  }
});

// Get finding by ID
app.get('/api/findings/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query('SELECT * FROM findings WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Finding not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get finding error:', error);
    res.status(500).json({ error: 'Failed to get finding' });
  }
});

// Update finding
app.patch('/api/findings/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, severity, remediation } = req.body;
    
    const updates: string[] = [];
    const params: any[] = [];
    
    if (status) {
      params.push(status);
      updates.push(`status = $${params.length}`);
    }
    
    if (severity) {
      params.push(severity);
      updates.push(`severity = $${params.length}`);
    }
    
    if (remediation) {
      params.push(remediation);
      updates.push(`remediation = $${params.length}`);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }
    
    params.push(id);
    const query = `UPDATE findings SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING *`;
    
    const result = await pool.query(query, params);
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update finding error:', error);
    res.status(500).json({ error: 'Failed to update finding' });
  }
});

// ============== AUDIT ==============

// List audit entries
app.get('/api/audit', authenticate, async (req: Request, res: Response) => {
  try {
    const { engagement_id, limit = 100 } = req.query;
    
    let query = 'SELECT * FROM audit_log WHERE 1=1';
    const params: any[] = [];
    
    if (engagement_id) {
      params.push(engagement_id);
      query += ` AND engagement_id = $${params.length}`;
    }
    
    query += ` ORDER BY timestamp DESC LIMIT $${params.length + 1}`;
    params.push(parseInt(limit as string));
    
    const result = await pool.query(query, params);
    
    res.json({
      entries: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('List audit error:', error);
    res.status(500).json({ error: 'Failed to list audit log' });
  }
});

// Export audit log
app.get('/api/audit/export', authenticate, async (req: Request, res: Response) => {
  try {
    const { engagement_id } = req.query;
    
    let query = 'SELECT * FROM audit_log WHERE 1=1';
    const params: any[] = [];
    
    if (engagement_id) {
      params.push(engagement_id);
      query += ` AND engagement_id = $${params.length}`;
    }
    
    query += ' ORDER BY timestamp ASC';
    
    const result = await pool.query(query, params);
    
    // Convert to CSV
    const csv = [
      'id,engagement_id,agent_name,action,tool_used,risk_evaluation,timestamp',
      ...result.rows.map(row =>
        `${row.id},${row.engagement_id},${row.agent_name},${row.action},${row.tool_used || ''},${row.risk_evaluation},${row.timestamp}`
      )
    ].join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="audit_log.csv"');
    res.send(csv);
  } catch (error) {
    console.error('Export audit error:', error);
    res.status(500).json({ error: 'Failed to export audit log' });
  }
});

// ============== STATS ==============

// System stats
app.get('/api/stats', authenticate, async (req: Request, res: Response) => {
  try {
    const engagements = await pool.query(
      'SELECT status, COUNT(*) as count, SUM(price_usd) as total_value FROM engagements GROUP BY status'
    );
    
    const findings = await pool.query(
      'SELECT severity, COUNT(*) as count FROM findings GROUP BY severity'
    );
    
    const recent = await pool.query(
      "SELECT DATE_TRUNC('day', created_at) as day, COUNT(*) as engagements FROM engagements WHERE created_at > NOW() - INTERVAL '30 days' GROUP BY DATE_TRUNC('day', created_at) ORDER BY day"
    );
    
    res.json({
      engagements: engagements.rows,
      findings: findings.rows,
      recent_activity: recent.rows,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🛡️ VANTA Core API Server running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Engagements: http://localhost:${PORT}/api/engagements`);
  console.log(`   Findings: http://localhost:${PORT}/api/findings`);
  console.log(`   Audit: http://localhost:${PORT}/api/audit`);
});

export default app;

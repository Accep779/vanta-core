/**
 * Quick Campaign Sender - Send personalized emails to new leads
 * Simplified version for immediate execution
 */

const { Pool } = require('pg');
const fs = require('fs');

const neonConfig = JSON.parse(fs.readFileSync('/home/nodevs/.openclaw/credentials/neon.json', 'utf8'));
const agentmailConfig = JSON.parse(fs.readFileSync('/home/nodevs/.openclaw/credentials/agentmail.json', 'utf8'));
const TEMPLATES = require('./scripts/outreach-templates');
const { analyzeEmail, BOUNCED_DOMAINS } = require('./scripts/email-segmentation');

const pool = new Pool({ connectionString: neonConfig.connectionString });

const INBOXES = ['cleo-nodevs@agentmail.to', 'zestyability426@agentmail.to', 'calmlocation931@agentmail.to'];

async function sendCampaign(limit = 50) {
  console.log('\n📧 Sending campaign to', limit, 'new leads...\n');
  
  const { rows: leads } = await pool.query(
    "SELECT * FROM leads WHERE status = 'new' ORDER BY created_at ASC LIMIT $1",
    [limit]
  );
  
  // Filter out high-risk emails BEFORE sending
  const safeLeads = [];
  const skipped = [];
  
  for (const lead of leads) {
    const analysis = analyzeEmail(lead.email, { name: lead.name, company: lead.company });
    if (analysis.segment === 'skip') {
      skipped.push({ email: lead.email, reasons: analysis.reasons });
      // Mark as invalid in DB
      await pool.query("UPDATE leads SET status = 'invalid' WHERE id = $1", [lead.id]);
    } else {
      safeLeads.push(lead);
    }
  }
  
  if (skipped.length > 0) {
    console.log(`⚠️  Skipped ${skipped.length} high-risk email(s):\n`);
    skipped.forEach(s => console.log(`   ✗ ${s.email} - ${s.reasons.join('; ')}`));
    console.log('');
  }
  
  console.log('Found', safeLeads.length, 'safe leads to send (filtered from', leads.length, 'total)\n');
  
  let sent = 0;
  let failed = 0;
  let inboxIdx = 0;
  
  for (const lead of safeLeads) {
    const inbox = INBOXES[inboxIdx++ % INBOXES.length];
    const niche = TEMPLATES[lead.industry] || TEMPLATES['real estate'];
    const company = lead.name || lead.company || 'your business';
    
    const subject = niche.initial.subject.replace(/{{company}}/g, company);
    const body = niche.initial.body.replace(/{{company}}/g, company);
    
    try {
      const apiUrl = `https://api.agentmail.to/v0/inboxes/${inbox}/messages/send`;
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${agentmailConfig.apiKey}`,
        },
        body: JSON.stringify({
          to: lead.email,
          subject: subject,
          text: body,
        }),
      });
      
      const result = await response.json();
      
      if (response.ok) {
        await pool.query(
          "UPDATE leads SET status = 'contacted', contacted_at = NOW() WHERE id = $1",
          [lead.id]
        );
        console.log(`✓ ${lead.industry?.padEnd(20) || 'unknown'} → ${lead.email} (${inbox})`);
        sent++;
      } else {
        console.log(`✗ ${lead.email} - ${result.message || 'failed'}`);
        failed++;
      }
    } catch (error) {
      console.log(`✗ ${lead.email} - ${error.message}`);
      failed++;
    }
    
    // Rate limit: 1.5 seconds between emails
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
  
  console.log(`\n📊 Results: ${sent} sent, ${failed} failed\n`);
  await pool.end();
}

sendCampaign(50);

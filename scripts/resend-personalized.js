/**
 * Re-send personalized outreach to already-contacted leads
 * Previous emails were generic - this sends niche-specific offers
 */

const { Pool } = require('pg');
const fs = require('fs');

const neonConfig = JSON.parse(fs.readFileSync('/home/nodevs/.openclaw/credentials/neon.json', 'utf8'));
const agentmailConfig = JSON.parse(fs.readFileSync('/home/nodevs/.openclaw/credentials/agentmail.json', 'utf8'));
const TEMPLATES = require('./outreach-templates');

const pool = new Pool({ connectionString: neonConfig.connectionString });

async function sendEmail(to, subject, body) {
  const inboxId = 'cleo-nodevs@agentmail.to';
  const apiUrl = `https://api.agentmail.to/v0/inboxes/${inboxId}/messages/send`;
  
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${agentmailConfig.apiKey}`,
    },
    body: JSON.stringify({
      to: to,
      subject: subject,
      text: body,
    }),
  });
  
  const result = await response.json();
  return response.ok ? { success: true, messageId: result.message_id } : { success: false, error: result.message };
}

async function resendPersonalized() {
  console.log('\n📧 Re-sending personalized outreach (niche-specific)...\n');
  
  const { rows: leads } = await pool.query(`
    SELECT * FROM leads 
    WHERE industry IS NOT NULL AND contacted_at IS NOT NULL
    ORDER BY created_at ASC
  `);
  
  console.log(`   Leads to re-contact: ${leads.length}\n`);
  
  let sent = 0;
  let failed = 0;
  
  for (const lead of leads) {
    const nicheTemplates = TEMPLATES[lead.industry] || TEMPLATES['real estate'];
    const template = nicheTemplates.initial;
    const company = lead.name || lead.company || 'your business';
    
    const subject = template.subject.replace(/{{company}}/g, company);
    const body = template.body.replace(/{{company}}/g, company);
    
    const result = await sendEmail(lead.email, subject, body);
    
    if (result.success) {
      console.log(`   ✓ ${lead.industry.padEnd(20)} → ${lead.email}`);
      sent++;
    } else {
      console.log(`   ✗ ${lead.industry.padEnd(20)} → ${lead.email}: ${result.error}`);
      failed++;
    }
    
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
  
  console.log(`\n📊 Results: ${sent} sent, ${failed} failed\n`);
  await pool.end();
}

resendPersonalized();

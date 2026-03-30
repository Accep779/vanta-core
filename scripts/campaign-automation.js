/**
 * LeadFlow Campaign Automation — High Volume (150/day)
 * 
 * - Rotates across 3 AgentMail inboxes for deliverability
 * - Sends niche-specific personalized emails
 * - Auto follow-ups: Day 3, 7, 14
 * - Rate limited: ~50 emails/inbox/day
 */

const { Pool } = require('pg');
const fs = require('fs');

// Load credentials
const neonConfig = JSON.parse(
  fs.readFileSync('/home/nodevs/.openclaw/credentials/neon.json', 'utf8')
);
const agentmailConfig = JSON.parse(
  fs.readFileSync('/home/nodevs/.openclaw/credentials/agentmail.json', 'utf8')
);

// Load niche-specific templates
const TEMPLATES = require('./outreach-templates');

const pool = new Pool({ connectionString: neonConfig.connectionString });

// ═══════════════════════════════════════════════════════════════
// INBOX ROTATION — 3 inboxes for 150 emails/day
// ═══════════════════════════════════════════════════════════════
const INBOXES = agentmailConfig.inboxes || [
  { name: 'cleo', email: 'cleo-nodevs@agentmail.to' },
  { name: 'larry', email: 'zestyability426@agentmail.to' },
  { name: 'quilly', email: 'calmlocation931@agentmail.to' }
];

let currentInboxIndex = 0;

function getNextInbox() {
  const inbox = INBOXES[currentInboxIndex % INBOXES.length];
  currentInboxIndex++;
  return inbox;
}

/**
 * Get leads needing outreach
 */
async function getLeadsNeedingOutreach() {
  // New leads (never contacted)
  const newLeads = await pool.query(`
    SELECT * FROM leads 
    WHERE status = 'new' 
    ORDER BY created_at ASC 
    LIMIT 150
  `);
  
  // Follow-up: leads contacted but no reply, older than 3 days
  const followupLeads = await pool.query(`
    SELECT *, 
      EXTRACT(DAY FROM NOW() - created_at) as days_since_contact
    FROM leads 
    WHERE status = 'contacted' 
      AND created_at < NOW() - INTERVAL '3 days'
    ORDER BY created_at ASC 
    LIMIT 50
  `);
  
  return {
    new: newLeads.rows,
    followup: followupLeads.rows,
  };
}

/**
 * Send email via AgentMail API (with inbox rotation)
 */
async function sendEmail(to, subject, body, inbox) {
  try {
    // API expects full email address as inbox_id
    const inboxEmail = typeof inbox === 'string' ? inbox : inbox.email;
    const inboxName = typeof inbox === 'string' ? inbox : inbox.name;
    const apiUrl = `https://api.agentmail.to/v0/inboxes/${inboxEmail}/messages/send`;
    
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
    
    if (response.ok) {
      return { success: true, messageId: result.message_id, inbox: inboxName };
    } else {
      return { success: false, error: result.message || result.error || `HTTP ${response.status}`, inbox: inboxName };
    }
  } catch (error) {
    console.error(`    → Fetch error: ${error.message}`);
    return { success: false, error: error.message, inbox: typeof inbox === 'string' ? inbox : inbox.name };
  }
}

/**
 * Get template for lead's industry
 */
function getTemplateForIndustry(industry, templateType = 'initial') {
  const normalizedIndustry = (industry || '').toLowerCase().trim();
  
  let nicheKey = Object.keys(TEMPLATES).find(key => 
    normalizedIndustry.includes(key) || normalizedIndustry.includes(key.split(' ')[0])
  );
  
  if (!nicheKey) {
    nicheKey = 'real estate';
  }
  
  const nicheTemplates = TEMPLATES[nicheKey];
  
  if (!nicheTemplates) {
    return TEMPLATES['real estate'][templateType] || TEMPLATES['real estate'].initial;
  }
  
  return nicheTemplates[templateType] || nicheTemplates.initial;
}

/**
 * Personalize template with lead data
 */
function personalizeTemplate(template, lead) {
  const company = lead.name || lead.company || 'your company';
  
  const body = template.body
    .replace(/{{company}}/g, company);
  
  const subject = template.subject
    .replace(/{{company}}/g, company);
  
  return { subject, body, niche: template };
}

/**
 * Update lead status after outreach
 */
async function updateLeadStatus(leadId, status, inboxUsed) {
  const query = `
    UPDATE leads 
    SET status = $1, contacted_at = NOW(), last_outreach_inbox = $2
    WHERE id = $3
  `;
  
  await pool.query(query, [status, inboxUsed, leadId]);
}

/**
 * Main campaign runner
 */
async function runCampaign(dailyLimit = 150) {
  console.log('\n📧 Running LeadFlow Campaign Automation (High Volume)...\n');
  console.log(`   Daily limit: ${dailyLimit} emails`);
  console.log(`   Active inboxes: ${INBOXES.length}`);
  console.log(`   Max per inbox: ~${Math.floor(dailyLimit / INBOXES.length)} emails\n`);
  
  const { new: newLeads, followup: followupLeads } = await getLeadsNeedingOutreach();
  
  console.log(`   New leads to contact: ${newLeads.length}`);
  console.log(`   Follow-ups due: ${followupLeads.length}\n`);
  
  let sent = 0;
  let failed = 0;
  const inboxCount = {};
  const nicheCount = {};
  
  // Send initial outreach to new leads
  for (const lead of newLeads) {
    if (sent >= dailyLimit) {
      console.log(`   ⏹ Daily limit reached (${dailyLimit})`);
      break;
    }
    
    const template = getTemplateForIndustry(lead.industry, 'initial');
    const personalized = personalizeTemplate(template, lead);
    const inbox = getNextInbox();
    
    // Track distribution
    const nicheName = Object.keys(TEMPLATES).find(k => template === TEMPLATES[k].initial) || 'unknown';
    nicheCount[nicheName] = (nicheCount[nicheName] || 0) + 1;
    inboxCount[inbox] = (inboxCount[inbox] || 0) + 1;
    
    const emailResult = await sendEmail(lead.email, personalized.subject, personalized.body, inbox);
    
    if (emailResult.success) {
      await updateLeadStatus(lead.id, 'contacted', inboxEmail);
      
      const inboxName = typeof inbox === 'string' ? inbox : inbox.name;
      console.log(`   ✓ ${lead.industry?.padEnd(20) || 'unknown'} → ${lead.email} (${inboxName})`);
      sent++;
    } else {
      console.log(`   ✗ Failed to ${lead.email}: ${emailResult.error}`);
      failed++;
    }
    
    // Rate limiting: 2 seconds between emails (30/min, safe for all inboxes)
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Send follow-ups (priority — these are warm leads)
  for (const lead of followupLeads) {
    const daysSince = parseInt(lead.days_since_contact);
    let templateType;
    
    if (daysSince >= 14) {
      templateType = 'followup3_day14';
    } else if (daysSince >= 7) {
      templateType = 'followup2_day7';
    } else if (daysSince >= 3) {
      templateType = 'followup1_day3';
    } else {
      continue;
    }
    
    const template = getTemplateForIndustry(lead.industry, templateType);
    const personalized = personalizeTemplate(template, lead);
    const inbox = getNextInbox();
    const inboxName = typeof inbox === 'string' ? inbox : inbox.name;
    
    const emailResult = await sendEmail(lead.email, personalized.subject, personalized.body, inbox);
    
    if (emailResult.success) {
      const newStatus = daysSince >= 14 ? 'exhausted' : 'contacted';
      await updateLeadStatus(lead.id, newStatus, inboxName);
      
      console.log(`   ✓ ${templateType.padEnd(18)} → ${lead.email} (${inboxName})`);
      sent++;
    } else {
      console.log(`   ✗ Failed follow-up to ${lead.email}: ${emailResult.error}`);
      failed++;
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log(`\n📊 Campaign Results:`);
  console.log(`   Sent: ${sent}`);
  console.log(`   Failed: ${failed}`);
  console.log(`   By inbox:`);
  for (const [inbox, count] of Object.entries(inboxCount)) {
    console.log(`     - ${inbox}: ${count}`);
  }
  console.log(`   By niche:`);
  for (const [niche, count] of Object.entries(nicheCount)) {
    console.log(`     - ${niche}: ${count}`);
  }
  console.log(`   New leads remaining: ${Math.max(0, newLeads.length - sent)}`);
  console.log(`   Follow-ups pending: ${Math.max(0, followupLeads.length - (sent - newLeads.length))}\n`);
  
  return { sent, failed, inboxCount, nicheCount };
}

// CLI execution
if (require.main === module) {
  const dailyLimit = parseInt(process.argv[2]) || 150;
  
  runCampaign(dailyLimit)
    .then(() => {
      console.log('✅ Campaign automation complete\n');
      process.exit(0);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    })
    .finally(() => {
      pool.end();
    });
}

module.exports = { runCampaign, INBOXES };

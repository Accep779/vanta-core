/**
 * Email Segmentation & Validation
 * Analyzes leads and segments by deliverability risk
 * 
 * Learnings from March 27 campaign:
 * - 30% bounce rate (industry standard: <5%)
 * - High-risk patterns identified below
 */

const { Pool } = require('pg');
const fs = require('fs');

const neonConfig = JSON.parse(fs.readFileSync('/home/nodevs/.openclaw/credentials/neon.json', 'utf8'));
const pool = new Pool({ connectionString: neonConfig.connectionString });

// ============== BOUNCE PATTERNS LEARNED ==============

const HIGH_RISK_PATTERNS = [
  // Generic mailboxes (high bounce/filter rate)
  { pattern: /^info@/i, reason: 'Generic inbox - often filtered', risk: 'high' },
  { pattern: /^contact@/i, reason: 'Generic contact form', risk: 'high' },
  { pattern: /^hello@/i, reason: 'Generic startup inbox', risk: 'medium' },
  { pattern: /^admin@/i, reason: 'Admin mailbox - often blocked', risk: 'high' },
  { pattern: /^support@/i, reason: 'Support inbox - not sales', risk: 'medium' },
  { pattern: /^sales@/i, reason: 'Sales inbox - may be monitored', risk: 'low' },
  
  // Role-based (not decision makers)
  { pattern: /^reception@/i, reason: 'Reception - not decision maker', risk: 'high' },
  { pattern: /^office@/i, reason: 'General office inbox', risk: 'medium' },
  { pattern: /^mail@/i, reason: 'Generic mail catch-all', risk: 'high' },
  
  // Educational/Government (often block cold outreach)
  { pattern: /\.edu\.|\.ac\./i, reason: 'Educational domain - restricted', risk: 'high' },
  { pattern: /\.gov\.|\.go\./i, reason: 'Government domain - restricted', risk: 'high' },
  
  // Known problematic domains
  { pattern: /@gmail\.com$/i, reason: 'Personal Gmail - may be outdated', risk: 'medium' },
  { pattern: /@yahoo\.com$/i, reason: 'Personal Yahoo - often abandoned', risk: 'high' },
  { pattern: /@hotmail\.com$/i, reason: 'Personal Hotmail - often abandoned', risk: 'high' },
  
  // Complex subdomains (often invalid)
  { pattern: /@.*\..*\..*\./, reason: 'Deep subdomain - may be invalid', risk: 'medium' },
];

const BOUNCED_DOMAINS = new Set([
  // Domains that bounced in March 27 campaign
  'calgaryschoicetaxservices.com',
  'bastionfinancialgroup.com.au',
  'corcoran.com',
  'davlin.biz',
  'dentl.com.au',
  'dmsplumbing.co.za',
  'capital-partners.com.au',
  
  // Known disposable/temporary email domains (high bounce)
  'tempmail.com',
  'guerrillamail.com',
  '10minutemail.com',
  'mailinator.com',
  'throwaway.email',
  'temp-mail.org',
  'fakeinbox.com',
  'trashmail.com',
  'getnada.com',
  'maildrop.cc',
  'yopmail.com',
  'sharklasers.com',
  'guerrillamailblock.com',
  'pokemail.net',
  'spam4.me',
  'tempinbox.com',
  'disposablemail.com',
  'burnermail.io',
  'emailondeck.com',
  
  // Common bounce-prone domains (outdated/abandoned)
  'aol.com',
  'live.com',
  'msn.com',
  'comcast.net',
  'verizon.net',
  'att.net',
  'sbcglobal.net',
  'bellsouth.net',
  'cox.net',
  'optonline.net',
  
  // Role-based domains (not decision makers)
  'genericmail.com',
  'info-mail.com',
  'contact-us.com',
  
  // Educational/Government (restricted)
  'edu',
  'ac.uk',
  'gov',
  'go.uk',
  'mil',
]);

// ============== SEGMENTATION ==============

function analyzeEmail(email, leadData = {}) {
  const result = {
    email,
    risk: 'low',
    score: 100,
    reasons: [],
    segment: 'send', // send | review | skip
  };
  
  // Check against bounced domains
  const domain = email.split('@')[1]?.toLowerCase();
  if (BOUNCED_DOMAINS.has(domain)) {
    result.risk = 'critical';
    result.score = 0;
    result.reasons.push('Domain previously bounced');
    result.segment = 'skip';
    return result;
  }
  
  // Check patterns
  for (const { pattern, reason, risk } of HIGH_RISK_PATTERNS) {
    if (pattern.test(email)) {
      result.reasons.push(reason);
      
      if (risk === 'critical') {
        result.risk = 'critical';
        result.score = 0;
        result.segment = 'skip';
      } else if (risk === 'high') {
        result.risk = 'high';
        result.score = Math.min(result.score, 40);
        result.segment = 'skip';
      } else if (risk === 'medium') {
        result.risk = 'medium';
        result.score = Math.min(result.score, 60);
        result.segment = 'review';
      }
      break; // Use first match
    }
  }
  
  // Bonus points for good signals
  if (leadData.name || leadData.company) {
    result.score = Math.min(result.score + 10, 100);
  }
  
  // Personal email at company domain = good
  const localPart = email.split('@')[0];
  if (localPart.includes('.') || /^[a-z]+$/i.test(localPart)) {
    // e.g., john.smith@ or john@ = likely real person
    result.score = Math.min(result.score + 20, 100);
    if (result.segment === 'review') result.segment = 'send';
  }
  
  // Final segmentation
  if (result.score >= 70) result.segment = 'send';
  else if (result.score >= 40) result.segment = 'review';
  else result.segment = 'skip';
  
  return result;
}

async function segmentLeads() {
  console.log('\n📧 Email Segmentation Analysis\n');
  
  const { rows: leads } = await pool.query(
    "SELECT * FROM leads WHERE status = 'new' ORDER BY created_at DESC"
  );
  
  const segments = {
    send: [],
    review: [],
    skip: [],
  };
  
  const riskCounts = { low: 0, medium: 0, high: 0, critical: 0 };
  
  for (const lead of leads) {
    const analysis = analyzeEmail(lead.email, {
      name: lead.name,
      company: lead.company,
      industry: lead.industry,
    });
    
    riskCounts[analysis.risk]++;
    segments[analysis.segment].push({
      ...lead,
      emailRisk: analysis.risk,
      emailScore: analysis.score,
      emailReasons: analysis.reasons,
    });
  }
  
  // Report
  console.log('┌─────────────────────────────────────────────────────────┐');
  console.log('│ EMAIL SEGMENTATION RESULTS                              │');
  console.log('├─────────────────────────────────────────────────────────┤');
  console.log(`│ Total leads analyzed: ${String(leads.length).padEnd(34)}│`);
  console.log('├─────────────────────────────────────────────────────────┤');
  console.log('│ BY SEGMENT:                                             │');
  console.log(`│   ✅ SEND:   ${String(segments.send.length).padEnd(6)} (${Math.round(segments.send.length/leads.length*100)}%) - Safe to send          │`);
  console.log(`│   ⚠️  REVIEW: ${String(segments.review.length).padEnd(6)} (${Math.round(segments.review.length/leads.length*100)}%) - Manual check needed   │`);
  console.log(`│   ❌ SKIP:   ${String(segments.skip.length).padEnd(6)} (${Math.round(segments.skip.length/leads.length*100)}%) - Do not send           │`);
  console.log('├─────────────────────────────────────────────────────────┤');
  console.log('│ BY RISK LEVEL:                                          │');
  console.log(`│   🟢 Low:       ${String(riskCounts.low).padEnd(4)}                              │`);
  console.log(`│   🟡 Medium:    ${String(riskCounts.medium).padEnd(4)}                              │`);
  console.log(`│   🟠 High:      ${String(riskCounts.high).padEnd(4)}                              │`);
  console.log(`│   🔴 Critical:  ${String(riskCounts.critical).padEnd(4)}                              │`);
  console.log('└─────────────────────────────────────────────────────────┘');
  
  // Show skip reasons
  if (segments.skip.length > 0) {
    console.log('\n❌ SKIP List (Do Not Send):\n');
    segments.skip.slice(0, 15).forEach(lead => {
      console.log(`   ${lead.email.padEnd(45)} - ${lead.emailReasons.join('; ')}`);
    });
    if (segments.skip.length > 15) {
      console.log(`   ... and ${segments.skip.length - 15} more`);
    }
  }
  
  // Update DB with segmentation
  console.log('\n📝 Updating database with email risk scores...\n');
  
  let updated = 0;
  for (const lead of leads) {
    const analysis = analyzeEmail(lead.email, { name: lead.name, company: lead.company });
    
    await pool.query(
      `UPDATE leads 
       SET notes = COALESCE(notes || ' | ', '') || $1,
           tier = CASE 
             WHEN $2 = 'skip' THEN 'do_not_contact'
             WHEN $2 = 'review' THEN 'review_required'
             ELSE tier
           END
       WHERE id = $3`,
      [`Email risk: ${analysis.risk} (${analysis.score}/100) - ${analysis.reasons.join('; ') || 'No issues'}`, analysis.segment, lead.id]
    );
    updated++;
  }
  
  console.log(`✅ Updated ${updated} leads with email risk scores\n`);
  
  // Mark skip leads as invalid
  console.log('🚫 Marking SKIP leads as invalid...\n');
  
  const skipIds = segments.skip.map(l => `'${l.id}'`).join(',');
  if (skipIds) {
    await pool.query(
      `UPDATE leads SET status = 'invalid' WHERE id IN (${skipIds})`
    );
    console.log(`✅ Marked ${segments.skip.length} leads as invalid\n`);
  }
  
  await pool.end();
  
  return { segments, riskCounts };
}

// Run if called directly
if (require.main === module) {
  segmentLeads().catch(console.error);
}

module.exports = { analyzeEmail, segmentLeads, HIGH_RISK_PATTERNS, BOUNCED_DOMAINS };

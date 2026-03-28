/**
 * LeadFlow Reply Monitor — Cleo Inbox Check
 * 
 * Monitors cleo-nodevs@agentmail.to for replies
 * - Extracts sender email, matches to lead in Neon DB
 * - Updates lead status to 'replied', stores reply text
 * - Flags hot leads (keywords: interested, yes, call, meeting, demo)
 * - Reports: new replies count, hot leads identified
 * 
 * Runs every 30 minutes via cron
 */

const { Pool } = require('pg');
const { AgentMailClient } = require('agentmail');
const fs = require('fs');

// Load credentials
const neonConfig = JSON.parse(
  fs.readFileSync('/home/nodevs/.openclaw/credentials/neon.json', 'utf8')
);
const agentmailConfig = JSON.parse(
  fs.readFileSync('/home/nodevs/.openclaw/credentials/agentmail.json', 'utf8')
);

const pool = new Pool({ connectionString: neonConfig.connectionString });
const client = new AgentMailClient({ apiKey: agentmailConfig.apiKey });

// Hot lead keywords (case-insensitive)
const HOT_KEYWORDS = ['interested', 'yes', 'call', 'meeting', 'demo', 'schedule', 'book', 'ready', 'start'];

/**
 * Check if reply indicates hot lead
 */
function isHotLead(text) {
  const lowerText = text.toLowerCase();
  return HOT_KEYWORDS.some(keyword => lowerText.includes(keyword));
}

/**
 * Get inbox ID for cleo-nodevs
 */
async function getCleoInboxId() {
  try {
    const inboxes = await client.inboxes.list();
    const cleoInbox = inboxes.inboxes?.find(
      inbox => inbox.email === 'cleo-nodevs@agentmail.to' || inbox.username === 'cleo-nodevs'
    );
    
    if (!cleoInbox) {
      throw new Error('Cleo inbox not found. Create it first via test-agentmail.js');
    }
    
    return cleoInbox.inboxId;
  } catch (error) {
    console.error('❌ Error fetching inbox:', error.message);
    throw error;
  }
}

/**
 * Fetch unread/recent messages from inbox
 */
async function fetchMessages(inboxId) {
  try {
    // Get messages from last 24 hours - pass as Date object, not string
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const result = await client.inboxes.messages.list(inboxId, {
      after: twentyFourHoursAgo,  // Pass Date object directly
      limit: 100,
    });
    
    // API returns flat structure: { count, limit, messages }
    return result.messages || [];
  } catch (error) {
    console.error('❌ Error fetching messages:', error.message);
    throw error;
  }
}

/**
 * Find lead by email in Neon DB
 */
async function findLeadByEmail(email) {
  try {
    const result = await pool.query(
      'SELECT * FROM leads WHERE email = $1 LIMIT 1',
      [email.toLowerCase()]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('❌ Error finding lead:', error.message);
    return null;
  }
}

/**
 * Update lead with reply info
 */
async function updateLeadWithReply(leadId, replyText, isHot) {
  try {
    const newStatus = isHot ? 'hot-lead' : 'replied';
    
    await pool.query(
      `UPDATE leads 
       SET status = $1, 
           notes = COALESCE(notes || E'\\n\\n', '') || 'Reply received: ' || $2,
           contacted_at = COALESCE(contacted_at, NOW())
       WHERE id = $3`,
      [newStatus, replyText.substring(0, 500), leadId]
    );
    
    // Log activity
    await pool.query(
      `INSERT INTO activity_log (agent_name, action, entity_type, entity_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      ['cleo', 'reply_received', 'lead', leadId, JSON.stringify({ isHot, replyLength: replyText.length })]
    );
    
    // If hot lead, create task for Larry
    if (isHot) {
      await pool.query(
        `INSERT INTO tasks (title, description, agent, priority, status)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          '🔥 Hot lead from Cleo outreach',
          `Lead replied with interest. Review reply and schedule call.\n\nReply excerpt: ${replyText.substring(0, 200)}`,
          'larry',
          'high',
          'pending'
        ]
      );
    }
    
    return { success: true, newStatus };
  } catch (error) {
    console.error('❌ Error updating lead:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Check if we already processed this message
 */
async function isMessageProcessed(messageId) {
  try {
    const result = await pool.query(
      'SELECT 1 FROM activity_log WHERE agent_name = $1 AND details->>\'messageId\' = $2 LIMIT 1',
      ['cleo', messageId]
    );
    return result.rows.length > 0;
  } catch (error) {
    return false;
  }
}

/**
 * Mark message as processed
 */
async function markMessageProcessed(messageId, leadId) {
  try {
    await pool.query(
      `INSERT INTO activity_log (agent_name, action, entity_type, entity_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      ['cleo', 'message_processed', 'lead', leadId, JSON.stringify({ messageId })]
    );
  } catch (error) {
    // Ignore duplicate errors
  }
}

/**
 * Parse email address from "Name <email>" format
 */
function parseEmailAddress(fromStr) {
  if (!fromStr) return null;
  
  // Already an email
  if (fromStr.includes('@') && !fromStr.includes('<')) {
    return fromStr.trim();
  }
  
  // Extract from "Name <email>" format
  const match = fromStr.match(/<([^>]+)>/);
  if (match) {
    return match[1].trim();
  }
  
  return null;
}

/**
 * Main reply monitor
 */
async function checkReplies() {
  console.log('\n📬 Checking Cleo inbox for replies...\n');
  
  const startTime = Date.now();
  
  // Get Cleo's inbox
  const inboxId = await getCleoInboxId();
  console.log(`   ✓ Connected to inbox: cleo-nodevs@agentmail.to`);
  
  // Fetch recent messages
  const allMessages = await fetchMessages(inboxId);
  console.log(`   ✓ Found ${allMessages.length} message(s) in last 24h`);
  
  // Filter for INBOUND messages only (replies TO cleo-nodevs@agentmail.to)
  const inboundMessages = allMessages.filter(msg => {
    const toField = Array.isArray(msg.to) ? msg.to : [msg.to].filter(Boolean);
    return toField.some(recipient => 
      recipient.includes('cleo-nodevs@agentmail.to') || recipient.includes('cleo@agentmail.to')
    );
  });
  
  console.log(`   ✓ ${inboundMessages.length} inbound reply(s) to process\n`);
  
  let newReplies = 0;
  let hotLeads = 0;
  let processedCount = 0;
  let noMatchCount = 0;
  
  // Process each inbound message
  for (const msg of inboundMessages) {
    const messageId = msg.messageId || msg.id;
    
    // Skip if already processed
    if (messageId) {
      const alreadyProcessed = await isMessageProcessed(messageId);
      if (alreadyProcessed) {
        processedCount++;
        continue;
      }
    }
    
    // Parse sender email from "Name <email>" format
    const senderEmail = parseEmailAddress(msg.from);
    if (!senderEmail) {
      console.log(`   ⚠ Skip: Cannot parse sender from "${msg.from}"`);
      continue;
    }
    
    // Find matching lead
    const lead = await findLeadByEmail(senderEmail);
    if (!lead) {
      console.log(`   ⚠ No lead found for: ${senderEmail}`);
      noMatchCount++;
      continue;
    }
    
    // Get reply text (prefer plain text, fallback to HTML stripped)
    const replyText = msg.text || (msg.html ? msg.html.replace(/<[^>]*>/g, '') : '') || '';
    if (!replyText.trim()) {
      console.log(`   ⚠ Empty reply from: ${senderEmail}`);
      continue;
    }
    
    // Check if hot lead
    const hot = isHotLead(replyText);
    
    // Update lead record
    const updateResult = await updateLeadWithReply(lead.id, replyText, hot);
    
    if (updateResult.success) {
      newReplies++;
      if (hot) hotLeads++;
      
      const hotFlag = hot ? ' 🔥' : '';
      console.log(`   ✓ ${lead.name} (${lead.email})${hotFlag} → ${updateResult.newStatus}`);
      
      // Mark as processed
      if (messageId) {
        await markMessageProcessed(messageId, lead.id);
      }
    } else {
      console.log(`   ✗ Failed to update ${lead.email}: ${updateResult.error}`);
    }
  }
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  
  console.log('\n📊 Reply Monitor Results:');
  console.log(`   Total messages scanned: ${allMessages.length}`);
  console.log(`   Inbound replies to process: ${inboundMessages.length}`);
  console.log(`   New replies processed: ${newReplies}`);
  console.log(`   Hot leads identified: ${hotLeads}`);
  console.log(`   Already processed: ${processedCount}`);
  console.log(`   No lead match (bounces/system): ${noMatchCount}`);
  console.log(`   Duration: ${duration}s\n`);
  
  if (hotLeads > 0) {
    console.log(`🔥 ${hotLeads} hot lead(s) flagged for Larry!\n`);
  }
  
  if (newReplies === 0 && inboundMessages.length === 0) {
    console.log('💤 No new replies since last check. Monitoring continues...\n');
  }
  
  return {
    newReplies,
    hotLeads,
    processedCount,
    noMatchCount,
    duration
  };
}

// CLI execution
if (require.main === module) {
  checkReplies()
    .then(() => {
      console.log('✅ Reply check complete\n');
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

module.exports = { checkReplies };

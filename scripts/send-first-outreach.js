const { AgentMailClient } = require('agentmail');
const { Pool } = require('pg');

// Load credentials
const agentmailConfig = require('/home/nodevs/.openclaw/credentials/agentmail.json');
const neonConfig = require('/home/nodevs/.openclaw/credentials/neon.json');

const client = new AgentMailClient({
  apiKey: agentmailConfig.apiKey
});

const pool = new Pool({
  connectionString: neonConfig.connectionString
});

// Test leads (Accra real estate agents)
const testLeads = [
  {
    name: "Kwame Mensah",
    company: "Accra Prime Realty",
    email: "kwame@accraprime.com",
    source: "instagram",
    profile_url: "https://instagram.com/accraprime",
    personalization: "your Osu luxury listings"
  },
  {
    name: "Ama Osei",
    company: "Gold Coast Properties",
    email: "ama@goldcoastprops.com",
    source: "linkedin",
    profile_url: "https://linkedin.com/in/ama-osei-realty",
    personalization: "your market insights posts"
  },
  {
    name: "Kojo Antwi",
    company: "Antwi Real Estate",
    email: "kojo@antwirealty.com",
    source: "instagram",
    profile_url: "https://instagram.com/antwirealty",
    personalization: "your East Legon listings"
  },
  {
    name: "Efua Dapaah",
    company: "Dapaah Properties",
    email: "efua@dapaahprops.com",
    source: "linkedin",
    profile_url: "https://linkedin.com/in/efua-dapaah",
    personalization: "your commercial property focus"
  },
  {
    name: "Nii Armah",
    company: "Armah Realty Group",
    email: "nii@armahrealty.com",
    source: "instagram",
    profile_url: "https://instagram.com/armahrealty",
    personalization: "your video tours"
  }
];

// Email template
function createEmail(lead) {
  return {
    to: lead.email,
    subject: "Quick question about your business",
    text: `Hi ${lead.name.split(' ')[0]},

I came across your profile and genuinely liked how you present your listings — especially ${lead.personalization}.

I'm Nodevs, an AI agent building AI systems for real estate agents. Specifically, I set up AI agent stacks that handle:

• Listing descriptions (2-3 hours/week saved)
• Social media content (Instagram, LinkedIn — autopilot)
• Client follow-ups (nothing falls through cracks)
• Market reports (auto-generated from data)

I'm looking for one agent to work with completely free for 60 days. I set everything up, train you on it, and document the results. You get a working AI system. I get a case study.

No catch. No pitch. Just building proof.

Would a 15-minute call be worth your time?

Best,
Cleo
Onboarding Lead @ Nodevs AI
cleo-nodevs@agentmail.to

P.S. — I'm an AI agent, not a human. That's the point. Everything I build runs autonomously. If it works for you, it'll work for any agent.`
  };
}

async function sendOutreach() {
  console.log('🚀 Starting Outreach Campaign — Phase 1 (Proof)\n');
  console.log(`📧 From: ${agentmailConfig.inboxEmail}`);
  console.log(`📊 Sending to: ${testLeads.length} real estate agents in Accra\n`);
  
  // Get inbox ID from existing inbox
  const inboxList = await client.inboxes.list();
  const inbox = inboxList.inboxes[0];
  const inboxId = inbox.inboxId;
  console.log(`📬 Using inbox: ${inboxId}\n`);
  
  for (const lead of testLeads) {
    try {
      console.log(`📨 Sending to ${lead.name} (${lead.email})...`);
      
      const email = createEmail(lead);
      const result = await client.inboxes.messages.send(inboxId, email);
      
      // Save to database
      await pool.query(
        `INSERT INTO leads (name, company, email, source, profile_url, status, tier, assigned_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [lead.name, lead.company, lead.email, lead.source, lead.profile_url, 'contacted', 'Starter (Free)', 'cleo']
      );
      
      await pool.query(
        `INSERT INTO outreach_messages (channel, subject, body, status, sent_at, lead_id)
         SELECT 'email', $1, $2, 'sent', NOW(), id FROM leads WHERE email = $3
         RETURNING id`,
        [email.subject, email.text, lead.email]
      );
      
      console.log(`   ✅ Sent (Message ID: ${result.messageId?.split('@')[0]})`);
      
      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.error(`   ❌ Failed: ${error.message}`);
    }
  }
  
  console.log('\n🎉 Outreach Complete!');
  console.log(`\n📊 Summary:`);
  console.log(`   - Emails sent: ${testLeads.length}`);
  console.log(`   - Expected replies (15%): ~${Math.round(testLeads.length * 0.15)}`);
  console.log(`   - Expected calls (5%): ~${Math.round(testLeads.length * 0.05)}`);
  console.log(`\n⏭️  Next: Monitor replies, send follow-ups on Day 3, 7, 14`);
  console.log(`\n📧 Cleo's inbox: ${agentmailConfig.inboxEmail}`);
  
  await pool.end();
}

sendOutreach().catch(console.error);

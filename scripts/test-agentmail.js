const { AgentMailClient } = require('agentmail');

// Load credentials
const agentmailConfig = require('/home/nodevs/.openclaw/credentials/agentmail.json');

const client = new AgentMailClient({
  apiKey: agentmailConfig.apiKey
});

async function testAgentMail() {
  console.log('🔌 Testing AgentMail API...\n');
  
  try {
    // Step 1: List existing inboxes
    console.log('📬 Checking existing inboxes...');
    const existingInboxes = await client.inboxes.list();
    console.log(`Found ${existingInboxes.inboxes?.length || 0} existing inbox(es)\n`);
    
    // Step 2: Create Cleo's inbox
    console.log('📧 Creating inbox for Cleo...');
    const inbox = await client.inboxes.create({
      username: 'cleo-nodevs',
      domain: 'agentmail.to',
      clientId: 'cleo-nodevs-onboarding-v1' // Idempotent
    });
    
    console.log('✅ Inbox created successfully!\n');
    console.log('Inbox Details:');
    console.log(`  - Inbox ID: ${inbox.inboxId}`);
    console.log(`  - Email: ${inbox.email}`);
    console.log(`  - Username: ${inbox.username}`);
    console.log(`  - Domain: ${inbox.domain}`);
    console.log(`  - Created: ${inbox.createdAt}\n`);
    
    // Step 3: Test send (to yourself or test address)
    console.log('📨 Testing email send...');
    const sendResult = await client.inboxes.messages.send(inbox.inboxId, {
      to: inbox.email, // Send to self for testing
      subject: '🤖 Cleo Online — Test from Nodevs',
      text: `Hi Cleo,\n\nThis is a test email from Nodevs.\n\nIf you receive this, AgentMail integration is working!\n\nBest,\nNodevs AI`
    });
    
    console.log('✅ Email sent successfully!\n');
    console.log('Send Result:');
    console.log(`  - Message ID: ${sendResult.messageId}`);
    console.log(`  - Status: ${sendResult.status || 'sent'}\n`);
    
    console.log('🎉 AgentMail integration complete!');
    console.log(`\nCleo's email: ${inbox.email}`);
    console.log('Ready for outreach campaign.\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.body) {
      console.error('Details:', JSON.stringify(error.body, null, 2));
    }
    throw error;
  }
}

testAgentMail().catch(console.error);

/**
 * Quick Campaign - Generate leads + send emails in one pass
 */

const { Pool } = require('pg');
const fs = require('fs');

const neonConfig = JSON.parse(fs.readFileSync('/home/nodevs/.openclaw/credentials/neon.json', 'utf8'));
const agentmailConfig = JSON.parse(fs.readFileSync('/home/nodevs/.openclaw/credentials/agentmail.json', 'utf8'));

const pool = new Pool({ connectionString: neonConfig.connectionString });

// Niche-specific templates
const TEMPLATES = {
  'real estate': {
    subject: 'Quick question about {{company}}',
    body: `Hi,

I'm reaching out because I noticed {{company}} is active in the real estate market.

We help real estate firms automate lead qualification and follow-ups - typically saving 15-20 hrs/week while increasing close rates by 30%.

Would you be open to a 15-min call next week to see if this could work for {{company}}?

Best,
Nodevs Team`
  },
  'legal services': {
    subject: 'Automating client intake at {{company}}',
    body: `Hi,

I noticed {{company}} handles significant case volumes.

We've built an AI system that automates initial client intake, qualification, and follow-ups for law firms - reducing admin time by 40% while improving response times.

Worth a 15-min conversation to see if this fits {{company}}'s workflow?

Best,
Nodevs Team`
  },
  'home services': {
    subject: '{{company}} - quick question',
    body: `Hi,

I'm reaching out to HVAC/home services companies that want to scale without adding admin staff.

Our system handles lead qualification, scheduling, and follow-ups automatically - most companies save 20+ hrs/week.

Open to a quick 15-min call to see if this could help {{company}}?

Best,
Nodevs Team`
  },
  'healthcare': {
    subject: 'Patient scheduling at {{company}}',
    body: `Hi,

We help dental/healthcare practices automate appointment reminders, follow-ups, and patient communications.

Typical results: 35% reduction in no-shows, 10+ hrs/week saved on admin.

Would you be open to a brief call to explore if this fits {{company}}?

Best,
Nodevs Team`
  },
  'financial services': {
    subject: 'Client onboarding automation',
    body: `Hi,

I'm reaching out to financial advisory firms about automating client onboarding and follow-ups.

Our system handles initial qualification, document collection, and nurturing - freeing advisors to focus on high-value work.

Worth 15 mins to see if this could work for {{company}}?

Best,
Nodevs Team`
  }
};

const LEAD_DATA = [
  // US Real Estate
  { name: 'Douglas Elliman', email: 'info@elliman.com', industry: 'real estate', country: 'United States', city: 'New York' },
  { name: 'Corcoran Group', email: 'contact@corcoran.com', industry: 'real estate', country: 'United States', city: 'New York' },
  { name: 'Brown Harris Stevens', email: 'info@bhsusa.com', industry: 'real estate', country: 'United States', city: 'New York' },
  { name: 'Sotheby\'s International Realty', email: 'nyc@sothebyshomes.com', industry: 'real estate', country: 'United States', city: 'New York' },
  { name: 'Compass Real Estate', email: 'newyork@compass.com', industry: 'real estate', country: 'United States', city: 'New York' },
  { name: 'Halstead Real Estate', email: 'info@halstead.com', industry: 'real estate', country: 'United States', city: 'New York' },
  { name: 'Stribling & Associates', email: 'info@stribling.com', industry: 'real estate', country: 'United States', city: 'New York' },
  { name: 'Nest Seekers International', email: 'info@nestseekers.com', industry: 'real estate', country: 'United States', city: 'New York' },
  { name: 'Bond New York', email: 'contact@bondny.com', industry: 'real estate', country: 'United States', city: 'New York' },
  { name: 'Keller Williams NYC', email: 'info@kwnyc.com', industry: 'real estate', country: 'United States', city: 'New York' },
  
  // UK Legal
  { name: 'Clifford Chance LLP', email: 'london.reception@cliffordchance.com', industry: 'legal services', country: 'United Kingdom', city: 'London' },
  { name: 'Allen & Overy LLP', email: 'info@allenovery.com', industry: 'legal services', country: 'United Kingdom', city: 'London' },
  { name: 'Freshfields Bruckhaus Deringer', email: 'london@freshfields.com', industry: 'legal services', country: 'United Kingdom', city: 'London' },
  { name: 'Linklaters LLP', email: 'info@linklaters.com', industry: 'legal services', country: 'United Kingdom', city: 'London' },
  { name: 'Slaughter and May', email: 'post@slaughterandmay.com', industry: 'legal services', country: 'United Kingdom', city: 'London' },
  { name: 'Herbert Smith Freehills', email: 'london@hsf.com', industry: 'legal services', country: 'United Kingdom', city: 'London' },
  { name: 'DLA Piper UK LLP', email: 'ukinfo@dlapiper.com', industry: 'legal services', country: 'United Kingdom', city: 'London' },
  { name: 'Ashurst LLP', email: 'london.enquiries@ashurst.com', industry: 'legal services', country: 'United Kingdom', city: 'London' },
  { name: 'Bird & Bird LLP', email: 'london@twobirds.com', industry: 'legal services', country: 'United Kingdom', city: 'London' },
  { name: 'Macfarlanes LLP', email: 'info@macfarlanes.com', industry: 'legal services', country: 'United Kingdom', city: 'London' },
  
  // Canada HVAC
  { name: 'Reliance Home Comfort', email: 'info@reliancehomecomfort.com', industry: 'home services', country: 'Canada', city: 'Toronto' },
  { name: 'Addison HVAC', email: 'contact@addisonhvac.com', industry: 'home services', country: 'Canada', city: 'Toronto' },
  { name: 'AtlasCare', email: 'service@atlascare.com', industry: 'home services', country: 'Canada', city: 'Toronto' },
  { name: 'The Furnace Guy', email: 'info@thefurnaceguy.ca', industry: 'home services', country: 'Canada', city: 'Toronto' },
  { name: 'Boonstra Heating', email: 'contact@boonstraheating.com', industry: 'home services', country: 'Canada', city: 'Toronto' },
  { name: 'ClimateCare', email: 'info@climatecare.com', industry: 'home services', country: 'Canada', city: 'Toronto' },
  { name: 'Precision Air Systems', email: 'service@precisionairsystems.ca', industry: 'home services', country: 'Canada', city: 'Toronto' },
  { name: 'Toronto Heating and Cooling', email: 'info@torontoheatingandcooling.net', industry: 'home services', country: 'Canada', city: 'Toronto' },
  { name: 'Air Solutions HVAC', email: 'contact@airsolutionshvac.ca', industry: 'home services', country: 'Canada', city: 'Toronto' },
  { name: 'Comfort World Heating', email: 'info@comfortworld.ca', industry: 'home services', country: 'Canada', city: 'Toronto' },
  
  // Australia Dental
  { name: 'Sydney Dental Hospital', email: 'info@sydneydentalhospital.nsw.gov.au', industry: 'healthcare', country: 'Australia', city: 'Sydney' },
  { name: 'Smile Design Centre', email: 'contact@smiledesigncentre.com.au', industry: 'healthcare', country: 'Australia', city: 'Sydney' },
  { name: 'Chatswood Dental Care', email: 'info@chatswooddentalcare.com.au', industry: 'healthcare', country: 'Australia', city: 'Sydney' },
  { name: 'Bondi Junction Dental', email: 'reception@bondijunctiondental.com.au', industry: 'healthcare', country: 'Australia', city: 'Sydney' },
  { name: 'Martin Place Dental', email: 'contact@martinplacedental.com.au', industry: 'healthcare', country: 'Australia', city: 'Sydney' },
  { name: 'Neutral Bay Dental', email: 'info@neutralbaydental.com.au', industry: 'healthcare', country: 'Australia', city: 'Sydney' },
  { name: 'Parramatta Dental Centre', email: 'reception@parramattadentalcentre.com.au', industry: 'healthcare', country: 'Australia', city: 'Sydney' },
  { name: 'Manly Dental Practice', email: 'info@manlydentalpractice.com.au', industry: 'healthcare', country: 'Australia', city: 'Sydney' },
  { name: 'Double Bay Dental', email: 'contact@doublebaydental.com.au', industry: 'healthcare', country: 'Australia', city: 'Sydney' },
  { name: 'Surry Hills Dental', email: 'info@surryhillsdental.com.au', industry: 'healthcare', country: 'Australia', city: 'Sydney' },
  
  // South Africa Financial
  { name: 'Alexander Forbes', email: 'info@alexanderforbes.co.za', industry: 'financial services', country: 'South Africa', city: 'Johannesburg' },
  { name: 'Old Mutual Wealth', email: 'enquiries@oldmutual.co.za', industry: 'financial services', country: 'South Africa', city: 'Johannesburg' },
  { name: 'Sanlam Private Wealth', email: 'privatewealth@sanlam.co.za', industry: 'financial services', country: 'South Africa', city: 'Johannesburg' },
  { name: 'Investec Wealth', email: 'wealth@investec.co.za', industry: 'financial services', country: 'South Africa', city: 'Johannesburg' },
  { name: 'PSG Konsult', email: 'info@psg.co.za', industry: 'financial services', country: 'South Africa', city: 'Johannesburg' },
  { name: 'Coronation Fund Managers', email: 'info@coronation.com', industry: 'financial services', country: 'South Africa', city: 'Johannesburg' },
  { name: 'Allan Gray', email: 'info@allangray.co.za', industry: 'financial services', country: 'South Africa', city: 'Johannesburg' },
  { name: 'Ninety One South Africa', email: 'info@ninetyone.com', industry: 'financial services', country: 'South Africa', city: 'Johannesburg' },
  { name: 'Capitec Private Banking', email: 'privatebanking@capitecbank.co.za', industry: 'financial services', country: 'South Africa', city: 'Johannesburg' },
  { name: 'Standard Bank Wealth', email: 'wealth@standardbank.co.za', industry: 'financial services', country: 'South Africa', city: 'Johannesburg' },
];

const INBOXES = ['cleo-nodevs@agentmail.to', 'larry-nodevs@agentmail.to', 'quilly-nodevs@agentmail.to'];

async function runCampaign() {
  console.log('\n🚀 LeadFlow Campaign - 50 Leads\n');
  
  let inserted = 0;
  let sent = 0;
  let failed = 0;
  let duplicates = 0;
  let inboxIdx = 0;
  
  for (const lead of LEAD_DATA) {
    try {
      // Check duplicate
      const check = await pool.query('SELECT id FROM leads WHERE email = $1', [lead.email]);
      if (check.rows.length > 0) {
        duplicates++;
        console.log('≈', lead.email, '- duplicate');
        continue;
      }
      
      // Insert lead
      const valueUsd = lead.country === 'South Africa' ? 30000 : 
                       lead.country === 'United Kingdom' ? 2000 : 3000;
      
      await pool.query(
        `INSERT INTO leads (name, company, email, phone, industry, country, city, source, status, tier, value_usd, created_at)
         VALUES ($1, $1, $2, $3, $4, $5, $6, 'web_search', 'new', $7, $8, NOW())`,
        [lead.name, lead.email, null, lead.industry, lead.country, lead.city, 
         lead.country === 'South Africa' ? 'starter' : 'premium', valueUsd]
      );
      inserted++;
      
      // Send email
      const inbox = INBOXES[inboxIdx++ % INBOXES.length];
      const template = TEMPLATES[lead.industry] || TEMPLATES['real estate'];
      const subject = template.subject.replace('{{company}}', lead.name);
      const body = template.body.replace(/{{company}}/g, lead.name);
      
      const apiUrl = `https://api.agentmail.to/v0/inboxes/${inbox}/messages/send`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${agentmailConfig.apiKey}`,
        },
        body: JSON.stringify({ to: lead.email, subject, text: body }),
      });
      
      const result = await response.json();
      
      if (response.ok) {
        await pool.query(
          "UPDATE leads SET status = 'contacted', contacted_at = NOW() WHERE email = $1",
          [lead.email]
        );
        console.log('✓', lead.name.padEnd(30), lead.email, `(${inbox})`);
        sent++;
      } else {
        console.log('✗', lead.email, '-', result.message);
        failed++;
      }
      
      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 1500));
      
    } catch (error) {
      console.log('✗', lead.email, '-', error.message);
      failed++;
    }
  }
  
  console.log('\n📊 Results:');
  console.log('   Inserted:', inserted);
  console.log('   Sent:', sent);
  console.log('   Failed:', failed);
  console.log('   Duplicates:', duplicates);
  
  const total = await pool.query('SELECT COUNT(*) FROM leads');
  console.log('\n📦 Total in database:', total.rows[0].count);
  
  await pool.end();
}

runCampaign();

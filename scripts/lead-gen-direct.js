/**
 * LeadFlow High-Volume Lead Generator - Direct Mode
 * 
 * Designed to be run BY an OpenClaw agent with web_search tool access
 * The agent calls web_search directly, this script processes results and inserts to DB
 * 
 * Usage: Agent calls web_search, then passes results to this script via stdin or args
 */

const { Pool } = require('pg');
const fs = require('fs');

// Load Neon credentials
const neonConfig = JSON.parse(
  fs.readFileSync('/home/nodevs/.openclaw/credentials/neon.json', 'utf8')
);
const pool = new Pool({ connectionString: neonConfig.connectionString });

// ═══════════════════════════════════════════════════════════════
// TARGET MARKETS
// ═══════════════════════════════════════════════════════════════
const TARGET_MARKETS = [
  { country: 'United States', code: 'US', currency: 'USD', minDeal: 3000, cities: ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Miami', 'Dallas', 'Atlanta'] },
  { country: 'United Kingdom', code: 'GB', currency: 'GBP', minDeal: 2000, cities: ['London', 'Manchester', 'Birmingham', 'Leeds', 'Liverpool', 'Bristol'] },
  { country: 'Canada', code: 'CA', currency: 'CAD', minDeal: 3000, cities: ['Toronto', 'Vancouver', 'Montreal', 'Calgary'] },
  { country: 'Australia', code: 'AU', currency: 'AUD', minDeal: 3000, cities: ['Sydney', 'Melbourne', 'Brisbane', 'Perth'] },
  { country: 'South Africa', code: 'ZA', currency: 'ZAR', minDeal: 30000, cities: ['Johannesburg', 'Cape Town', 'Durban', 'Pretoria'] },
  { country: 'Singapore', code: 'SG', currency: 'SGD', minDeal: 4000, cities: ['Singapore'] },
  { country: 'United Arab Emirates', code: 'AE', currency: 'AED', minDeal: 10000, cities: ['Dubai', 'Abu Dhabi'] },
  { country: 'Ghana', code: 'GH', currency: 'GHS', minDeal: 5000, cities: ['Accra', 'Kumasi'] },
  { country: 'Nigeria', code: 'NG', currency: 'NGN', minDeal: 500000, cities: ['Lagos', 'Abuja'] },
  { country: 'Kenya', code: 'KE', currency: 'KES', minDeal: 50000, cities: ['Nairobi', 'Mombasa'] },
];

// ═══════════════════════════════════════════════════════════════
// TARGET INDUSTRIES
// ═══════════════════════════════════════════════════════════════
const TARGET_INDUSTRIES = [
  { niche: 'real estate', keywords: ['real estate agency', 'property management', 'realtor', 'real estate broker', 'estate agents'], priority: 1 },
  { niche: 'legal services', keywords: ['law firm', 'attorney', 'legal services', 'solicitor', 'law office'], priority: 2 },
  { niche: 'healthcare', keywords: ['medical clinic', 'dental practice', 'dentist', 'healthcare services', 'medical center'], priority: 2 },
  { niche: 'home services', keywords: ['HVAC company', 'plumbing services', 'electrical contractor', 'home improvement', 'contractor'], priority: 2 },
  { niche: 'financial services', keywords: ['financial advisor', 'accounting firm', 'tax services', 'wealth management', 'CPA'], priority: 3 },
  { niche: 'e-commerce', keywords: ['online store', 'ecommerce business', 'shopify store', 'online retail', 'boutique online'], priority: 3 },
  { niche: 'professional services', keywords: ['business consulting', 'marketing agency', 'consulting firm', 'digital agency'], priority: 3 },
  { niche: 'automotive', keywords: ['car dealership', 'auto repair shop', 'garage', 'used cars', 'auto service'], priority: 3 },
];

/**
 * Generate search queries
 */
function generateQueries(market, industry, count = 3) {
  const queries = [];
  const cities = market.cities.slice(0, 3);
  
  for (const city of cities) {
    for (const keyword of industry.keywords.slice(0, 2)) {
      queries.push(`${keyword} in ${city} email contact`);
      queries.push(`best ${keyword} ${city}`);
      queries.push(`${keyword} ${city} phone number`);
    }
  }
  
  return queries.slice(0, count);
}

/**
 * Parse search result into lead object
 */
function parseLeadFromSnippet(snippet, url, market, industry) {
  let companyName = snippet.split('.')[0].split('-')[0].split('|')[0].trim();
  if (companyName.length < 3 || companyName.length > 60) {
    const urlMatch = url.match(/(?:https?:\/\/)?(?:www\.)?([^\/]+)/);
    companyName = urlMatch ? urlMatch[1] : 'Unknown Company';
  }
  companyName = companyName.replace(/[^a-zA-Z0-9\s\&\-\']/g, '').trim();
  
  const emailMatch = snippet.match(/[\w.-]+@[\w.-]+\.\w+/);
  const email = emailMatch ? emailMatch[0] : null;
  
  const phonePatterns = [
    /[\+]?[\d\s\-\(\)]{10,}/,
    /\+\d{1,3}[\s\-]?\d{3,4}[\s\-]?\d{3,4}[\s\-]?\d{3,4}/,
  ];
  let phone = null;
  for (const pattern of phonePatterns) {
    const match = snippet.match(pattern);
    if (match) {
      phone = match[0].trim();
      break;
    }
  }
  
  return {
    company_name: companyName,
    website: url,
    email: email,
    phone: phone,
    industry: industry.niche,
    country: market.country,
    city: market.cities[0],
    currency: market.currency,
    min_deal_value: market.minDeal,
    source: 'automated_search',
    status: 'new',
    tier: (market.country === 'US' || market.country === 'UK' || market.country === 'Canada' || market.country === 'Australia') ? 'premium' : 'starter',
  };
}

/**
 * Insert lead into database (skip duplicates)
 */
async function insertLead(lead) {
  try {
    if (!lead.email) {
      return { inserted: false, reason: 'no_email' };
    }
    
    const checkResult = await pool.query(
      'SELECT id FROM leads WHERE email = $1 OR website = $2 LIMIT 1',
      [lead.email, lead.website]
    );
    
    if (checkResult.rows.length > 0) {
      return { inserted: false, reason: 'duplicate' };
    }
    
    const result = await pool.query(
      `INSERT INTO leads (
        name, company, email, phone, industry, country, city,
        currency, value_usd, source, status, tier, created_at
      ) VALUES ($1, $1, $2, $3, $4, $5, $6, $7, $8, $9, 'new', $10, NOW())
      RETURNING id`,
      [
        lead.company_name, lead.email, lead.phone,
        lead.industry, lead.country, lead.city, lead.currency,
        lead.min_deal_value, lead.source, lead.tier
      ]
    );
    
    return { inserted: true, id: result.rows[0].id };
  } catch (error) {
    return { inserted: false, reason: error.message };
  }
}

/**
 * Process search results
 */
async function processSearchResults(results, market, industry) {
  let inserted = 0;
  let duplicates = 0;
  let noEmail = 0;
  
  for (const result of results) {
    const snippet = result.snippet || result.description || '';
    const url = result.url || '';
    
    if (!snippet || !url) continue;
    
    const lead = parseLeadFromSnippet(snippet, url, market, industry);
    const insertResult = await insertLead(lead);
    
    if (insertResult.inserted) {
      inserted++;
      console.log(`   ✓ ${lead.company_name} - ${lead.email} (${market.country}, ${industry.niche})`);
    } else if (insertResult.reason === 'duplicate') {
      duplicates++;
    } else if (insertResult.reason === 'no_email') {
      noEmail++;
    }
  }
  
  return { inserted, duplicates, noEmail };
}

// Export for use by agent
module.exports = {
  TARGET_MARKETS,
  TARGET_INDUSTRIES,
  generateQueries,
  parseLeadFromSnippet,
  insertLead,
  processSearchResults,
  pool
};

// CLI mode: just check DB connection
if (require.main === module) {
  pool.query('SELECT COUNT(*) FROM leads')
    .then(result => {
      console.log(`✓ Neon DB connected`);
      console.log(`✓ Current leads: ${result.rows[0].count}`);
      console.log(`✓ Ready to process leads when called by agent`);
      process.exit(0);
    })
    .catch(error => {
      console.error(`✗ Database error: ${error.message}`);
      process.exit(1);
    })
    .finally(() => pool.end());
}

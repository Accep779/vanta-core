/**
 * LeadFlow High-Volume Lead Generator - Cron Version
 * 
 * Generates 150 BANT-qualified leads using web_search tool
 * Called by cron job with OpenClaw agent access
 * 
 * Usage: node lead-gen-cron.js [target_count]
 */

const { Pool } = require('pg');
const fs = require('fs');
const { execSync } = require('child_process');

// Load Neon credentials
const neonConfig = JSON.parse(
  fs.readFileSync('/home/nodevs/.openclaw/credentials/neon.json', 'utf8')
);
const pool = new Pool({ connectionString: neonConfig.connectionString });

// ═══════════════════════════════════════════════════════════════
// TARGET MARKETS — Prioritized
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
// TARGET INDUSTRIES — 8 niches
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

// Stats tracking
const stats = {
  inserted: 0,
  duplicates: 0,
  noEmail: 0,
  queriesProcessed: 0,
  byNiche: {},
  byMarket: {},
};

TARGET_INDUSTRIES.forEach(i => stats.byNiche[i.niche] = 0);
TARGET_MARKETS.forEach(m => stats.byMarket[m.country] = 0);

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
 * Call web_search via OpenClaw tool
 */
async function webSearch(query, country, count = 10) {
  try {
    // Use OpenClaw's web_search via exec
    const cmd = `node -e "
      const { web_search } = require('/home/nodevs/.openclaw/workspace/vanta-core/tools.js');
      web_search({ query: '${query.replace(/'/g, "\\'")}', country: '${country}', count: ${count} })
        .then(r => console.log(JSON.stringify(r)))
        .catch(e => console.error(JSON.stringify({ error: e.message })));
    "`;
    
    const output = execSync(cmd, { encoding: 'utf8', timeout: 15000 });
    const result = JSON.parse(output.trim());
    
    if (result.error) {
      console.log(`   ✗ Search failed: ${result.error}`);
      return [];
    }
    
    return result.web?.results || result || [];
  } catch (error) {
    console.log(`   ✗ Search error: ${error.message}`);
    return [];
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
      stats.inserted++;
      stats.byNiche[industry.niche]++;
      stats.byMarket[market.country]++;
      console.log(`   ✓ ${lead.company_name} - ${lead.email} (${market.country}, ${industry.niche})`);
    } else if (insertResult.reason === 'duplicate') {
      duplicates++;
      stats.duplicates++;
    } else if (insertResult.reason === 'no_email') {
      noEmail++;
      stats.noEmail++;
    }
  }
  
  return { inserted, duplicates, noEmail };
}

/**
 * Main lead generation function
 */
async function generateLeads(targetCount = 150, maxQueries = 300) {
  console.log(`\n🎯 Generating ${targetCount} leads...\n`);
  console.log(`   Markets: ${TARGET_MARKETS.slice(0, 5).map(m => m.country).join(', ')}...`);
  console.log(`   Industries: ${TARGET_INDUSTRIES.map(i => i.niche).join(', ')}\n`);
  
  // Check DB connection
  try {
    const total = await pool.query('SELECT COUNT(*) FROM leads');
    console.log(`   📦 Current leads in database: ${total.rows[0].count}\n`);
  } catch (error) {
    console.error(`   ✗ Database error: ${error.message}`);
    process.exit(1);
  }
  
  // Rotate through markets and industries
  for (let industryIdx = 0; industryIdx < TARGET_INDUSTRIES.length; industryIdx++) {
    const industry = TARGET_INDUSTRIES[industryIdx];
    
    for (let marketIdx = 0; marketIdx < TARGET_MARKETS.length; marketIdx++) {
      const market = TARGET_MARKETS[marketIdx];
      
      if (stats.inserted >= targetCount) {
        console.log(`\n   ✅ Target reached (${stats.inserted} leads)`);
        break;
      }
      
      if (stats.queriesProcessed >= maxQueries) {
        console.log(`\n   ⚠️  Max queries reached (${maxQueries})`);
        break;
      }
      
      const queries = generateQueries(market, industry, 3);
      
      for (const query of queries) {
        if (stats.inserted >= targetCount || stats.queriesProcessed >= maxQueries) break;
        
        console.log(`   Searching: ${query}`);
        stats.queriesProcessed++;
        
        const results = await webSearch(query, market.code, 10);
        await processSearchResults(results, market, industry);
      }
    }
    
    if (stats.inserted >= targetCount) break;
  }
  
  // Print summary
  console.log(`\n📊 Lead Gen Results:`);
  console.log(`   Inserted: ${stats.inserted}`);
  console.log(`   Duplicates: ${stats.duplicates}`);
  console.log(`   No email: ${stats.noEmail}`);
  console.log(`   Queries processed: ${stats.queriesProcessed}`);
  console.log(`   By niche: ${Object.entries(stats.byNiche).map(([k, v]) => `${k} (${v})`).join(', ')}`);
  console.log(`   By market: ${Object.entries(stats.byMarket).filter(([, v]) => v > 0).map(([k, v]) => `${k} (${v})`).join(', ')}`);
  console.log();
  
  return stats;
}

// CLI execution
const targetCount = parseInt(process.argv[2]) || 150;
generateLeads(targetCount)
  .then(() => {
    pool.end();
    process.exit(0);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    pool.end();
    process.exit(1);
  });

# Lead Generation Agent Task

**Goal:** Generate 150 BANT-qualified leads per day for LeadFlow outreach campaign.

---

## Target Markets

| Country | Currency | Min Deal | Priority Cities |
|---------|----------|----------|-----------------|
| Ghana | GHS | ₵5,000 | Accra, Kumasi, Takoradi |
| Nigeria | NGN | ₦500,000 | Lagos, Abuja, Port Harcourt |
| Kenya | KES | KSh50,000 | Nairobi, Mombasa |
| UK | GBP | £2,000 | London, Manchester, Birmingham |
| US | USD | $3,000 | NYC, LA, Chicago, Houston, Miami |
| South Africa | ZAR | R30,000 | Johannesburg, Cape Town |
| Uganda | UGX | USh10M | Kampala |
| Tanzania | TZS | TSh5M | Dar es Salaam |

---

## Target Industries

1. Real estate (agencies, property management, brokers)
2. Legal services (law firms, attorneys, solicitors)
3. Healthcare (clinics, dental practices, private hospitals)
4. Financial services (advisors, accounting, tax, wealth management)
5. E-commerce (online stores, Shopify, WooCommerce)
6. Professional services (consulting, marketing agencies)
7. Home services (HVAC, plumbing, electrical, contractors)
8. Automotive (dealerships, repair shops, garages)

---

## Search Query Patterns

For each market + industry combo, search:

```
"{industry keyword} {city} email contact"
"best {industry keyword} in {city}"
"{industry keyword} {city} phone number"
"{company type} {city} contact email"
```

Examples:
- `real estate agency Accra email contact`
- `law firm Lagos phone number`
- `medical clinic Nairobi contact email`
- `HVAC company London email`

---

## Lead Data Requirements

Extract from search results:

| Field | Required | Notes |
|-------|----------|-------|
| Company name | ✓ | From title/snippet |
| Website | ✓ | From URL |
| Email | ✓ | Skip if no email found |
| Phone | Optional | From snippet |
| Industry | ✓ | Map to 8 categories |
| Country | ✓ | From search target |
| City | ✓ | From search query |
| Currency | ✓ | Auto-fill by country |
| Min deal value | ✓ | Auto-fill by country |

---

## Database Insert

Use Neon DB connection (`/home/nodevs/.openclaw/credentials/neon.json`):

```sql
INSERT INTO leads (
  company_name, website, email, phone, industry, country, city,
  currency, min_deal_value, source, status, tier, created_at
) VALUES (
  $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'new', $11, NOW()
)
ON CONFLICT (email) DO NOTHING;
```

Tier: `premium` for US/UK, `starter` for others.

---

## Execution Steps

1. **Load Neon DB credentials** from `/home/nodevs/.openclaw/credentials/neon.json`
2. **Loop through markets** (8 countries) × **industries** (8 categories)
3. **For each combo**, generate 3-5 search queries
4. **Call `web_search` tool** for each query (count=10, set country parameter)
5. **Parse results** - extract company, email, phone from snippets
6. **Skip** if no email found
7. **Insert** into Neon DB (skip duplicates)
8. **Track progress**: inserted, duplicates, no-email skips
9. **Stop** when 150 leads inserted OR 200 queries processed
10. **Report** results to user

---

## Rate Limits

- web_search: ~100 calls/hour available
- Add 200ms delay between searches
- Max 50 leads per execution (run 3x/day for 150 total)

---

## Sample Output

```
🎯 Generating 50 leads...

   Searching: real estate agency Accra email contact
   ✓ Accra Prime Realty - kwame@accraprime.com (Ghana)
   ✓ Gold Coast Properties - info@goldcoastprops.com (Ghana)
   
   Searching: law firm Lagos phone number
   ✓ Banwo & Ighodalo - contact@banwo-ighodalo.com (Nigeria)
   ≈ Duplicate: already in database
   
   Searching: medical clinic Nairobi contact email
   ✗ No email found in snippet

📊 Results:
   ✓ Inserted: 23
   ≈ Duplicates: 12
   ✗ No email: 15
   Total processed: 50 queries
```

---

## Cron Schedule

- **9:00 AM CET** - 50 leads (Africa focus: GH, NG, KE, ZA, UG, TZ)
- **2:00 PM CET** - 50 leads (UK focus)
- **7:00 PM CET** - 50 leads (US focus)

**Total: 150 leads/day**

---

## Quality Rules

1. **Email required** - no email = skip
2. **No duplicates** - check email + website before insert
3. **Valid company name** - skip generic/gibberish names
4. **Industry mapping** - must match one of 8 categories
5. **BANT check** - company size implied by industry (B2B preferred)

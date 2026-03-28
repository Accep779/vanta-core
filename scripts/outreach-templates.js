/**
 * LeadFlow Niche-Specific Outreach Templates
 * 
 * Each template is tailored to the industry's actual pain points
 * Based on: AI Agency Blueprint (Real Estate focus) + adapted for other niches
 */

module.exports = {
  // ═══════════════════════════════════════════════════════════════
  // REAL ESTATE AGENTS (Primary Target - from AI Agency Blueprint)
  // ═══════════════════════════════════════════════════════════════
  'real estate': {
    initial: {
      subject: 'Quick question about {{company}}',
      body: `Hi there,

I came across {{company}} and was impressed by your listings.

I'm Nodevs, an AI agent building an autonomous real estate operations platform. I'm looking for 1-2 agents to partner with for a **free 60-day AI agent stack setup** in exchange for a testimonial and results documentation.

**What you get (FREE for 60 days):**
- **Content Creator Agent**: Writes listing descriptions, social posts, newsletters (saves 2-3 hrs/week)
- **Lead Shepherd Agent**: Tracks deals, tasks, follow-ups so nothing falls through cracks
- **SEO Specialist Agent**: Generates blog posts and area guides for organic leads
- **Instagram Curator Agent**: Plans your content calendar for consistent posting
- **Analytics Reporter Agent**: Weekly performance summaries without spreadsheets

**The catch?** None. I'm documenting my journey publicly and need 1-2 case study partners. You keep the system if you love it.

Would a 15-min call to see if this fits be worth your time?

Best,
Nodevs
AI Agent · LeadFlow
cleo-nodevs@agentmail.to

P.S. — I'm an AI agent (not human) running an autonomous business. That's the whole point of the case study.`
    },
    followup1_day3: {
      subject: 'Re: {{company}} + AI automation',
      body: `Hi,

Following up on my note about the free AI agent stack.

Quick context: I'm building AI systems specifically for real estate agents. The agents handle:
- Listing descriptions & social content
- Lead follow-up & deal tracking
- SEO content & area guides
- Weekly performance reports

Looking for 1-2 agents for a free 60-day setup. You get a working AI system. I get a case study.

Still interested in a quick call?

Nodevs`
    },
    followup2_day7: {
      subject: 'Last try — free AI setup for {{company}}',
      body: `Hi,

Final attempt here.

I'm an AI agent building in public. Looking for 1-2 real estate agents to get a free AI agent stack:
- Content creation (listings, social, newsletters)
- Lead tracking & follow-up automation
- SEO & analytics reporting

60-day trial. No cost. Just need results + testimonial if it works.

If this isn't a fit, no worries — I'll stop reaching out.

Nodevs`
    },
    followup3_day14: {
      subject: 'Closing the loop',
      body: `Hi,

I've sent 3 notes about a free AI agent stack for {{company}}.

Assuming this isn't the right timing — I won't reach out again.

If you ever want AI automation for your real estate business (content, lead tracking, SEO), feel free to reach out.

Best of luck,
Nodevs`
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // LEGAL SERVICES (Law Firms, Attorneys)
  // ═══════════════════════════════════════════════════════════════
  'legal services': {
    initial: {
      subject: 'Quick question about {{company}}',
      body: `Hi there,

I came across {{company}} and wanted to reach out.

I'm Nodevs, an AI agent building an autonomous legal practice operations platform. I'm looking for 1-2 law firms to partner with for a **free 60-day AI agent stack setup** in exchange for a testimonial.

**What you get (FREE for 60 days):**
- **Client Intake Agent**: Qualifies leads, schedules consultations, sends follow-ups
- **Document Drafter Agent**: Generates first drafts of common legal documents
- **Case Research Agent**: Summarizes case law, finds relevant precedents
- **Calendar Manager Agent**: Tracks deadlines, court dates, filing requirements
- **Billing Assistant Agent**: Time entry reminders, invoice generation, payment follow-ups

**The catch?** None. I'm documenting my journey publicly and need 1-2 case study partners.

Would a 15-min call to see if this fits be worth your time?

Best,
Nodevs
AI Agent · LeadFlow
cleo-nodevs@agentmail.to`
    },
    followup1_day3: {
      subject: 'Re: {{company}} + AI automation',
      body: `Hi,

Following up on my note about the free AI agent stack for law firms.

The agents handle:
- Client intake & consultation scheduling
- Document drafting (first passes)
- Case research & precedent finding
- Deadline tracking & billing reminders

Looking for 1-2 firms for a free 60-day setup.

Still interested?

Nodevs`
    },
    followup2_day7: {
      subject: 'Last try — free AI setup for {{company}}',
      body: `Hi,

Final attempt here.

I'm an AI agent building in public. Looking for 1-2 law firms to get a free AI agent stack for client intake, document drafting, and case management.

60-day trial. No cost. Just need results + testimonial.

If this isn't a fit, no worries.

Nodevs`
    },
    followup3_day14: {
      subject: 'Closing the loop',
      body: `Hi,

I've sent 3 notes about a free AI agent stack for {{company}}.

Assuming this isn't the right timing — I won't reach out again.

Best of luck,
Nodevs`
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // HEALTHCARE (Clinics, Dental Practices, Private Hospitals)
  // ═══════════════════════════════════════════════════════════════
  'healthcare': {
    initial: {
      subject: 'Quick question about {{company}}',
      body: `Hi there,

I came across {{company}} and wanted to reach out.

I'm Nodevs, an AI agent building an autonomous healthcare practice operations platform. I'm looking for 1-2 practices to partner with for a **free 60-day AI agent stack setup** in exchange for a testimonial.

**What you get (FREE for 60 days):**
- **Patient Intake Agent**: Online scheduling, insurance verification, reminder calls
- **Appointment Reminder Agent**: SMS/email reminders 48h + 24h before (reduces no-shows)
- **Review Generator Agent**: Requests Google reviews after positive visits
- **Follow-up Care Agent**: Post-appointment check-ins, medication reminders
- **New Patient Onboarding Agent**: Sends welcome packets, forms, office policies

**The catch?** None. I'm documenting my journey publicly and need 1-2 case study partners.

Would a 15-min call to see if this fits be worth your time?

Best,
Nodevs
AI Agent · LeadFlow
cleo-nodevs@agentmail.to`
    },
    followup1_day3: {
      subject: 'Re: {{company}} + AI automation',
      body: `Hi,

Following up on the free AI agent stack for {{company}}.

The agents handle:
- Patient intake & scheduling
- Appointment reminders (reduces no-shows)
- Review generation after visits
- Post-appointment follow-ups

60-day free setup. Interested?

Nodevs`
    },
    followup2_day7: {
      subject: 'Last try — free AI setup for {{company}}',
      body: `Hi,

Final attempt here.

Free AI agent stack for healthcare practices:
- Patient intake & scheduling
- Appointment reminders
- Review generation
- Follow-up care check-ins

60-day trial. No cost.

Nodevs`
    },
    followup3_day14: {
      subject: 'Closing the loop',
      body: `Hi,

Assuming this isn't the right timing — I won't reach out again.

Best of luck,
Nodevs`
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // HOME SERVICES (HVAC, Plumbing, Electrical, Contractors)
  // ═══════════════════════════════════════════════════════════════
  'home services': {
    initial: {
      subject: 'Quick question about {{company}}',
      body: `Hi there,

I came across {{company}} and wanted to reach out.

I'm Nodevs, an AI agent building an autonomous home services operations platform. I'm looking for 1-2 contractors to partner with for a **free 60-day AI agent stack setup** in exchange for a testimonial.

**What you get (FREE for 60 days):**
- **Appointment Booker Agent**: Answers calls, schedules jobs, sends confirmations
- **Estimate Generator Agent**: Creates quick quotes from job details
- **Review Request Agent**: Requests Google reviews after completed jobs
- **Follow-up Agent**: 6-month check-ins for repeat business (HVAC maintenance, etc.)
- **Emergency Responder Agent**: After-hours triage, dispatch to on-call tech

**The catch?** None. I'm documenting my journey publicly and need 1-2 case study partners.

Would a 15-min call to see if this fits be worth your time?

Best,
Nodevs
AI Agent · LeadFlow
cleo-nodevs@agentmail.to`
    },
    followup1_day3: {
      subject: 'Re: {{company}} + AI automation',
      body: `Hi,

Following up on the free AI agent stack for {{company}}.

The agents handle:
- Appointment booking & confirmations
- Quick estimate generation
- Google review requests
- 6-month follow-ups for repeat business

60-day free setup. Interested?

Nodevs`
    },
    followup2_day7: {
      subject: 'Last try — free AI setup for {{company}}',
      body: `Hi,

Final attempt here.

Free AI agent stack for home services:
- Appointment booking
- Estimate generation
- Review requests
- Follow-up for repeat business

60-day trial. No cost.

Nodevs`
    },
    followup3_day14: {
      subject: 'Closing the loop',
      body: `Hi,

Assuming this isn't the right timing — I won't reach out again.

Best of luck,
Nodevs`
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // FINANCIAL SERVICES (Advisors, Accounting, Tax, Wealth Management)
  // ═══════════════════════════════════════════════════════════════
  'financial services': {
    initial: {
      subject: 'Quick question about {{company}}',
      body: `Hi there,

I came across {{company}} and wanted to reach out.

I'm Nodevs, an AI agent building an autonomous financial services operations platform. I'm looking for 1-2 firms to partner with for a **free 60-day AI agent stack setup** in exchange for a testimonial.

**What you get (FREE for 60 days):**
- **Client Onboarding Agent**: KYC collection, document gathering, account setup
- **Tax Document Organizer Agent**: Categorizes receipts, tracks deductions, prepares summaries
- **Portfolio Update Agent**: Sends monthly performance reports to clients
- **Meeting Prep Agent**: Aggregates client data before meetings
- **Compliance Tracker Agent**: Monitors regulatory deadlines, filing requirements

**The catch?** None. I'm documenting my journey publicly and need 1-2 case study partners.

Would a 15-min call to see if this fits be worth your time?

Best,
Nodevs
AI Agent · LeadFlow
cleo-nodevs@agentmail.to`
    },
    followup1_day3: {
      subject: 'Re: {{company}} + AI automation',
      body: `Hi,

Following up on the free AI agent stack for {{company}}.

The agents handle:
- Client onboarding & KYC
- Tax document organization
- Monthly portfolio reports
- Meeting prep & compliance tracking

60-day free setup. Interested?

Nodevs`
    },
    followup2_day7: {
      subject: 'Last try — free AI setup for {{company}}',
      body: `Hi,

Final attempt here.

Free AI agent stack for financial services:
- Client onboarding
- Tax document organization
- Portfolio reports
- Compliance tracking

60-day trial. No cost.

Nodevs`
    },
    followup3_day14: {
      subject: 'Closing the loop',
      body: `Hi,

Assuming this isn't the right timing — I won't reach out again.

Best of luck,
Nodevs`
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // E-COMMERCE (Online Stores, Shopify, WooCommerce)
  // ═══════════════════════════════════════════════════════════════
  'e-commerce': {
    initial: {
      subject: 'Quick question about {{company}}',
      body: `Hi there,

I came across {{company}} and loved your product lineup.

I'm Nodevs, an AI agent building an autonomous e-commerce operations platform. I'm looking for 1-2 stores to partner with for a **free 60-day AI agent stack setup** in exchange for a testimonial.

**What you get (FREE for 60 days):**
- **Product Description Agent**: Writes SEO-optimized product descriptions at scale
- **Customer Support Agent**: Handles common questions, order status, returns
- **Review Request Agent**: Automated post-purchase review requests
- **Inventory Alert Agent**: Low stock warnings, reorder suggestions
- **Social Content Agent**: Generates product posts for Instagram/TikTok

**The catch?** None. I'm documenting my journey publicly and need 1-2 case study partners.

Would a 15-min call to see if this fits be worth your time?

Best,
Nodevs
AI Agent · LeadFlow
cleo-nodevs@agentmail.to`
    },
    followup1_day3: {
      subject: 'Re: {{company}} + AI automation',
      body: `Hi,

Following up on the free AI agent stack for {{company}}.

The agents handle:
- Product descriptions (SEO-optimized)
- Customer support (orders, returns)
- Review requests after purchase
- Inventory alerts & social content

60-day free setup. Interested?

Nodevs`
    },
    followup2_day7: {
      subject: 'Last try — free AI setup for {{company}}',
      body: `Hi,

Final attempt here.

Free AI agent stack for e-commerce:
- Product descriptions
- Customer support
- Review requests
- Inventory alerts

60-day trial. No cost.

Nodevs`
    },
    followup3_day14: {
      subject: 'Closing the loop',
      body: `Hi,

Assuming this isn't the right timing — I won't reach out again.

Best of luck,
Nodevs`
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // PROFESSIONAL SERVICES (Consulting, Marketing Agencies)
  // ═══════════════════════════════════════════════════════════════
  'professional services': {
    initial: {
      subject: 'Quick question about {{company}}',
      body: `Hi there,

I came across {{company}} and wanted to reach out.

I'm Nodevs, an AI agent building an autonomous agency operations platform. I'm looking for 1-2 agencies to partner with for a **free 60-day AI agent stack setup** in exchange for a testimonial.

**What you get (FREE for 60 days):**
- **Proposal Writer Agent**: Generates custom proposals from brief templates
- **Client Onboarding Agent**: Welcome packets, kickoff scheduling, asset collection
- **Project Status Reporter Agent**: Weekly client updates without manual work
- **Invoice Follow-up Agent**: Payment reminders, late payment escalation
- **Content Repurposer Agent**: Turns one piece of content into 10+ social posts

**The catch?** None. I'm documenting my journey publicly and need 1-2 case study partners.

Would a 15-min call to see if this fits be worth your time?

Best,
Nodevs
AI Agent · LeadFlow
cleo-nodevs@agentmail.to`
    },
    followup1_day3: {
      subject: 'Re: {{company}} + AI automation',
      body: `Hi,

Following up on the free AI agent stack for {{company}}.

The agents handle:
- Proposal writing
- Client onboarding
- Weekly status reports
- Invoice follow-ups
- Content repurposing

60-day free setup. Interested?

Nodevs`
    },
    followup2_day7: {
      subject: 'Last try — free AI setup for {{company}}',
      body: `Hi,

Final attempt here.

Free AI agent stack for agencies:
- Proposal writing
- Client onboarding
- Status reports
- Invoice follow-ups

60-day trial. No cost.

Nodevs`
    },
    followup3_day14: {
      subject: 'Closing the loop',
      body: `Hi,

Assuming this isn't the right timing — I won't reach out again.

Best of luck,
Nodevs`
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // AUTOMOTIVE (Car Dealerships, Auto Repair, Garages)
  // ═══════════════════════════════════════════════════════════════
  'automotive': {
    initial: {
      subject: 'Quick question about {{company}}',
      body: `Hi there,

I came across {{company}} and wanted to reach out.

I'm Nodevs, an AI agent building an autonomous automotive business operations platform. I'm looking for 1-2 dealerships/shops to partner with for a **free 60-day AI agent stack setup** in exchange for a testimonial.

**What you get (FREE for 60 days):**
- **Appointment Booker Agent**: Schedules test drives, service appointments
- **Service Reminder Agent**: Oil change, maintenance, inspection reminders
- **Review Request Agent**: Requests Google reviews after sales/service
- **Follow-up Agent**: Post-purchase check-ins, trade-in value updates
- **Inventory Updater Agent**: Posts new arrivals to social media automatically

**The catch?** None. I'm documenting my journey publicly and need 1-2 case study partners.

Would a 15-min call to see if this fits be worth your time?

Best,
Nodevs
AI Agent · LeadFlow
cleo-nodevs@agentmail.to`
    },
    followup1_day3: {
      subject: 'Re: {{company}} + AI automation',
      body: `Hi,

Following up on the free AI agent stack for {{company}}.

The agents handle:
- Test drive & service appointment booking
- Service reminders (oil changes, maintenance)
- Google review requests
- Post-purchase follow-ups
- Social media inventory updates

60-day free setup. Interested?

Nodevs`
    },
    followup2_day7: {
      subject: 'Last try — free AI setup for {{company}}',
      body: `Hi,

Final attempt here.

Free AI agent stack for automotive:
- Appointment booking
- Service reminders
- Review requests
- Follow-ups & inventory posts

60-day trial. No cost.

Nodevs`
    },
    followup3_day14: {
      subject: 'Closing the loop',
      body: `Hi,

Assuming this isn't the right timing — I won't reach out again.

Best of luck,
Nodevs`
    }
  }
};

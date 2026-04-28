# Compliance & Regulatory Intake Policy

## Core Principle

Compliance requirements fundamentally shape application architecture — they cannot be bolted on later. **Never skip or simplify compliance questions during INTAKE.** Features that handle sensitive data (payments, personal information, health records) must have their regulatory obligations surfaced early, even when the user hasn't mentioned them.

---

## Mandatory Rules

1. **Always ask the compliance question** during the INTAKE checklist (see start.md § Checklist Questions). This question is triggered by keyword detection in the user's documentation or project description, but is asked regardless — even if no keywords are detected.

2. **Never assume compliance is not applicable.** If the user says "N/A," confirm explicitly: "Just to confirm — the app won't handle payment card data, personal information (names, emails, addresses), health records, or data subject to industry regulations?"

3. **Never carry prototype compliance shortcuts into production.** Prototypes routinely include payment forms, user registration screens, and data collection flows without any compliance considerations. These are acceptable in a demo but must be flagged during INTAKE for the production spec.

4. **Surface compliance implications proactively.** If the user's requirements describe features that imply regulatory obligations (see keyword triggers below), raise them even if the user hasn't mentioned compliance.

---

## Keyword Triggers

When any of the following appear in documentation, project descriptions, or user answers, the orchestrator must surface the corresponding compliance domain:

| Keywords | Compliance Domain | Manifest ID | Key Concern |
|----------|------------------|-------------|-------------|
| payment, checkout, billing, invoice, card, credit card, debit card, subscription, pricing, charge | **PCI-DSS** | `pci-dss` | Never store card numbers or CVVs; use tokenisation via certified payment provider (Stripe, Adyen, etc.); no card data in logs |
| user profile, registration, sign-up, email, phone, address, name, date of birth, personal data | **Data Protection (GDPR / POPIA / CCPA)** | `gdpr`, `popia`, or `ccpa` | Consent management, data minimisation, right to erasure, privacy policy, cookie consent |
| patient, health, medical, diagnosis, prescription, clinical, vitals | **HIPAA** | `hipaa` | PHI handling, access controls, audit trails, encryption at rest and in transit |
| tenant, multi-tenant, SaaS, customer data, B2B | **SOC 2** | `soc2` | Data isolation, access controls, audit logging, incident response |
| location, GPS, tracking, geolocation | **Data Protection + ePrivacy** | `gdpr`, `popia`, or `ccpa` | Location data is sensitive personal data; requires explicit consent |
| file upload, document, attachment | **Data Protection** | `gdpr`, `popia`, or `ccpa` | File type validation, malware scanning, storage encryption, retention policies |
| audit, log, trail, history | **Multiple** | *(use the domain-specific ID)* | Immutable audit trails may be required by PCI-DSS, HIPAA, SOC 2, or industry-specific regulations |

---

## Compliance Domains — What to Ask

### PCI-DSS (Payment Card Industry Data Security Standard)

**Trigger:** Any payment-related feature.

**Mandatory questions:**
- "How will payments be processed? Options: Third-party provider (Stripe, Adyen, PayFast, etc.) / Direct card capture / Not sure yet"
- If third-party: "Which provider?" (this determines the integration pattern)
- If direct card capture: **Flag immediately** — "Direct card capture requires PCI-DSS Level 1 compliance, which involves significant infrastructure and audit requirements. Most applications use a certified payment provider instead, which handles card data on their servers and provides tokenised references. Would you like to use a payment provider instead?"

**Production rules for FRS:**
- CR:"The application MUST NOT store, process, or transmit raw card numbers (PAN), CVV/CVC codes, or magnetic stripe data"
- CR:"All payment processing MUST be handled via [provider]'s hosted payment fields / payment elements — card data never touches our servers"
- CR:"Payment-related errors MUST NOT include card numbers or sensitive payment details in error messages or logs"
- CR:"Payment pages MUST be served over HTTPS with TLS 1.2+"

### Data Protection (GDPR / POPIA / CCPA)

**Trigger:** Any feature collecting or displaying personal data.

**Mandatory questions:**
- "Will the app collect personal information (names, emails, phone numbers, addresses)?"
- "Where will users be located? (This determines which data protection laws apply — EU/UK = GDPR, South Africa = POPIA, California = CCPA)"
- "Do users need the ability to export or delete their data?"

**Production rules for FRS:**
- CR:"Personal data collection MUST include a clear purpose statement and user consent mechanism"
- CR:"Users MUST be able to request deletion of their personal data (right to erasure)"
- CR:"Personal data MUST be encrypted at rest and in transit"
- CR:"The application MUST include a privacy policy link accessible from all data collection forms"

### HIPAA (Health Insurance Portability and Accountability Act)

**Trigger:** Any health or medical data feature.

**Mandatory questions:**
- "Will the app handle Protected Health Information (PHI) — patient names, diagnoses, treatment records, etc.?"
- "Is this app intended for use in the US healthcare system?"

**Production rules for FRS:**
- CR:"All access to PHI MUST be logged in an immutable audit trail"
- CR:"PHI MUST NOT appear in error messages, logs, or client-side state"
- CR:"PHI MUST be encrypted at rest (AES-256) and in transit (TLS 1.2+)"
- CR:"Session timeouts MUST be enforced for screens displaying PHI"

### SOC 2

**Trigger:** Multi-tenant SaaS or B2B applications handling customer data.

**Mandatory questions:**
- "Is this a multi-tenant application where different organisations' data must be isolated?"
- "Are there audit or compliance requirements from your customers?"

**Production rules for FRS:**
- CR:"Tenant data MUST be isolated — no cross-tenant data access"
- CR:"All data access MUST be logged with user identity, action, and timestamp"

### Accessibility (WCAG 2.1 AA)

**Note:** Accessibility is not optional in many jurisdictions (ADA in the US, EAA in the EU, PAIA in South Africa). It should always be raised as a non-functional requirement.

**Mandatory question:**
- "Are there specific accessibility requirements? WCAG 2.1 Level AA is the standard baseline and is legally required in many regions."

---

## Workflow Integration Points

- **INTAKE checklist:** `start.md` § Question 5
- **BRD gap analysis:** `intake-brd-review-agent.md` § Compliance Screening (Section 7)
- **FRS output:** CR-numbered requirements in the Compliance & Regulatory Requirements section

---

## Rationale

A payment form in a prototype is harmless. The same form in production, without PCI-DSS compliance, is a liability. Compliance requirements affect architecture (which services handle sensitive data), infrastructure (encryption, audit logging), and user experience (consent flows, data export). Discovering these requirements after implementation is expensive — surfacing them during INTAKE costs nothing and prevents costly rework.

# Website Trust Mode

Sentry allows users to define security policies on a per-domain basis. Rather than treating all websites equally, Sentry adjusts the agent's autonomy according to the trust level assigned to each origin.

---

## The Four Trust Levels

### 1. Read + Act (Full Collaboration)
- **Intended For:** Trusted internal tools, vetted SaaS apps, local intranets, personal productivity suites (e.g., Jira, Notion, GitHub).
- **Permissions:** Agent can read DOM elements and execute Tier 1 and Tier 2 actions autonomously. Tier 3 and Tier 4 still follow firewall safety rules.

### 2. Read-Only (Default for Unknown Websites)
- **Intended For:** Public search engines, forums, news sites, unfamiliar domains.
- **Permissions:** The agent may read visible text and navigate links. All form submissions, button clicks on active controls, and cookie access are restricted.

### 3. Highly Restricted
- **Intended For:** Domains with potential advertising trackers, unvetted user-generated content, or high injection risk.
- **Permissions:** Strict sandbox. Script execution for agent interaction is disabled, hidden DOM elements are aggressively stripped, and external resource fetching is clamped.

### 4. Blocked
- **Intended For:** Known phishing domains, untrusted origins, or sensitive sites you never want an AI to touch (e.g. banking portals).
- **Permissions:** The agent is completely barred from navigating to or interacting with this origin.

---

## Managing Trust Levels in Sentry

1. Navigate to any website.
2. Click the **Shield Icon** on the left of the address bar.
3. Select your desired trust level from the dropdown.
4. You can also view and edit all domain rules in **Settings → Trust Dashboard**.


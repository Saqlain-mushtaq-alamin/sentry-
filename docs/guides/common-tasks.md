# Common Tasks & Examples

Here are some real-world examples of tasks Sentry executes seamlessly.

---

## 1. Competitive Research & Comparison
**Prompt:**
> *"Go to the pricing pages of Vercel, Netlify, and Cloudflare Pages. Compare their free tier bandwidth limits and compile a comparison table."*

Sentry opens tabs for each provider, navigates to the respective pricing tables, extracts bandwidth limits, and presents a clean Markdown table in the result card.

---

## 2. Multi-Page Data Extraction
**Prompt:**
> *"Find the top 5 trending repositories on GitHub for TypeScript, extract their stars and repository URLs."*

Sentry navigates to `github.com/trending/typescript`, observes the repository cards, extracts titles, star counts, and links, and logs the structured JSON.

---

## 3. Form Filling with Confirmation
**Prompt:**
> *"Fill out the contact form on example.com with my name, email, and inquiry about pricing."*

Sentry fills out the input fields and stops before clicking "Submit", presenting a Tier 3 confirmation prompt so you can review the entered data.


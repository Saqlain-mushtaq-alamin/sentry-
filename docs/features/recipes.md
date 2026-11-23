# Task Recipes

**Recipes** turn one-off agent tasks into repeatable, parameterized workflows that can be executed on demand or shared across teams.

---

## What is a Recipe?

A recipe records the sequence of actions, target selectors, and variable substitutions used to complete a specific browser task.

Examples:
- Weekly grocery re-ordering
- Extracting monthly invoices from a vendor portal
- Checking competitive pricing across 3 retail sites
- Filling out standardized internal compliance forms

---

## Creating a Recipe

1. Run an agent task or perform the workflow yourself.
2. In the **Agent Sidebar**, click **Save as Recipe**.
3. Provide a title, description, and parameterize input variables:
   ```json
   {
     "name": "Search GitHub Repositories",
     "variables": ["query", "language"],
     "steps": [
       { "type": "navigate", "url": "https://github.com/search?q={{query}}+language:{{language}}" },
       { "type": "extract", "selector": ".repo-item", "target": "top_results" }
     ]
   }
   ```

---

## Replaying Recipes

1. Open the **Recipe Manager** page (`sentry://recipes` or via the sidebar).
2. Click **Run** on any saved recipe.
3. If the recipe has variables, enter values into the generated form fields.
4. Watch the agent replay the exact steps with 100% deterministic precision.


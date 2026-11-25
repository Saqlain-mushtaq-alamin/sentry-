# Tutorial: Your First Agent Task

This guide walks you through launching Sentry and running your first autonomous agent task.

---

## Step 1: Open the Agent Command Box

When you open Sentry, you will see a familiar browser interface with tabs, address bar, and navigation controls.

To summon the Sentry Agent:
- Press `Ctrl + Shift + Space` (or `Cmd + Shift + Space` on macOS), or
- Click the **Agent** icon in the browser toolbar.

The command box will open at the top of your screen, ready for natural language instructions.

---

## Step 2: Enter an Instruction

Try entering a simple, goal-oriented instruction:

```text
Find the latest release version and top feature of Node.js on nodejs.org
```

Press **Enter** to start the task.

---

## Step 3: Watch the Agent Plan and Execute

Once triggered, Sentry executes a ReAct (Reasoning + Acting) loop:

1. **Thought & Observation:** Sentry observes the current DOM tree and decides where to navigate or search.
2. **Action Proposal:** Sentry prepares an action (e.g., `navigate(https://nodejs.org)`).
3. **Firewall Verification:** The Action Firewall checks the target origin, risk tier, and parameters:
   - Reading public documentation is classified as **Tier 1 (Read-Only)** and proceeds automatically.
   - Any sensitive actions (form submissions, financial transactions, credential entry) are held for confirmation.
4. **Execution:** Sentry clicks links, scrolls the page, and extracts relevant information.
5. **Task Completion:** The agent presents an **Agent Result Card** summarizing the requested answer directly in the sidebar.

---

## Step 4: Inspecting the Action Log

Click the **Action Log** icon on the docked sidebar to inspect every single action taken:
- URL navigated
- Timestamp and duration
- Risk tier assigned
- Raw CDP DOM selector interacted with

You are always in control of what the agent has done and what it plans to do next.


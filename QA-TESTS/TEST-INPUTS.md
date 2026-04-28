# Test Inputs — Scripted Answers for the Test Guide

Use this document alongside TEST-GUIDE.md. It gives you the exact text to type (or option to select) at every prompt during the workflow, so your test run is reproducible and consistent.

All tests use the **Team Task Manager** scenario unless a specific test says "use the variant answer".

---

## The Feature — Team Task Manager

> A task management tool for small teams. Team members can view tasks assigned to them and mark them as complete. Admins can create tasks, assign them to any team member, edit due dates, and delete tasks. Each task has a title, description, due date, an assigned person, and a status of pending or complete. There is no public access — every user must be signed in.

This scenario was chosen because it:
- Has **two distinct roles** with different permissions (tests RBAC)
- Has a **clear data model** (title, description, due date, assignee, status) that produces a meaningful API spec
- Has **no existing API spec** — one must be generated (tests `design-api-agent`)
- Has a **backend in development** — triggers the mock layer (tests MSW setup)
- Has **styling preferences** — triggers `design-style-agent`
- Has **no compliance requirements** — keeps the compliance test path simple
- Has **two epics** — tests epic-to-epic transitions and dashboard updates across epics
- Has **two stories per epic** — tests REALIGN, the per-story cycle, and story-to-story transitions

---

## INTAKE — Scripted Inputs

### Routing Question

**Prompt:** "How would you like to get started?"

**Select:** `Let's build requirements together`

---

### Elevator Pitch (plain text — type this exactly)

```
A task management tool for small teams. Team members can view tasks assigned to them and mark them complete. Admins can create tasks, assign them to any team member, edit due dates, and delete tasks. Each task has a title, description, due date, an assigned person, and a status of pending or complete. Everyone must be signed in — no public access.
```

---

### Q1 — Roles and Permissions

**Prompt:** Something like "Who uses this application? What distinct roles exist?"

**Select or type:** Choose the option for "Two roles with different permissions" if available. Otherwise type:

```
Two roles:
- Admin: can create tasks, assign tasks to members, edit due dates, delete tasks, and view all tasks
- Member: can view only tasks assigned to them, and mark their own tasks as complete
```

---

### Q2 — Styling and Branding

**Prompt:** "Any specific colours, themes, or design system preferences?"

**Select or type:** Choose the option for "Let me describe" or "I have preferences". Then type:

```
Clean and professional. Primary colour: blue (#2563EB). Background: white. Use a light grey (#F3F4F6) for table rows and sidebar backgrounds. Sans-serif font. Compact layout — this is a productivity tool, not a marketing page. Support light mode only.
```

---

### Q3a — API Spec

**Prompt:** "Do you have an OpenAPI or Swagger specification?"

**Select:** `No — we'll design the full API spec from your requirements`

---

### Q3b — Backend Readiness

**Prompt:** "Is your backend API up and running?"

**Select:** `No, still in development — we'll set up a mock layer so you can build the frontend now`

> This combination (No spec + Backend in development) sets `dataSource: api-in-development` and enables the mock layer. It exercises the most code paths.

---

### Q4 — Authentication Method

**Prompt:** "How will users authenticate?"

**Select:** `Frontend-only (next-auth)`

> This triggers the trade-off warning (Test 6B). For Test 6A (BFF path), use the variant answer below instead.

After selecting, Claude displays a warning about API calls not carrying session context. Read it and continue.

---

### Q5 — Compliance

**Prompt:** Something like "I haven't spotted anything that would trigger specific compliance requirements..."

**Select:** `That's correct — no compliance requirements`

---

### Q6 — Wireframe Quality (only if wireframes were detected)

This question only appears if you provided wireframe files. In this scenario you have none, so it will not appear.

---

### Manifest Approval

**Prompt:** "Does this look right? Anything to add or change before we move on?"

**Select:** `Looks good`

> Before selecting, verify the summary shows: project "Team Task Manager", two roles (admin/member), blue styling, no API spec (will generate), backend in development (mock layer), frontend-only auth, no compliance.

---

### FRS Clarifying Questions

Claude may ask follow-up questions per FRS section. Use these answers:

| If Claude asks about... | Say... |
|---|---|
| What happens when a member tries to access an admin page? | `Redirect them to their task list with a message saying they don't have permission.` |
| What happens when a task is deleted? | `It is permanently removed with no undo. Show a confirmation dialog before deleting.` |
| What fields are required when creating a task? | `Title and assignee are required. Description and due date are optional.` |
| What does "mark as complete" look like? | `A checkbox or toggle on the task row. Clicking it changes status from pending to complete instantly.` |
| What happens if no tasks are assigned to a member? | `Show a friendly empty state message: "No tasks assigned to you yet."` |
| Anything else not covered | `That's all for now — keep it simple.` |

---

### FRS Approval

**Prompt:** "Does this capture everything we need to build?"

**Select:** `Looks complete`

> Before selecting, verify the FRS contains:
> - Requirements R1–R6 (approximately): view tasks, create task, assign task, edit due date, delete task, mark complete
> - Business rules BR1–BR3 (approximately): admin-only create/delete, member sees own tasks only, confirmation before delete
> - Auth method: frontend-only (next-auth)
> - Two roles: admin, member

---

## DESIGN — Scripted Approvals

### API Spec Approval

Claude proposes an OpenAPI spec. Verify it contains these endpoints (approximately):

| Method | Path | Purpose |
|---|---|---|
| GET | /api/tasks | List tasks (admin: all, member: own) |
| POST | /api/tasks | Create a task (admin only) |
| PATCH | /api/tasks/{id} | Edit due date or mark complete |
| DELETE | /api/tasks/{id} | Delete a task (admin only) |
| GET | /api/users | List team members for assignee dropdown |

**Select:** `Looks good` (or "Approve")

If the spec is missing an endpoint you expect, select "I have changes" and type which endpoint is missing.

---

### Design Tokens Approval

Claude proposes CSS design tokens. Verify:
- Primary colour is approximately `#2563EB` (blue)
- Background is white
- A light grey token exists for table/sidebar backgrounds
- Dark mode tokens are minimal or absent (light mode only)

**Select:** `Looks good`

---

### Wireframe Screen List Approval

Claude proposes a list of screens to wireframe. Verify it includes at minimum:

- Task list page (all tasks for admin / own tasks for member)
- Task detail or empty state
- Create task form (modal or page)
- Delete confirmation dialog

**Select:** `Looks good`

---

### Wireframe Approval (after screens are drawn)

Review the ASCII/text wireframes. They do not need to be pixel-perfect. Verify each screen has:
- A heading
- The correct UI elements (table, form fields, buttons) for that screen
- Role-specific notes where applicable (e.g., "Admin only: Delete button visible")

**Select:** `Looks good`

---

## SCOPE — Suggested Epics

Claude proposes epics. If given a choice to approve or suggest changes, approve if the proposal is close to:

```
Epic 1: Task Browsing — View and filter the task list
Epic 2: Task Actions — Create, edit, and delete tasks
```

**Select:** `Looks good`

If Claude proposes different epic names or more epics, that is fine — approve as long as the scope matches the FRS.

---

## STORIES — Suggested Stories

### Epic 1: Task Browsing

Approve if the proposal is close to:

```
Story 1: View task list
  Role: Admin (sees all tasks) / Member (sees own tasks only)
  As a signed-in user, I can see a table of tasks relevant to my role.
  Admin sees all tasks. Member sees only tasks assigned to them.

Story 2: Empty state
  Role: Member
  As a member with no assigned tasks, I see a message "No tasks assigned to you yet"
  instead of an empty table.
```

**Select:** `Looks good`

---

### Epic 2: Task Actions

Approve if the proposal is close to:

```
Story 1: Create a task
  Role: Admin
  As an admin, I can open a form, fill in title and assignee (required),
  optionally add description and due date, and submit to create the task.

Story 2: Delete a task
  Role: Admin
  As an admin, I can click a Delete button on any task row, see a confirmation
  dialog, confirm, and have the task permanently removed from the list.
```

**Select:** `Looks good`

---

## TEST-DESIGN — Approval Inputs

### Story 1 (View task list)

When Claude shows the test-design document, verify it contains at minimum:

- **Scenario: Admin sees all tasks** — setup: 3 tasks exist assigned to different members; expected: table shows all 3 rows
- **Scenario: Member sees only own tasks** — setup: 3 tasks exist, only 1 assigned to current member; expected: table shows 1 row
- **Scenario: Empty state for member** — setup: no tasks assigned to member; expected: "No tasks assigned to you yet" message

**Select:** `Looks good` (or "Approve")

---

### Story 2 (Empty state)

Verify:
- **Scenario: Empty state message** — expected: friendly message visible, no table rendered
- **Scenario: Message disappears when tasks exist** — expected: table appears once a task is assigned

**Select:** `Looks good`

---

### Story 3 (Create a task)

Verify:
- **Scenario: Successful creation** — fill title + assignee, submit; expected: task appears in list
- **Scenario: Missing required field** — leave title blank, submit; expected: validation error on title field
- **Scenario: Member cannot see the Create button** — member role; expected: no Create button visible

**Select:** `Looks good`

---

### Story 4 (Delete a task)

Verify:
- **Scenario: Successful deletion** — admin clicks Delete, confirms; expected: task removed from list
- **Scenario: Confirmation dialog** — admin clicks Delete; expected: dialog appears before deletion
- **Scenario: Cancel deletion** — admin clicks Delete, then Cancel; expected: task remains in list
- **Scenario: Member cannot delete** — member role; expected: no Delete button visible

**Select:** `Looks good`

---

## IMPLEMENT — Manual Verification Inputs

For each story, start the dev server (`cd web && npm run dev`) and go to `http://localhost:3000`.

### Story 1 — View task list

Steps to verify in browser:
1. Sign in as an admin. Navigate to the task list page.
   - ✅ A table of tasks is visible with columns for title, due date, assignee, status.
2. Sign in as a member. Navigate to the task list page.
   - ✅ Only tasks assigned to that member appear.

**Select:** `All tests pass`

---

### Story 2 — Empty state

Steps to verify in browser:
1. Sign in as a member who has no tasks assigned.
   - ✅ The message "No tasks assigned to you yet" (or similar) appears.
   - ✅ No empty table with no rows is shown.

**Select:** `All tests pass`

---

### Story 3 — Create a task

Steps to verify in browser:
1. Sign in as an admin.
   - ✅ A "Create Task" button is visible.
2. Click it. Fill in only the title. Try to submit.
   - ✅ An error appears on the assignee field (required).
3. Fill in both title and assignee. Submit.
   - ✅ The new task appears in the list without refreshing.
4. Sign in as a member.
   - ✅ No "Create Task" button is visible.

**Select:** `All tests pass`

---

### Story 4 — Delete a task

Steps to verify in browser:
1. Sign in as an admin.
   - ✅ A "Delete" button (or icon) is visible on each task row.
2. Click Delete on any task.
   - ✅ A confirmation dialog appears ("Are you sure?" or similar).
3. Click Cancel.
   - ✅ The task is still in the list.
4. Click Delete again, then Confirm.
   - ✅ The task is removed from the list without a full page reload.
5. Sign in as a member.
   - ✅ No Delete button is visible on any row.

**Select:** `All tests pass`

---

## Variant Answers — For Specific Tests

Use these only when a specific test in TEST-GUIDE.md tells you to swap them in. Revert to the main scenario answers after the test.

---

### Variant A — BFF Authentication (for Test 6A)

At Q4 (Authentication), select **`Backend For Frontend (BFF)`** instead of frontend-only.

When Claude asks for URLs (plain text prompts — type these):

| Prompt | Answer |
|---|---|
| Login endpoint URL | `/api/auth/login` |
| Userinfo endpoint URL | `/api/auth/userinfo` |
| Logout endpoint URL | `/api/auth/logout` |

---

### Variant B — No Backend API (for Test 10A)

At Q3a, select **`N/A — no backend API`** instead of "No".

Q3b will be ignored automatically. `dataSource` will be `mock-only`. No API spec or mock layer will be generated.

---

### Variant C — Existing Complete API Spec (for Test 10B and Test 31)

Before running `/start`, create this file at `documentation/task-api.yaml`:

```yaml
openapi: 3.0.3
info:
  title: Task Manager API
  version: 1.0.0
paths:
  /api/v2/tasks:
    get:
      summary: List tasks
      responses:
        '200':
          description: List of tasks
  /api/v2/tasks/{id}:
    delete:
      summary: Delete a task
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '204':
          description: Deleted
```

At Q3a, select **`Yes, complete`**.
At Q3b, select **`Yes, it's running`**.

After IMPLEMENT, verify the generated API calls use `/api/v2/tasks` — not `/api/tasks` or any other guessed path.

---

### Variant D — TypeScript Error Injection (for Test 27A)

After IMPLEMENT completes for any story, open the page file Claude created (e.g., `web/src/app/tasks/page.tsx`) and add this line anywhere inside the component:

```typescript
const x: number = "this is not a number";
```

Then run `/quality-check`. Verify Gate 3 reports FAIL. Revert the line after the test.

---

### Variant E — BFF Auth with FRS Override (for Test 29)

This variant tests that Claude removes NextAuth when the FRS specifies BFF.

1. Use Variant A (BFF auth) from the start.
2. During IMPLEMENT for the auth-related story, observe whether Claude removes any NextAuth configuration already in `web/` and replaces it with BFF redirect logic.
3. ✅ Confirm there is no `next-auth` credential provider left in the codebase after implementation.

---

### Variant F — With Discovered Impact (for Test 16 and Test 30)

After Story 1 of Epic 1 is committed, manually add this to `generated-docs/discovered-impacts.md` before running `/continue`:

```markdown
## Impact: Epic 1, Story 2

While implementing the task list (Story 1), we discovered that the empty state
must also handle the case where the API returns a loading error — not just an
empty array. Story 2 (empty state) should include a third scenario:
a visible error message when the API call fails.
```

Then run `/continue` and observe REALIGN processing this impact before Story 2's TEST-DESIGN runs.

---

## Quick Reference — Which Answers to Use Per Test

| Test # | Scenario | Special variant? |
|---|---|---|
| 3 (dashboard) | Main scenario — full run | None |
| 4 (onboarding routing) | Just the routing question | None |
| 5 (checklist questions) | Q1–Q5 answers above | None |
| 6A (BFF auth) | Variant A | Swap Q4 answer |
| 6B (frontend-only warning) | Main scenario | None (main already uses frontend-only) |
| 8 (manifest) | Main scenario through manifest approval | None |
| 9 (FRS) | Main scenario through FRS approval | None |
| 10A (no API agent) | Variant B | Swap Q3a answer |
| 10B (user-provided spec) | Variant C | Add YAML file first |
| 13 (SCOPE) | Suggested epics above | None |
| 14 (STORIES) | Suggested stories above | None |
| 16 (REALIGN with impact) | Variant F | Add impact file manually |
| 17–20 (per-story cycle) | TEST-DESIGN + manual verification inputs above | None |
| 27A (TypeScript error) | Variant D | Inject error after IMPLEMENT |
| 29 (FRS override) | Variant E | Use BFF from the start |
| 30 (discovered impacts) | Variant F | Add impact file manually |
| 31 (API spec detection) | Variant C | Use YAML with `/api/v2/tasks` path |
| 38 (role declaration) | Main scenario | None |
| All others | Main scenario | None |

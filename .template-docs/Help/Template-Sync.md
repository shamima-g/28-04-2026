# Template Sync

Keep your project up to date with the latest template improvements, bug fixes, and security patches. A GitHub Actions workflow runs weekly and creates a pull request with any upstream changes.

---

## How It Works

1. Every Sunday at midnight UTC, the `sync-template.yml` workflow runs in your repo
2. It pulls the latest content from the template release repo (`Digiata/Stadium-8`)
3. Files listed in `.templatesyncignore` are skipped (your app code, local config, etc.)
4. If there are changes, a PR is created with the label `template-sync`
5. You review the PR, resolve any conflicts, and merge when ready

You can also trigger a sync manually at any time (see below).

---

## Setup

You need one secret in your repository: the SSH private key that grants read access to the template repo.

### Step 1: Get the Private Key

Contact the template maintainers to obtain the sync deploy key's private key. This is a shared, read-only key scoped to the template repo only.

### Step 2: Add the Secret

1. Go to your repo on GitHub
2. Navigate to **Settings > Secrets and variables > Actions**
3. Click **New repository secret**
4. Name: `TEMPLATE_SSH_PRIVATE_KEY`
5. Value: paste the entire private key (including the `-----BEGIN` and `-----END` lines)
6. Click **Add secret**

That's all. The workflow will use this key to authenticate when pulling template updates.

---

## Triggering a Manual Sync

To sync immediately without waiting for the weekly schedule:

1. Go to your repo on GitHub
2. Navigate to **Actions > Sync from Template**
3. Click **Run workflow**
4. Select the branch (usually `main`)
5. Click **Run workflow**

A PR will be created if there are changes.

---

## What Gets Synced

The `.templatesyncignore` file controls which files are synced. By default:

| Synced (auto-updated) | Not synced (your territory) |
|---|---|
| `.claude/` agents, commands, hooks, scripts | `web/` (your application code) |
| `.github/` workflows, scripts, templates | `documentation/` (your specs) |
| `.template-docs/` guides and help docs | `generated-docs/` (your generated output) |
| Root config (`CLAUDE.md`, `.gitignore`, etc.) | `.env` files, IDE settings |

For `web/` changes, review the `CHANGELOG.md` included in the sync PR to understand what changed and apply updates manually.

---

## Reviewing Sync PRs

Sync PRs may include:

- Updated agent definitions or workflow improvements
- New or improved quality gate checks
- Security patches to CI/CD workflows
- Documentation updates

Review the PR diff carefully. If there are merge conflicts, resolve them in favour of whichever version is correct for your project.

---

## Troubleshooting

**Workflow fails with "Permission denied (publickey)"**
The `TEMPLATE_SSH_PRIVATE_KEY` secret is missing or incorrect. Re-add it following the setup steps above.

**Workflow runs but no PR is created**
Your repo is already up to date with the template. No action needed.

**PR has merge conflicts**
The sync found changes in files you've also modified. Review each conflict and keep the version that's correct for your project.

**Workflow doesn't run at all**
The sync workflow has a guard condition that skips the dev repo (`stadium-software/stadium-8`) and the release repo (`Digiata/Stadium-8`). It only runs in repos created from the template. If you're testing in one of those repos, use a fork or a separate test repo instead.

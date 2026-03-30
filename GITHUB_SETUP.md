# GitHub Repository Setup Required

## Action Needed

Create the GitHub repository before pushing VANTA Core v1.0.0:

**URL:** https://github.com/new

**Settings:**
- Repository name: `vanta-core`
- Owner: `Accep779`
- Visibility: **Public**
- Initialize: **NO** (do NOT add README, .gitignore, or license)

## After Creating

Run these commands:

```bash
cd /home/nodevs/.openclaw/workspace/vanta-core

# Verify remote is set
git remote -v
# Should show: git@github.com:Accep779/vanta-core.git

# Push code
git push -u origin main

# Tag v1.0.0
git tag -a v1.0.0 -m "VANTA Core v1.0.0 - Autonomous Threat Simulation Engine"
git push origin v1.0.0
```

## Why Manual Creation?

GitHub API requires either:
- Personal Access Token (PAT) with `repo` scope, OR
- OAuth app registration

Current credentials (email/password) don't work with API directly.

## Alternative: Use GitHub CLI

If `gh` is installed:

```bash
gh repo create Accep779/vanta-core --public --source=. --push
```

---

**Status:** Code ready, awaiting repo creation.

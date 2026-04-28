# Checkpoint Tarballs

These `.tar` files are optional. When present, `loadCheckpoint(root, 'CP-N')` extracts them into the test project, giving integration tests a realistic starting state without running the full workflow.

When absent, `loadCheckpoint()` falls back to a synthesised minimum — enough for mechanical tests, not enough for snapshot tests of generated outputs.

## Harvesting a checkpoint from a real run

```bash
# After /start reaches the desired phase in a real repo:
cd /path/to/repo
tar -cf /path/to/QA/fixtures/checkpoints/CP-1.tar \
  generated-docs/context/intake-manifest.json \
  generated-docs/specs/feature-requirements.md

tar -cf .../CP-2.tar \
  generated-docs/context/intake-manifest.json \
  generated-docs/context/workflow-state.json \
  generated-docs/specs/

tar -cf .../CP-3.tar \
  generated-docs/context/ \
  generated-docs/specs/ \
  generated-docs/stories/_feature-overview.md

# ... and so on for CP-4, CP-5, CP-6
```

## Why they're gitignored by default

Tarballs contain generated content that can drift from the orchestrator rules. Treat them as ephemeral harvest artifacts, not source. Re-harvest after any change to `.claude/shared/orchestrator-rules.md` or the intake / FRS templates.

Remove them from `.gitignore` only if you genuinely want them versioned.

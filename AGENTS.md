# AGENTS.md

## Repository workflow

- Treat the current user's request as the source of truth. Follow these instructions only when they do not conflict with a more specific request in the current conversation.
- Before changing files, inspect the working tree and preserve unrelated user changes. Do not reset, discard, or overwrite work that is outside the current task.
- After completing an implementation task, review the diff and run the most relevant available checks or tests.
- Commit the relevant changes automatically on the current branch with a concise, descriptive commit message. Do not include unrelated changes, secrets, credentials, or local-only files.
- Push the new commit to the current branch's configured upstream automatically. If no upstream or remote is configured, report that clearly instead of inventing one.
- Do not use destructive Git commands such as `git reset --hard` or `git checkout --` to resolve conflicts or clean up the tree.

## Completion report

Every completed implementation task must report:

1. What changed, including the important files or areas touched.
2. What checks or tests were run and their results.
3. The commit hash and commit message.
4. Whether the push succeeded, including the remote and branch.
5. Any remaining follow-up, blocker, or intentionally uncommitted work.

If the task is read-only, do not create a commit or push; still report the evidence gathered and any relevant working-tree state.

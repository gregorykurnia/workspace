#!/usr/bin/env bash
# Moves between the codebase (main) and the isolated design studio branch.
#
#   redesign/studio.sh enter    main → design-studio, syncing redesign/handoff/ from main
#   redesign/studio.sh import   on main: bring the approved redesign/design/ over from design-studio
#
# To leave the studio:  git switch main
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"
branch="$(git branch --show-current)"

require_clean() {
  if [ -n "$(git status --porcelain)" ]; then
    echo "✋ Uncommitted changes on '$branch'. Commit them first." >&2
    exit 1
  fi
}

case "${1:-}" in
  enter)
    [ "$branch" = "main" ] || { echo "✋ Run this from main (currently on '$branch')." >&2; exit 1; }
    require_clean
    git switch design-studio
    git checkout main -- redesign/handoff
    if ! git diff --cached --quiet; then
      git commit -q -m "Update handoff inputs"
      git push -q origin design-studio
      echo "Synced handoff inputs into the studio."
    fi
    cat <<'MSG'

✅ You're in the design studio (branch: design-studio).

Next:
  1. Quit Claude Code completely (/exit).
  2. Start a NEW session in this folder:  claude
     Never use --continue or --resume here.
  3. Leave the studio later with:  git switch main
MSG
    ;;
  import)
    [ "$branch" = "main" ] || { echo "✋ Run this from main (currently on '$branch')." >&2; exit 1; }
    require_clean
    git checkout design-studio -- redesign/design
    if git diff --cached --quiet; then
      echo "Nothing new to import."
      exit 0
    fi
    git commit -q -m "Import approved design guide from design-studio"
    git push -q
    echo "✅ Imported redesign/design/ into main."
    ;;
  *)
    sed -n '2,7p' "$0"
    exit 1
    ;;
esac

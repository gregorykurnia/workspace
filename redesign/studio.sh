#!/usr/bin/env bash
# The design studio lives in its own folder (a git worktree on the design-studio branch),
# so the codebase folder never switches branches.
#
#   redesign/studio.sh enter    create the studio folder if needed and sync redesign/handoff/ from main into it
#   redesign/studio.sh import   on main: bring the approved redesign/design/ over from design-studio
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"
branch="$(git branch --show-current)"
STUDIO="$(dirname "$PWD")/$(basename "$PWD")-studio"

require_main_clean() {
  [ "$branch" = "main" ] || { echo "✋ Run this from main (currently on '$branch')." >&2; exit 1; }
  if [ -n "$(git status --porcelain)" ]; then
    echo "✋ Uncommitted changes on main. Commit them first." >&2
    exit 1
  fi
}

case "${1:-}" in
  enter)
    require_main_clean
    if [ ! -d "$STUDIO" ]; then
      git worktree add -q "$STUDIO" design-studio
      echo "Created the studio folder: $STUDIO"
    fi
    (
      cd "$STUDIO"
      if [ -n "$(git status --porcelain)" ]; then
        git add -A
        git commit -q -m "Save unsaved studio work"
      fi
      git checkout main -- redesign/handoff
      if ! git diff --cached --quiet; then
        git commit -q -m "Update handoff inputs"
        echo "Synced handoff inputs into the studio."
      fi
      git push -q origin design-studio
    )
    cat <<MSG

✅ The studio is ready.

Open a NEW terminal window and run:
  cd $STUDIO
  claude

(Plain 'claude'. Never --continue or --resume.)
This window stays your codebase on main.
MSG
    ;;
  import)
    require_main_clean
    if [ -d "$STUDIO" ] && [ -n "$(git -C "$STUDIO" status --porcelain)" ]; then
      git -C "$STUDIO" add -A
      git -C "$STUDIO" commit -q -m "Save unsaved studio work"
      git -C "$STUDIO" push -q origin design-studio
    fi
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

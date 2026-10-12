#!/usr/bin/env bash
set -euo pipefail

WIKI_DIR="${1:-/home/mohit/projects/agentgate-wiki}"
REMOTE="https://github.com/mohitdebian/AgentGate.wiki.git"

if [ ! -d "$WIKI_DIR" ]; then
  echo "Error: Wiki directory $WIKI_DIR does not exist."
  exit 1
fi

cd "$WIKI_DIR"
git init -b master 2>/dev/null || git init
git config user.name "Mohit Singh"
git config user.email "devbyte.mohit@gmail.com"
git remote remove origin 2>/dev/null || true
git remote add origin "$REMOTE"

git add -A
git commit -m "docs(wiki): publish production documentation pages" || true
git push -u origin master

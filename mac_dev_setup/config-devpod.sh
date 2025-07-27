#!/bin/bash

# DevPod Configuration Script
# Based on steps 1-5 from README.md

set -e

echo "🚀 Starting DevPod configuration..."
echo ""

# Step 1: Install tools
echo "1️⃣ Installing tools..."
if [ -f "./.devcontainer/install-tools.sh" ]; then
    ./.devcontainer/install-tools.sh
else
    echo "   ⚠️  install-tools.sh not found, skipping..."
fi
echo "   ✅ Tools installation complete"
echo ""

# Step 2: Create tmux session with current directory name
PROJECT_NAME=$(basename $(pwd))
echo "2️⃣ Creating tmux session: $PROJECT_NAME"
tmux new -d -s "$PROJECT_NAME" || echo "   ℹ️  Tmux session '$PROJECT_NAME' already exists"
echo "   ✅ Tmux session ready"
echo ""

# Step 3: Install Claude CLI
echo "3️⃣ Installing Claude CLI..."
claude -dangerously-skip-permissions --version >/dev/null 2>&1 || {
    echo "   Installing Claude CLI..."
    npm install -g claude
}
echo "   ✅ Claude CLI ready"
echo ""

# Step 4: Initialize claude-flow
echo "4️⃣ Initializing claude-flow..."
npx claude-flow@alpha init --force
echo "   ✅ claude-flow initialized"
echo ""

# Step 5: Append yolo protocols to CLAUDE.md
echo "5️⃣ Updating CLAUDE.md with yolo protocols..."
curl -sL https://raw.githubusercontent.com/cgbarlow/pipeline/main/claude.md_customisations/yolo_protocols.md >> CLAUDE.md
echo "   ✅ CLAUDE.md updated"
echo ""

echo "🎉 DevPod configuration complete!"
echo ""
echo "To attach to your devpod container and tmux session, from terminal run:"
echo "  devpod-select.sh"
echo "  select $PROJECT_NAME.devpod"
echo "  tmux a -t $PROJECT_NAME"
echo ""
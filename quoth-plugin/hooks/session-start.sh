#!/usr/bin/env bash
# Quoth Plugin - SessionStart Hook
# Detects Quoth configuration and injects context into Claude Code sessions

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"

# ============================================================================
# CONTEXT TEMPLATES
# ============================================================================

get_active_context() {
    echo "## Quoth Documentation System Active

This project uses Quoth as its Single Source of Truth for documentation.

### Before Writing Code

1. **Search Quoth first** - Use quoth_search_index to find existing patterns
2. **Follow documented patterns** - Use quoth_read_doc to read full documentation
3. **Propose updates** - If you find outdated docs, use quoth_propose_update

### Available Quoth Tools

- quoth_search_index - Semantic search across documentation
- quoth_read_doc - Read full document content
- quoth_propose_update - Submit documentation updates
- quoth_genesis - Bootstrap documentation for new projects

**Remember:** Documentation is the intended design. When code conflicts with docs, docs are correct."
}

get_genesis_context() {
    echo "## Quoth MCP Detected - No Project Documentation

This project does not have Quoth documentation yet.

### Get Started

Run /quoth-genesis to bootstrap documentation for this project.

Genesis will:
1. Analyze your codebase structure
2. Detect your tech stack
3. Generate foundational documentation
4. Configure Quoth for this project

### Or Connect Existing Project

If this project already has Quoth docs, create a config file:

mkdir -p .quoth
echo '{\"project_id\": \"YOUR_PROJECT_ID\"}' > .quoth/config.json"
}

# ============================================================================
# MAIN LOGIC
# ============================================================================

main() {
    # Step 1: Check if Quoth MCP is installed
    if ! quoth_mcp_installed; then
        output_empty
        exit 0
    fi

    # Step 2: Find project config
    local config_path=$(find_quoth_config)
    local project_id=""
    local has_docs=false

    if [ -n "$config_path" ]; then
        project_id=$(get_config_value "project_id" "$config_path")
        has_docs=true
    fi

    # Step 3: Initialize session state
    init_session "$project_id"

    # Step 4: Build context based on what's found
    local context=""

    if [ "$has_docs" = true ]; then
        context=$(get_active_context)
    else
        context=$(get_genesis_context)
    fi

    # Step 5: Output context
    output_context "$context"
}

main "$@"

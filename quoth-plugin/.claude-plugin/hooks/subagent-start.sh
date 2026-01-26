#!/usr/bin/env bash
# Quoth Plugin - SubagentStart Hook
# Ensures subagents follow documented patterns

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"

main() {
    # Check if MCP is available
    if ! quoth_mcp_installed; then
        output_empty
        exit 0
    fi

    # Clear hint with exact signatures for subagents
    local context='[Quoth-Subagent] Call quoth_guidelines({ mode: "code" }) first. Then quoth_search_index. Never invent patterns.'

    output_context "$context"
}

main "$@"

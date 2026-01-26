#!/usr/bin/env bash
# Quoth Plugin - SubagentStop Hook
# Conditional reminder to document new patterns

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"

main() {
    # Check if MCP is available
    if ! quoth_mcp_installed; then
        output_empty
        exit 0
    fi

    # Check if Quoth tools were used (if session exists)
    if session_exists && quoth_tools_were_used; then
        local context='[Quoth-Subagent] New patterns? Call: quoth_propose_update({ doc_id, new_content, evidence_snippet, reasoning })'
        output_context "$context"
    else
        output_empty
    fi
}

main "$@"

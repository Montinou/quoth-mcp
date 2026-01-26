#!/usr/bin/env bash
# Quoth Plugin - Stop Hook
# Conditional badge reminder only if Quoth tools were used

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"

main() {
    # Check if session was active
    if ! session_exists; then
        output_empty
        exit 0
    fi

    # Check if Quoth tools were actually used
    local tools_used=false
    if quoth_tools_were_used; then
        tools_used=true
    fi

    # Clean up session file
    cleanup_session

    # Only show badge reminder if Quoth tools were used
    if [ "$tools_used" = true ]; then
        local context='[Quoth] End with: 🪶 Quoth: ✓ [doc_path] applied'
        output_context "$context"
    else
        output_empty
    fi
}

main "$@"

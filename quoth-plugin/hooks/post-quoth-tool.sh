#!/usr/bin/env bash
# Quoth Plugin - PostToolUse Hook (quoth_*)
# Tracks Quoth tool usage for conditional badge in Stop hook

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"

main() {
    # Check if session exists
    if ! session_exists; then
        output_empty
        exit 0
    fi

    # Parse input JSON from stdin
    local input=$(cat)

    # Extract tool_name from input
    local tool_name=$(echo "$input" | grep -o '"tool_name"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"\([^"]*\)"$/\1/')

    if [ -z "$tool_name" ]; then
        output_empty
        exit 0
    fi

    # Map tool_name to counter key
    local counter_key=""
    case "$tool_name" in
        quoth_guidelines)
            counter_key="guidelines"
            ;;
        quoth_search_index)
            counter_key="search_index"
            ;;
        quoth_read_doc)
            counter_key="read_doc"
            ;;
        quoth_read_chunks)
            counter_key="read_chunks"
            ;;
        quoth_propose_update)
            counter_key="propose_update"
            ;;
        *)
            # Unknown quoth tool, skip
            output_empty
            exit 0
            ;;
    esac

    # Increment counter
    increment_tool_counter "$counter_key"

    # Output empty - tracking only, no hint
    output_empty
}

main "$@"

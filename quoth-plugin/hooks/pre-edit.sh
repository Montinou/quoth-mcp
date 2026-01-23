#!/usr/bin/env bash
# Quoth Plugin - PreToolUse Hook (Edit)
# Searches Quoth for relevant patterns and injects them before editing

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"

# ============================================================================
# MAIN LOGIC
# ============================================================================

main() {
    # Check if MCP is available and session exists
    if ! quoth_mcp_installed || ! session_exists; then
        output_empty
        exit 0
    fi

    # Parse input JSON from stdin
    local input=$(cat)

    # Extract file_path from tool_input
    local file_path=$(extract_file_path "$input")

    if [ -z "$file_path" ]; then
        output_empty
        exit 0
    fi

    # Skip config/generated files
    if should_skip_file "$file_path"; then
        output_empty
        exit 0
    fi

    # Detect file category
    local category=$(detect_file_category "$file_path")
    local file_name=$(basename "$file_path")

    # Build search query
    local query=$(build_search_query "$category")

    # Output pattern guidance
    local context=$(cat << EOF
<quoth_patterns file="$file_path" category="$category">
Before editing this $category file, consider searching Quoth:

\`quoth_search_index({ query: "$query" })\`

Follow documented patterns for consistency.
</quoth_patterns>
EOF
)

    # Update session state
    increment_session_counter "patterns_applied"

    output_context "$context"
}

main "$@"

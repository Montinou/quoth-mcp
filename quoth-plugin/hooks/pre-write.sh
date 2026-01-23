#!/usr/bin/env bash
# Quoth Plugin - PreToolUse Hook (Write)
# Searches Quoth for relevant patterns before creating new files

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

    # Skip non-code files
    if is_non_code_file "$file_path"; then
        output_empty
        exit 0
    fi

    # Detect file category
    local category=$(detect_file_category "$file_path")

    # Output template and pattern guidance
    local context=$(cat << EOF
<quoth_guidance file="$file_path" type="new_file">
Creating new $category file. Check Quoth for:

1. **Templates**: \`quoth_list_templates()\` for boilerplate
2. **Patterns**: \`quoth_search_index({ query: "$category patterns" })\`
3. **Conventions**: Follow documented naming and structure

Consider using \`quoth_get_template\` for consistent structure.
</quoth_guidance>
EOF
)

    # Update session state
    increment_session_counter "patterns_applied"

    output_context "$context"
}

main "$@"

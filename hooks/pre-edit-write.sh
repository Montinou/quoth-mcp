#!/usr/bin/env bash
# Quoth Plugin - PreToolUse Hook (Edit|Write)
# Category-aware hints delivered once per category

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"

# Get category-specific hint text
get_category_hint() {
    local category="$1"

    case "$category" in
        test)
            echo "[Quoth] Test file. Search: quoth_search_index({ query: \"testing patterns vitest\" })"
            ;;
        api)
            echo "[Quoth] API route. Search: quoth_search_index({ query: \"api patterns response\" })"
            ;;
        component)
            echo "[Quoth] Component. Search: quoth_search_index({ query: \"react component patterns\" })"
            ;;
        service)
            echo "[Quoth] Service. Search: quoth_search_index({ query: \"service patterns error handling\" })"
            ;;
        *)
            echo "[Quoth] Search quoth_search_index before writing."
            ;;
    esac
}

# Map file category to hint category key
get_hint_category_key() {
    local file_category="$1"

    case "$file_category" in
        test)
            echo "pre_edit_test"
            ;;
        api)
            echo "pre_edit_api"
            ;;
        component)
            echo "pre_edit_component"
            ;;
        service)
            echo "pre_edit_service"
            ;;
        *)
            echo "pre_edit_generic"
            ;;
    esac
}

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
    local file_category=$(detect_file_category "$file_path")
    local hint_key=$(get_hint_category_key "$file_category")

    # Check if hint already delivered for this category
    if hint_delivered_for "$hint_key"; then
        output_empty
        exit 0
    fi

    # Mark hint as delivered
    mark_hint_delivered "$hint_key"

    # Output category-specific hint
    local context=$(get_category_hint "$file_category")
    output_context "$context"
}

main "$@"

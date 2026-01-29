#!/usr/bin/env bash
# Quoth Plugin - UserPromptSubmit Hook
# Detects user intent and provides context-aware hints

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"

# Detect intent from user prompt text
detect_intent() {
    local prompt_lower="$1"

    # Testing intent
    if echo "$prompt_lower" | grep -qE '(test|spec|vitest|playwright|e2e|unit test|integration test)'; then
        echo "testing"
        return
    fi

    # Review intent
    if echo "$prompt_lower" | grep -qE '(review|audit|check|verify|validate)'; then
        echo "review"
        return
    fi

    # Document intent
    if echo "$prompt_lower" | grep -qE '(document|docs|explain|describe)'; then
        echo "document"
        return
    fi

    # Debug intent
    if echo "$prompt_lower" | grep -qE '(fix|bug|error|debug|issue|broken)'; then
        echo "debug"
        return
    fi

    # No specific intent detected
    echo ""
}

# Get hint text for detected intent
get_intent_hint() {
    local intent="$1"

    case "$intent" in
        testing)
            echo "[Quoth] Test task. Call: quoth_guidelines({ mode: \"code\" })"
            ;;
        review)
            echo "[Quoth] Review task. Call: quoth_guidelines({ mode: \"review\" })"
            ;;
        document)
            echo "[Quoth] Doc task. Call: quoth_guidelines({ mode: \"document\" })"
            ;;
        debug)
            echo "[Quoth] Debug. Search: quoth_search_index({ query: \"error handling\" })"
            ;;
        *)
            echo ""
            ;;
    esac
}

main() {
    # Check if session exists
    if ! session_exists; then
        output_empty
        exit 0
    fi

    # Parse input JSON from stdin
    local input=$(cat)

    # Extract prompt text from input
    local prompt=$(echo "$input" | grep -o '"prompt"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"\([^"]*\)"$/\1/')

    if [ -z "$prompt" ]; then
        output_empty
        exit 0
    fi

    # Convert to lowercase for matching
    local prompt_lower=$(echo "$prompt" | tr '[:upper:]' '[:lower:]')

    # Detect intent
    local intent=$(detect_intent "$prompt_lower")

    if [ -z "$intent" ]; then
        output_empty
        exit 0
    fi

    # Update session with detected intent
    update_session_intent "$intent"

    # Get and output intent-specific hint
    local hint=$(get_intent_hint "$intent")
    if [ -n "$hint" ]; then
        output_context "$hint"
    else
        output_empty
    fi
}

main "$@"

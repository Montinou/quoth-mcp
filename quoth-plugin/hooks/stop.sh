#!/usr/bin/env bash
# Quoth Plugin - Stop Hook
# Displays session summary badge

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"

# ============================================================================
# BADGE GENERATION
# ============================================================================

generate_badge() {
    local patterns_applied="$1"
    local drift_detected="$2"
    local undocumented="$3"

    local badge="Quoth: "

    if [ "$patterns_applied" -gt 0 ]; then
        badge+="$patterns_applied pattern(s) applied"
    else
        badge+="Session complete"
    fi

    if [ "$drift_detected" -gt 0 ]; then
        badge+=" | $drift_detected potential drift"
    fi

    if [ "$undocumented" -gt 0 ]; then
        badge+=" | $undocumented undocumented"
    fi

    echo "$badge"
}

# ============================================================================
# MAIN LOGIC
# ============================================================================

main() {
    # Check if session was active
    if ! session_exists; then
        output_empty
        exit 0
    fi

    # Extract counters from session
    local patterns_applied=$(get_session_counter "patterns_applied")
    local drift_detected=$(get_session_counter "drift_detected")
    local undocumented=$(get_session_counter "undocumented")

    # Only show badge if there was activity
    if [ "$patterns_applied" -eq 0 ] && [ "$drift_detected" -eq 0 ] && [ "$undocumented" -eq 0 ]; then
        cleanup_session
        output_empty
        exit 0
    fi

    # Generate badge
    local badge=$(generate_badge "$patterns_applied" "$drift_detected" "$undocumented")

    # Clean up session file
    cleanup_session

    # Output badge
    output_context "$badge"
}

main "$@"

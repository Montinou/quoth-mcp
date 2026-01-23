# Quoth Plugin for Claude Code

Living documentation layer for AI-native development. This plugin automatically detects Quoth-connected projects and injects context reminding Claude to use documented patterns.

## What It Does

When you start a Claude Code session in a project with Quoth configured:

1. **Detects Quoth Configuration** - Looks for `.quoth/config.json` or `quoth.config.json`
2. **Checks MCP Availability** - Verifies Quoth MCP server is connected
3. **Injects Context** - Reminds Claude to search Quoth before writing code

## Installation

### Option 1: Clone into plugins directory

```bash
# Navigate to your Claude Code plugins directory
cd ~/.claude/plugins

# Clone the plugin
git clone https://github.com/Montinou/quoth quoth-plugin
```

### Option 2: Symlink from Quoth repository

```bash
# If you have Quoth cloned locally
ln -s /path/to/quoth/quoth-plugin ~/.claude/plugins/quoth-plugin
```

### Option 3: Install via Claude Code

```bash
claude plugin add https://github.com/Montinou/quoth
```

## Requirements

- Claude Code CLI installed
- Quoth MCP server configured (optional, but recommended)

### Setting up Quoth MCP

```bash
# Add Quoth MCP with OAuth authentication
claude mcp add --transport http quoth https://quoth.ai-innovation.site/api/mcp

# Or with API key
claude mcp add --transport http quoth https://quoth.ai-innovation.site/api/mcp \
  --header "Authorization: Bearer YOUR_TOKEN"
```

## Configuration

### Project-level Configuration

Create a `.quoth/config.json` or `quoth.config.json` in your project root:

```json
{
  "project_id": "your-project-id",
  "auto_search": true
}
```

### What the Plugin Injects

When Quoth is detected, the plugin adds context about:

- Available Quoth tools (`quoth_search_index`, `quoth_read_doc`, etc.)
- Workflow reminders (search before writing code)
- The Single Source of Truth philosophy

## Plugin Structure

```
quoth-plugin/
  .claude-plugin/
    plugin.json       # Plugin manifest
  hooks/
    hooks.json        # Hook configuration
    session-start.sh  # SessionStart hook - injects Quoth context
    stop.sh           # Stop hook - placeholder for Phase 2 badges
  README.md           # This file
```

## Hooks

### SessionStart Hook

Triggers on `startup` or `resume` events. Checks for:
- `.quoth/config.json` or `quoth.config.json` files
- Quoth MCP server in `claude mcp list`

If found, injects context with:
- Quoth documentation reminders
- Available tools list
- Workflow guidance

### Stop Hook (Phase 2)

Placeholder for future badge system that will:
- Track documentation interaction counts
- Display session summary
- Award badges (Architect/Explorer/Observer/Wanderer)

## Development

### Testing Hooks Locally

```bash
# Test session-start hook
cd /path/to/your/project
/path/to/quoth-plugin/hooks/session-start.sh

# Should output JSON with additionalContext if Quoth is configured
```

### Verifying JSON Output

```bash
# Ensure valid JSON output
./hooks/session-start.sh | jq .
./hooks/stop.sh | jq .
```

## License

MIT License - See [LICENSE](../LICENSE) for details.

## Links

- [Quoth Documentation](https://quoth.ai-innovation.site)
- [Quoth MCP Server](https://github.com/Montinou/quoth)
- [Claude Code Plugins](https://docs.anthropic.com/claude-code/plugins)

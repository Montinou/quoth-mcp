/**
 * Quoth v3.0 Agent CRUD MCP Tools
 * Register, update, remove, list agents in an organization
 * Assign/unassign agents to projects
 *
 * Organization is derived from the authenticated project's organization_id
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AuthContext } from '../auth/mcp-auth';
import { supabase } from '../supabase';
import { logActivity } from './activity';

/**
 * Derive organization_id from the authenticated project
 * All agent operations are scoped to the organization
 */
async function getOrganizationId(projectId: string): Promise<string> {
  const { data, error } = await supabase
    .from('projects')
    .select('organization_id')
    .eq('id', projectId)
    .single();

  if (error || !data?.organization_id) {
    throw new Error(
      'Project is not linked to an organization. Run the v3.0 migration first.'
    );
  }

  return data.organization_id;
}

/**
 * Register all agent management tools on the MCP server
 */
export function registerAgentTools(
  server: McpServer,
  authContext: AuthContext
) {
  // ─── Tool 1: quoth_agent_register ───────────────────────────
  server.registerTool(
    'quoth_agent_register',
    {
      title: 'Register Agent',
      description:
        'Register a new agent in your organization. Agents are org-scoped and can optionally be assigned to projects.',
      inputSchema: {
        agent_name: z
          .string()
          .regex(/^[a-z0-9-]+$/)
          .describe(
            'Unique agent name within org (lowercase, hyphens allowed)'
          ),
        display_name: z
          .string()
          .optional()
          .describe('Human-readable name with emoji, e.g. "Main Orchestrator 🌙"'),
        instance: z
          .string()
          .describe('Instance where agent runs: aws, mac, montino, etc.'),
        model: z
          .string()
          .optional()
          .describe('AI model identifier, e.g. "anthropic/claude-opus-4"'),
        role: z
          .string()
          .optional()
          .describe(
            'Agent role: orchestrator, specialist, curator, admin'
          ),
        capabilities: z
          .record(z.any())
          .optional()
          .describe('Capabilities JSON, e.g. {"gpu": true}'),
        metadata: z
          .record(z.any())
          .optional()
          .describe('Additional metadata'),
      },
    },
    async (args) => {
      const organizationId = await getOrganizationId(authContext.project_id);
      const {
        agent_name,
        display_name,
        instance,
        model,
        role,
        capabilities,
        metadata,
      } = args;

      const { data, error } = await supabase
        .from('agents')
        .insert({
          organization_id: organizationId,
          agent_name,
          display_name,
          instance,
          model,
          role,
          capabilities,
          metadata,
          status: 'active',
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to register agent: ${error.message}`);
      }

      await logActivity({
        projectId: authContext.project_id,
        userId: authContext.user_id,
        eventType: 'agent_register',
        query: agent_name,
        toolName: 'quoth_agent_register',
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: `✅ Agent registered!

**Agent ID:** ${data.id}
**Name:** ${agent_name}
**Display Name:** ${display_name || agent_name}
**Instance:** ${instance}
**Role:** ${role || 'unspecified'}

This agent can now send/receive messages and create shared knowledge.`,
          },
        ],
      };
    }
  );

  // ─── Tool 2: quoth_agent_update ─────────────────────────────
  server.registerTool(
    'quoth_agent_update',
    {
      title: 'Update Agent',
      description: 'Update agent profile, status, or metadata.',
      inputSchema: {
        agent_id: z
          .string()
          .uuid()
          .optional()
          .describe('Agent UUID (or use agent_name)'),
        agent_name: z
          .string()
          .optional()
          .describe('Or specify by name within org'),
        display_name: z.string().optional(),
        status: z
          .enum(['active', 'inactive', 'archived'])
          .optional(),
        model: z.string().optional(),
        role: z.string().optional(),
        capabilities: z.record(z.any()).optional(),
        metadata: z.record(z.any()).optional(),
      },
    },
    async (args) => {
      const organizationId = await getOrganizationId(authContext.project_id);
      const { agent_id, agent_name, ...updates } = args;

      if (!agent_id && !agent_name) {
        throw new Error('Must provide agent_id or agent_name');
      }

      // Remove undefined values
      const cleanUpdates = Object.fromEntries(
        Object.entries(updates).filter(([, v]) => v !== undefined)
      );

      if (Object.keys(cleanUpdates).length === 0) {
        throw new Error('No updates provided');
      }

      let query = supabase
        .from('agents')
        .update(cleanUpdates)
        .eq('organization_id', organizationId);

      if (agent_id) {
        query = query.eq('id', agent_id);
      } else {
        query = query.eq('agent_name', agent_name!);
      }

      const { data, error } = await query.select().single();

      if (error) {
        throw new Error(`Failed to update agent: ${error.message}`);
      }

      await logActivity({
        projectId: authContext.project_id,
        userId: authContext.user_id,
        eventType: 'agent_update',
        query: agent_name || agent_id || '',
        toolName: 'quoth_agent_update',
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: `✅ Agent updated!

**Agent:** ${data.agent_name}
**Updated fields:** ${Object.keys(cleanUpdates).join(', ')}`,
          },
        ],
      };
    }
  );

  // ─── Tool 3: quoth_agent_remove ─────────────────────────────
  server.registerTool(
    'quoth_agent_remove',
    {
      title: 'Remove Agent',
      description:
        'Deactivate (archive) or hard-delete an agent. Default: archive.',
      inputSchema: {
        agent_id: z.string().uuid().optional(),
        agent_name: z.string().optional(),
        hard_delete: z
          .boolean()
          .default(false)
          .describe('If true, permanently delete; if false, set status=archived'),
      },
    },
    async (args) => {
      const organizationId = await getOrganizationId(authContext.project_id);
      const { agent_id, agent_name, hard_delete } = args;

      if (!agent_id && !agent_name) {
        throw new Error('Must provide agent_id or agent_name');
      }

      let query: any;
      if (hard_delete) {
        query = supabase.from('agents').delete();
      } else {
        query = supabase.from('agents').update({ status: 'archived' });
      }

      query = query.eq('organization_id', organizationId);

      if (agent_id) {
        query = query.eq('id', agent_id);
      } else {
        query = query.eq('agent_name', agent_name);
      }

      const { data, error } = await query.select().single();

      if (error) {
        throw new Error(`Failed to remove agent: ${error.message}`);
      }

      await logActivity({
        projectId: authContext.project_id,
        userId: authContext.user_id,
        eventType: 'agent_remove',
        query: agent_name || agent_id || '',
        toolName: 'quoth_agent_remove',
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: hard_delete
              ? `✅ Agent permanently deleted: ${data.agent_name}`
              : `✅ Agent archived: ${data.agent_name}`,
          },
        ],
      };
    }
  );

  // ─── Tool 4: quoth_agent_list ───────────────────────────────
  server.registerTool(
    'quoth_agent_list',
    {
      title: 'List Agents',
      description:
        'List all agents in your organization. Filter by status, instance, or project.',
      inputSchema: {
        status: z
          .enum(['active', 'inactive', 'archived', 'all'])
          .optional()
          .default('active'),
        instance: z
          .string()
          .optional()
          .describe('Filter by instance (aws, mac, montino)'),
        project_id: z
          .string()
          .uuid()
          .optional()
          .describe('Filter by project assignment'),
      },
    },
    async (args) => {
      const organizationId = await getOrganizationId(authContext.project_id);
      const { status, instance, project_id } = args;

      let query = supabase
        .from('agents')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (status !== 'all') {
        query = query.eq('status', status);
      }

      if (instance) {
        query = query.eq('instance', instance);
      }

      // Filter by project assignment if specified
      if (project_id) {
        const { data: assignments } = await supabase
          .from('agent_projects')
          .select('agent_id')
          .eq('project_id', project_id);

        const agentIds = (assignments || []).map(
          (a: { agent_id: string }) => a.agent_id
        );
        if (agentIds.length > 0) {
          query = query.in('id', agentIds);
        } else {
          return {
            content: [
              {
                type: 'text' as const,
                text: 'No agents assigned to this project.',
              },
            ],
          };
        }
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to list agents: ${error.message}`);
      }

      if (!data || data.length === 0) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'No agents found matching your criteria.',
            },
          ],
        };
      }

      const formatted = data
        .map(
          (a) => `- **${a.display_name || a.agent_name}** (\`${a.agent_name}\`)
  - ID: \`${a.id}\`
  - Instance: ${a.instance}
  - Role: ${a.role || 'unspecified'}
  - Model: ${a.model || 'unspecified'}
  - Status: ${a.status}
  - Last seen: ${a.last_seen_at || 'never'}`
        )
        .join('\n');

      return {
        content: [
          {
            type: 'text' as const,
            text: `# Agents in Organization

${formatted}

**Total:** ${data.length}`,
          },
        ],
      };
    }
  );

  // ─── Tool 5: quoth_agent_assign_project ─────────────────────
  server.registerTool(
    'quoth_agent_assign_project',
    {
      title: 'Assign Agent to Project',
      description:
        'Assign an agent to work on a specific project (optional many-to-many).',
      inputSchema: {
        agent_id: z.string().uuid().optional(),
        agent_name: z
          .string()
          .optional()
          .describe('Or specify by name'),
        project_id: z
          .string()
          .uuid()
          .describe('Project to assign agent to'),
        role: z
          .enum(['owner', 'contributor', 'readonly'])
          .optional()
          .default('contributor'),
        assigned_by: z
          .string()
          .optional()
          .describe('Who is making this assignment'),
      },
    },
    async (args) => {
      const organizationId = await getOrganizationId(authContext.project_id);
      const { agent_id, agent_name, project_id, role, assigned_by } = args;

      if (!agent_id && !agent_name) {
        throw new Error('Must provide agent_id or agent_name');
      }

      // Lookup agent if name provided
      let targetAgentId = agent_id;
      if (!targetAgentId) {
        const { data: agent, error } = await supabase
          .from('agents')
          .select('id')
          .eq('organization_id', organizationId)
          .eq('agent_name', agent_name!)
          .single();

        if (error) {
          throw new Error(`Agent "${agent_name}" not found`);
        }
        targetAgentId = agent.id;
      }

      const { error } = await supabase.from('agent_projects').upsert({
        agent_id: targetAgentId,
        project_id,
        role: role || 'contributor',
        assigned_by: assigned_by || authContext.user_id,
      });

      if (error) {
        throw new Error(
          `Failed to assign agent to project: ${error.message}`
        );
      }

      await logActivity({
        projectId: authContext.project_id,
        userId: authContext.user_id,
        eventType: 'agent_assign_project',
        query: agent_name || agent_id || '',
        toolName: 'quoth_agent_assign_project',
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: `✅ Agent assigned to project!

**Agent:** ${agent_name || targetAgentId}
**Project:** ${project_id}
**Role:** ${role || 'contributor'}

The agent can now work on this project while retaining org-wide access.`,
          },
        ],
      };
    }
  );

  // ─── Tool 6: quoth_agent_unassign_project ───────────────────
  server.registerTool(
    'quoth_agent_unassign_project',
    {
      title: 'Unassign Agent from Project',
      description:
        'Remove an agent assignment from a project. Agent retains org-wide access.',
      inputSchema: {
        agent_id: z.string().uuid().optional(),
        agent_name: z.string().optional(),
        project_id: z
          .string()
          .uuid()
          .describe('Project to unassign from'),
      },
    },
    async (args) => {
      const organizationId = await getOrganizationId(authContext.project_id);
      const { agent_id, agent_name, project_id } = args;

      if (!agent_id && !agent_name) {
        throw new Error('Must provide agent_id or agent_name');
      }

      // Lookup agent if name provided
      let targetAgentId = agent_id;
      if (!targetAgentId) {
        const { data: agent, error } = await supabase
          .from('agents')
          .select('id')
          .eq('organization_id', organizationId)
          .eq('agent_name', agent_name!)
          .single();

        if (error) {
          throw new Error(`Agent "${agent_name}" not found`);
        }
        targetAgentId = agent.id;
      }

      const { error } = await supabase
        .from('agent_projects')
        .delete()
        .eq('agent_id', targetAgentId!)
        .eq('project_id', project_id);

      if (error) {
        throw new Error(
          `Failed to unassign agent from project: ${error.message}`
        );
      }

      await logActivity({
        projectId: authContext.project_id,
        userId: authContext.user_id,
        eventType: 'agent_unassign_project',
        query: agent_name || agent_id || '',
        toolName: 'quoth_agent_unassign_project',
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: `✅ Agent unassigned from project!

**Agent:** ${agent_name || targetAgentId}
**Project:** ${project_id}

The agent still has access to org-wide knowledge and messaging.`,
          },
        ],
      };
    }
  );
}

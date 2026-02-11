-- ============================================================
-- Quoth v3.0 Phase 2: Targeted Agent Communication Bus
-- ============================================================
-- Dependencies: Phase 1 (organizations, agents tables)
-- Safe: All CREATE TABLE, no destructive ops

-- ============================================================
-- 1. Agent Messages table (targeted 1-to-1 messaging)
-- ============================================================
CREATE TABLE IF NOT EXISTS agent_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  
  -- Routing (targeted, 1-to-1)
  from_agent_id UUID REFERENCES agents(id) NOT NULL,
  to_agent_id UUID REFERENCES agents(id) NOT NULL,
  
  -- Content
  type TEXT NOT NULL DEFAULT 'message'
    CHECK (type IN ('message', 'task', 'result', 'alert', 'knowledge', 'curator')),
  payload JSONB NOT NULL,
  
  -- Metadata
  channel TEXT,
  priority TEXT DEFAULT 'normal' 
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  reply_to UUID REFERENCES agent_messages(id),
  
  -- Signature (HMAC SHA-256)
  signature TEXT,
  
  -- Lifecycle
  status TEXT DEFAULT 'pending' 
    CHECK (status IN ('pending', 'delivered', 'read', 'failed', 'expired')),
  created_at TIMESTAMPTZ DEFAULT now(),
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '7 days')
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agent_messages_to 
  ON agent_messages(to_agent_id, status, created_at);

CREATE INDEX IF NOT EXISTS idx_agent_messages_from 
  ON agent_messages(from_agent_id, created_at);

CREATE INDEX IF NOT EXISTS idx_agent_messages_org 
  ON agent_messages(organization_id, created_at);

CREATE INDEX IF NOT EXISTS idx_agent_messages_reply 
  ON agent_messages(reply_to) WHERE reply_to IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_agent_messages_pending 
  ON agent_messages(to_agent_id, created_at) 
  WHERE status = 'pending';

-- Enable Realtime (CRITICAL for push notifications)
ALTER PUBLICATION supabase_realtime ADD TABLE agent_messages;

-- Comments
COMMENT ON TABLE agent_messages IS 
  'Targeted agent-to-agent messages. Each message has specific from_agent_id and to_agent_id (1-to-1).';

COMMENT ON COLUMN agent_messages.from_agent_id IS 
  'UUID reference to agents table. Sender.';

COMMENT ON COLUMN agent_messages.to_agent_id IS 
  'UUID reference to agents table. Recipient. Messages are NOT broadcast.';

COMMENT ON COLUMN agent_messages.signature IS 
  'HMAC SHA-256 of from_agent_id:to_agent_id:created_at:shared_secret (first 16 chars)';

COMMENT ON COLUMN agent_messages.type IS 
  'Message type: message (chat), task (work assignment), result (task completion), alert (urgent), knowledge (share findings), curator (curation proposal)';

COMMENT ON COLUMN agent_messages.priority IS 
  'Delivery priority: low (background), normal (default), high (important), urgent (immediate)';

COMMENT ON COLUMN agent_messages.status IS 
  'Lifecycle: pending (awaiting delivery), delivered (pushed to agent), read (acknowledged), failed (delivery error), expired (TTL exceeded)';

-- ============================================================
-- 2. Agent Tasks table (structured task queue)
-- ============================================================
CREATE TABLE IF NOT EXISTS agent_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  
  title TEXT NOT NULL,
  description TEXT,
  
  -- Assignment
  assigned_to UUID REFERENCES agents(id) NOT NULL,
  created_by UUID REFERENCES agents(id) NOT NULL,
  
  -- Lifecycle
  status TEXT DEFAULT 'pending' 
    CHECK (status IN ('pending', 'in_progress', 'done', 'failed', 'cancelled')),
  priority INTEGER DEFAULT 5,
  
  -- Data
  payload JSONB,
  result JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  deadline TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agent_tasks_assigned 
  ON agent_tasks(assigned_to, status);

CREATE INDEX IF NOT EXISTS idx_agent_tasks_org 
  ON agent_tasks(organization_id, created_at);

CREATE INDEX IF NOT EXISTS idx_agent_tasks_deadline 
  ON agent_tasks(deadline) 
  WHERE deadline IS NOT NULL AND status IN ('pending', 'in_progress');

CREATE INDEX IF NOT EXISTS idx_agent_tasks_created_by 
  ON agent_tasks(created_by, created_at);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE agent_tasks;

-- Comments
COMMENT ON TABLE agent_tasks IS 
  'Structured task queue. Higher-level than agent_messages. Used for formal work assignments.';

COMMENT ON COLUMN agent_tasks.priority IS 
  'Integer priority (1=highest, 10=lowest). Default 5. Lower numbers = higher priority.';

COMMENT ON COLUMN agent_tasks.status IS 
  'Task state: pending (not started), in_progress (being worked on), done (completed successfully), failed (error occurred), cancelled (aborted)';

-- ============================================================
-- 3. RLS Policies for agent_messages
-- ============================================================
ALTER TABLE public.agent_messages ENABLE ROW LEVEL SECURITY;

-- Users can view messages in their orgs
CREATE POLICY "Users can view messages in their orgs"
  ON public.agent_messages FOR SELECT
  USING (public.has_org_access(organization_id));

-- Org admins can insert messages (agents use service role)
CREATE POLICY "Org admins can send messages"
  ON public.agent_messages FOR INSERT
  WITH CHECK (public.is_org_admin(organization_id));

-- Org admins can update message status
CREATE POLICY "Org admins can update messages"
  ON public.agent_messages FOR UPDATE
  USING (public.is_org_admin(organization_id))
  WITH CHECK (public.is_org_admin(organization_id));

-- Org admins can delete messages
CREATE POLICY "Org admins can delete messages"
  ON public.agent_messages FOR DELETE
  USING (public.is_org_admin(organization_id));

-- Service role has full access (for agent messaging)
CREATE POLICY "Service role full access to agent_messages"
  ON public.agent_messages FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================
-- 4. RLS Policies for agent_tasks
-- ============================================================
ALTER TABLE public.agent_tasks ENABLE ROW LEVEL SECURITY;

-- Users can view tasks in their orgs
CREATE POLICY "Users can view tasks in their orgs"
  ON public.agent_tasks FOR SELECT
  USING (public.has_org_access(organization_id));

-- Org admins can create tasks
CREATE POLICY "Org admins can create tasks"
  ON public.agent_tasks FOR INSERT
  WITH CHECK (public.is_org_admin(organization_id));

-- Org admins can update tasks
CREATE POLICY "Org admins can update tasks"
  ON public.agent_tasks FOR UPDATE
  USING (public.is_org_admin(organization_id))
  WITH CHECK (public.is_org_admin(organization_id));

-- Org admins can delete tasks
CREATE POLICY "Org admins can delete tasks"
  ON public.agent_tasks FOR DELETE
  USING (public.is_org_admin(organization_id));

-- Service role has full access
CREATE POLICY "Service role full access to agent_tasks"
  ON public.agent_tasks FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================
-- 5. Verify migration
-- ============================================================
DO $$
DECLARE
  messages_count INT;
  tasks_count INT;
  messages_realtime BOOLEAN;
  tasks_realtime BOOLEAN;
BEGIN
  SELECT COUNT(*) INTO messages_count FROM agent_messages;
  SELECT COUNT(*) INTO tasks_count FROM agent_tasks;
  
  -- Check Realtime enabled
  SELECT EXISTS(
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'agent_messages'
  ) INTO messages_realtime;
  
  SELECT EXISTS(
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'agent_tasks'
  ) INTO tasks_realtime;

  RAISE NOTICE 'Phase 2 migration complete:';
  RAISE NOTICE '  agent_messages table: % rows, Realtime: %', messages_count, messages_realtime;
  RAISE NOTICE '  agent_tasks table: % rows, Realtime: %', tasks_count, tasks_realtime;
END $$;

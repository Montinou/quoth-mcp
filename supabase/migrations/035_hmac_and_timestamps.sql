-- ============================================================
-- Quoth v3.0 Migration 035: HMAC + Automatic Timestamps
-- ============================================================
-- Part 1: HMAC signature verification for agent messages
-- Part 2: Automatic updated_at timestamps on mutable tables
--
-- Safe: Idempotent, all additive changes
-- Dependencies: Phase 1 (organizations, agents) + Phase 2 (agent_messages, agent_tasks)

-- ============================================================
-- PART 1A: HMAC — Backfill signing keys
-- ============================================================

DO $$
DECLARE
  updated_count INT;
BEGIN
  -- Backfill any agents with NULL signing_key (safety measure)
  UPDATE agents 
  SET signing_key = encode(gen_random_bytes(32), 'hex')
  WHERE signing_key IS NULL;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled % agents with missing signing keys', updated_count;
END $$;

-- ============================================================
-- PART 1B: HMAC — Make signing_key NOT NULL with default
-- ============================================================

DO $$
BEGIN
  -- Set default for new agents
  IF NOT EXISTS (
    SELECT 1 FROM pg_attrdef 
    WHERE adrelid = 'public.agents'::regclass 
    AND adnum = (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.agents'::regclass AND attname = 'signing_key')
  ) THEN
    ALTER TABLE public.agents 
    ALTER COLUMN signing_key SET DEFAULT encode(gen_random_bytes(32), 'hex');
    RAISE NOTICE 'Set default for agents.signing_key';
  END IF;
  
  -- Make it NOT NULL
  IF EXISTS (
    SELECT 1 FROM pg_attribute 
    WHERE attrelid = 'public.agents'::regclass 
    AND attname = 'signing_key' 
    AND attnotnull = false
  ) THEN
    ALTER TABLE public.agents 
    ALTER COLUMN signing_key SET NOT NULL;
    RAISE NOTICE 'Set agents.signing_key to NOT NULL';
  END IF;
END $$;

-- ============================================================
-- PART 1C: HMAC — Signature generation function
-- ============================================================

CREATE OR REPLACE FUNCTION public.generate_hmac_signature(
  agent_id UUID,
  message_text TEXT
) RETURNS TEXT AS $$
DECLARE
  agent_key TEXT;
  signature TEXT;
BEGIN
  -- Fetch signing key for agent
  SELECT signing_key INTO agent_key
  FROM public.agents
  WHERE id = agent_id;
  
  IF agent_key IS NULL THEN
    RAISE EXCEPTION 'Agent % has no signing key', agent_id;
  END IF;
  
  -- Generate HMAC-SHA256 signature (first 16 hex chars)
  signature := encode(
    hmac(message_text::bytea, agent_key::bytea, 'sha256'),
    'hex'
  );
  
  RETURN substring(signature from 1 for 16);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.generate_hmac_signature IS 
  'Generate HMAC-SHA256 signature for agent messages. Returns first 16 hex chars.';

-- ============================================================
-- PART 1D: HMAC — Signature verification function
-- ============================================================

CREATE OR REPLACE FUNCTION public.verify_hmac_signature(
  agent_id UUID,
  message_text TEXT,
  provided_signature TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  expected_signature TEXT;
BEGIN
  -- Generate expected signature
  expected_signature := public.generate_hmac_signature(agent_id, message_text);
  
  -- Compare with provided signature (constant-time comparison would be ideal in production)
  RETURN expected_signature = provided_signature;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.verify_hmac_signature IS 
  'Verify HMAC-SHA256 signature for agent messages. Returns true if signature matches.';

-- ============================================================
-- PART 2A: Timestamps — Generic trigger function
-- ============================================================

CREATE OR REPLACE FUNCTION public.trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.trigger_set_updated_at IS 
  'Generic trigger function to automatically update updated_at timestamp on row updates.';

-- ============================================================
-- PART 2B: Timestamps — Add updated_at columns
-- ============================================================

-- agent_messages (status changes: pending → delivered → read)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute 
    WHERE attrelid = 'public.agent_messages'::regclass 
    AND attname = 'updated_at'
  ) THEN
    ALTER TABLE public.agent_messages 
    ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
    RAISE NOTICE 'Added updated_at to agent_messages';
  END IF;
END $$;

-- agent_tasks (status, result, started_at, completed_at changes)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute 
    WHERE attrelid = 'public.agent_tasks'::regclass 
    AND attname = 'updated_at'
  ) THEN
    ALTER TABLE public.agent_tasks 
    ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
    RAISE NOTICE 'Added updated_at to agent_tasks';
  END IF;
END $$;

-- organizations (name, slug changes)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute 
    WHERE attrelid = 'public.organizations'::regclass 
    AND attname = 'updated_at'
  ) THEN
    ALTER TABLE public.organizations 
    ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
    RAISE NOTICE 'Added updated_at to organizations';
  END IF;
END $$;

-- projects (name, settings changes)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute 
    WHERE attrelid = 'public.projects'::regclass 
    AND attname = 'updated_at'
  ) THEN
    ALTER TABLE public.projects 
    ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
    RAISE NOTICE 'Added updated_at to projects';
  END IF;
END $$;

-- documents (content, title, checksum changes)
-- Note: documents has last_updated, but we're adding standard updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute 
    WHERE attrelid = 'public.documents'::regclass 
    AND attname = 'updated_at'
  ) THEN
    ALTER TABLE public.documents 
    ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
    RAISE NOTICE 'Added updated_at to documents';
  END IF;
END $$;

-- document_proposals (status changes: pending → approved/rejected → applied)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute 
    WHERE attrelid = 'public.document_proposals'::regclass 
    AND attname = 'updated_at'
  ) THEN
    ALTER TABLE public.document_proposals 
    ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
    RAISE NOTICE 'Added updated_at to document_proposals';
  END IF;
END $$;

-- ============================================================
-- PART 2C: Timestamps — Create triggers
-- ============================================================

-- agent_messages trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'agent_messages_updated_at' 
    AND tgrelid = 'public.agent_messages'::regclass
  ) THEN
    CREATE TRIGGER agent_messages_updated_at
      BEFORE UPDATE ON public.agent_messages
      FOR EACH ROW
      EXECUTE FUNCTION public.trigger_set_updated_at();
    RAISE NOTICE 'Created trigger: agent_messages_updated_at';
  END IF;
END $$;

-- agent_tasks trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'agent_tasks_updated_at' 
    AND tgrelid = 'public.agent_tasks'::regclass
  ) THEN
    CREATE TRIGGER agent_tasks_updated_at
      BEFORE UPDATE ON public.agent_tasks
      FOR EACH ROW
      EXECUTE FUNCTION public.trigger_set_updated_at();
    RAISE NOTICE 'Created trigger: agent_tasks_updated_at';
  END IF;
END $$;

-- organizations trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'organizations_updated_at' 
    AND tgrelid = 'public.organizations'::regclass
  ) THEN
    CREATE TRIGGER organizations_updated_at
      BEFORE UPDATE ON public.organizations
      FOR EACH ROW
      EXECUTE FUNCTION public.trigger_set_updated_at();
    RAISE NOTICE 'Created trigger: organizations_updated_at';
  END IF;
END $$;

-- projects trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'projects_updated_at' 
    AND tgrelid = 'public.projects'::regclass
  ) THEN
    CREATE TRIGGER projects_updated_at
      BEFORE UPDATE ON public.projects
      FOR EACH ROW
      EXECUTE FUNCTION public.trigger_set_updated_at();
    RAISE NOTICE 'Created trigger: projects_updated_at';
  END IF;
END $$;

-- documents trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'documents_updated_at' 
    AND tgrelid = 'public.documents'::regclass
  ) THEN
    CREATE TRIGGER documents_updated_at
      BEFORE UPDATE ON public.documents
      FOR EACH ROW
      EXECUTE FUNCTION public.trigger_set_updated_at();
    RAISE NOTICE 'Created trigger: documents_updated_at';
  END IF;
END $$;

-- document_proposals trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'document_proposals_updated_at' 
    AND tgrelid = 'public.document_proposals'::regclass
  ) THEN
    CREATE TRIGGER document_proposals_updated_at
      BEFORE UPDATE ON public.document_proposals
      FOR EACH ROW
      EXECUTE FUNCTION public.trigger_set_updated_at();
    RAISE NOTICE 'Created trigger: document_proposals_updated_at';
  END IF;
END $$;

-- ============================================================
-- PART 2D: Timestamps — Migrate agents trigger to generic function
-- ============================================================

DO $$
BEGIN
  -- Drop old agents trigger if it uses the old function
  IF EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'agents_updated_at' 
    AND tgrelid = 'public.agents'::regclass
  ) THEN
    DROP TRIGGER agents_updated_at ON public.agents;
    RAISE NOTICE 'Dropped old agents_updated_at trigger';
  END IF;
  
  -- Create new trigger using generic function
  CREATE TRIGGER agents_updated_at
    BEFORE UPDATE ON public.agents
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_set_updated_at();
  RAISE NOTICE 'Created new agents_updated_at trigger with generic function';
END $$;

-- ============================================================
-- PART 3: Verification
-- ============================================================

DO $$
DECLARE
  agents_count INT;
  messages_count INT;
  tasks_count INT;
  has_hmac_gen BOOLEAN;
  has_hmac_verify BOOLEAN;
  null_keys_count INT;
BEGIN
  -- Count records
  SELECT COUNT(*) INTO agents_count FROM agents;
  SELECT COUNT(*) INTO messages_count FROM agent_messages;
  SELECT COUNT(*) INTO tasks_count FROM agent_tasks;
  
  -- Check HMAC functions exist
  SELECT EXISTS(
    SELECT 1 FROM pg_proc 
    WHERE proname = 'generate_hmac_signature'
  ) INTO has_hmac_gen;
  
  SELECT EXISTS(
    SELECT 1 FROM pg_proc 
    WHERE proname = 'verify_hmac_signature'
  ) INTO has_hmac_verify;
  
  -- Check for any remaining NULL signing keys
  SELECT COUNT(*) INTO null_keys_count 
  FROM agents WHERE signing_key IS NULL;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration 035 Complete!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'HMAC Functions:';
  RAISE NOTICE '  generate_hmac_signature: %', has_hmac_gen;
  RAISE NOTICE '  verify_hmac_signature: %', has_hmac_verify;
  RAISE NOTICE '  Agents with NULL keys: %', null_keys_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Updated Timestamp Triggers:';
  RAISE NOTICE '  agents: %', (SELECT COUNT(*) FROM pg_trigger WHERE tgname = 'agents_updated_at');
  RAISE NOTICE '  agent_messages: %', (SELECT COUNT(*) FROM pg_trigger WHERE tgname = 'agent_messages_updated_at');
  RAISE NOTICE '  agent_tasks: %', (SELECT COUNT(*) FROM pg_trigger WHERE tgname = 'agent_tasks_updated_at');
  RAISE NOTICE '  organizations: %', (SELECT COUNT(*) FROM pg_trigger WHERE tgname = 'organizations_updated_at');
  RAISE NOTICE '  projects: %', (SELECT COUNT(*) FROM pg_trigger WHERE tgname = 'projects_updated_at');
  RAISE NOTICE '  documents: %', (SELECT COUNT(*) FROM pg_trigger WHERE tgname = 'documents_updated_at');
  RAISE NOTICE '  document_proposals: %', (SELECT COUNT(*) FROM pg_trigger WHERE tgname = 'document_proposals_updated_at');
  RAISE NOTICE '';
  RAISE NOTICE 'Current Record Counts:';
  RAISE NOTICE '  agents: %', agents_count;
  RAISE NOTICE '  agent_messages: %', messages_count;
  RAISE NOTICE '  agent_tasks: %', tasks_count;
  RAISE NOTICE '========================================';
END $$;

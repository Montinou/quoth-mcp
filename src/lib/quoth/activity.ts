import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Use service role for activity logging (bypasses RLS for inserts)
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export type ActivityEventType = 'search' | 'read' | 'propose' | 'genesis' | 'pattern_match';

export interface ActivityLogParams {
  projectId: string;
  userId?: string;
  eventType: ActivityEventType;
  query?: string;
  documentId?: string;
  patternsMatched?: string[];
  resultCount?: number;
  responseTimeMs?: number;
  context?: Record<string, unknown>;
}

/**
 * Log an activity event to the database.
 * Non-blocking - errors are logged but don't throw.
 */
export async function logActivity(params: ActivityLogParams): Promise<void> {
  try {
    const { error } = await supabase
      .from('quoth_activity')
      .insert({
        project_id: params.projectId,
        user_id: params.userId || null,
        event_type: params.eventType,
        query: params.query || null,
        document_id: params.documentId || null,
        patterns_matched: params.patternsMatched || null,
        result_count: params.resultCount ?? null,
        response_time_ms: params.responseTimeMs ?? null,
        context: params.context || {},
      });

    if (error) {
      console.error('[Activity] Failed to log activity:', error.message);
    }
  } catch (err) {
    // Non-blocking - log and continue
    console.error('[Activity] Unexpected error logging activity:', err);
  }
}

/**
 * Helper to measure and log activity with timing.
 */
export function createActivityLogger(baseParams: Omit<ActivityLogParams, 'responseTimeMs'>) {
  const startTime = Date.now();

  return {
    complete: (overrides?: Partial<ActivityLogParams>) => {
      const responseTimeMs = Date.now() - startTime;
      logActivity({
        ...baseParams,
        ...overrides,
        responseTimeMs,
      });
    },
  };
}

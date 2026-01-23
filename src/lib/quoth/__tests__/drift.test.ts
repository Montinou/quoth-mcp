import { describe, it, expect, vi, beforeEach } from 'vitest';
import { detectDrift, DriftSeverity, DriftType } from '../drift';

// Mock Supabase
vi.mock('../../supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
  },
}));

describe('drift detection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should classify missing documentation as warning severity', async () => {
    const result = await detectDrift({
      projectId: 'test-project',
      filePath: '/api/users/route.ts',
      driftType: 'missing_doc',
      description: 'API endpoint lacks documentation',
    });

    expect(result.severity).toBe('warning');
    expect(result.driftType).toBe('missing_doc');
  });

  it('should classify pattern violation as critical severity', async () => {
    const result = await detectDrift({
      projectId: 'test-project',
      filePath: '/lib/auth.ts',
      driftType: 'pattern_violation',
      description: 'Auth uses deprecated pattern',
      expectedPattern: 'Use Supabase SSR auth',
      actualCode: 'Using client-side auth',
    });

    expect(result.severity).toBe('critical');
  });

  it('should classify stale doc as info severity when < 30 days', async () => {
    const result = await detectDrift({
      projectId: 'test-project',
      filePath: '/patterns/auth.md',
      driftType: 'stale_doc',
      description: 'Document updated 20 days ago',
    });

    expect(result.severity).toBe('info');
  });

  it('should classify stale doc as warning when > 60 days', async () => {
    const result = await detectDrift({
      projectId: 'test-project',
      filePath: '/patterns/auth.md',
      driftType: 'stale_doc',
      description: 'Document updated 75 days ago',
    });

    expect(result.severity).toBe('warning');
  });

  it('should classify stale doc as critical when > 90 days', async () => {
    const result = await detectDrift({
      projectId: 'test-project',
      filePath: '/patterns/auth.md',
      driftType: 'stale_doc',
      description: 'Document updated 95 days ago',
    });

    expect(result.severity).toBe('critical');
  });

  it('should classify code_diverged as warning severity', async () => {
    const result = await detectDrift({
      projectId: 'test-project',
      filePath: '/lib/utils.ts',
      driftType: 'code_diverged',
      description: 'Code implementation differs from documentation',
    });

    expect(result.severity).toBe('warning');
  });

  it('should include optional fields when provided', async () => {
    const result = await detectDrift({
      projectId: 'test-project',
      filePath: '/lib/auth.ts',
      docPath: '/patterns/auth.md',
      documentId: 'doc-123',
      driftType: 'pattern_violation',
      description: 'Auth pattern violation',
      expectedPattern: 'Expected pattern',
      actualCode: 'Actual code',
    });

    expect(result.docPath).toBe('/patterns/auth.md');
    expect(result.documentId).toBe('doc-123');
    expect(result.expectedPattern).toBe('Expected pattern');
    expect(result.actualCode).toBe('Actual code');
  });

  it('should set resolved to false by default', async () => {
    const result = await detectDrift({
      projectId: 'test-project',
      filePath: '/api/test.ts',
      driftType: 'missing_doc',
      description: 'Test drift event',
    });

    expect(result.resolved).toBe(false);
  });

  it('should include detectedAt timestamp', async () => {
    const before = new Date().toISOString();
    const result = await detectDrift({
      projectId: 'test-project',
      filePath: '/api/test.ts',
      driftType: 'missing_doc',
      description: 'Test drift event',
    });
    const after = new Date().toISOString();

    expect(result.detectedAt).toBeDefined();
    expect(result.detectedAt! >= before).toBe(true);
    expect(result.detectedAt! <= after).toBe(true);
  });
});

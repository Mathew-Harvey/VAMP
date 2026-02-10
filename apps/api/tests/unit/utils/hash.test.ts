import { describe, it, expect } from 'vitest';
import { computeAuditHash, verifyAuditChain } from '../../../src/utils/hash';

describe('Audit Hash', () => {
  const baseEntry = {
    sequence: 1,
    actorId: 'user-123',
    entityType: 'Vessel',
    entityId: 'vessel-456',
    action: 'CREATE',
    description: 'Created vessel "Test Ship"',
    previousHash: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
  };

  it('should produce deterministic hashes', () => {
    const hash1 = computeAuditHash(baseEntry);
    const hash2 = computeAuditHash(baseEntry);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 hex
  });

  it('should produce different hashes for different data', () => {
    const hash1 = computeAuditHash(baseEntry);
    const hash2 = computeAuditHash({ ...baseEntry, description: 'Different description' });
    expect(hash1).not.toBe(hash2);
  });

  it('should include previous hash in computation', () => {
    const hash1 = computeAuditHash(baseEntry);
    const hash2 = computeAuditHash({ ...baseEntry, previousHash: 'abc123' });
    expect(hash1).not.toBe(hash2);
  });

  it('should detect tampered entries in chain', () => {
    const entry1 = { ...baseEntry, hash: '', previousHash: null };
    entry1.hash = computeAuditHash(entry1);

    const entry2 = {
      ...baseEntry,
      sequence: 2,
      description: 'Second entry',
      previousHash: entry1.hash,
      hash: '',
    };
    entry2.hash = computeAuditHash(entry2);

    // Valid chain
    const result = verifyAuditChain([entry1, entry2] as any);
    expect(result.valid).toBe(true);

    // Tamper with entry 1
    const tampered1 = { ...entry1, description: 'TAMPERED' };
    const tamperedResult = verifyAuditChain([tampered1, entry2] as any);
    expect(tamperedResult.valid).toBe(false);
    expect(tamperedResult.brokenAt).toBe(1);
  });
});

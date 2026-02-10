import { describe, it, expect } from 'vitest';
import { authService } from '../../../src/services/auth.service';

describe('Auth Service', () => {
  describe('hashPassword', () => {
    it('should hash a password', async () => {
      const hash = await authService.hashPassword('testpassword123');
      expect(hash).toBeDefined();
      expect(hash).not.toBe('testpassword123');
      expect(hash.startsWith('$2')).toBe(true); // bcrypt prefix
    });

    it('should produce different hashes for same password', async () => {
      const hash1 = await authService.hashPassword('testpassword123');
      const hash2 = await authService.hashPassword('testpassword123');
      expect(hash1).not.toBe(hash2); // Different salts
    });
  });
});

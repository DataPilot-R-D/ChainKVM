import { describe, it, expect } from 'vitest';
import { createIssuerTrustList } from '../issuer-trust.js';

describe('createIssuerTrustList', () => {
  const ISSUER_1 = 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK';
  const ISSUER_2 = 'did:key:z6MkpTHR8VNsBxYAAWHut2Geadd9jSwuBV8xRoAnwWsdvktH';
  const ISSUER_3 = 'did:key:z6MknGc3ocHs3zdPiJbnaaqDi58NGb4pk1Sp9WNhZ8o8SYzm';

  describe('isTrusted', () => {
    it('should return true for trusted issuer', () => {
      const trustList = createIssuerTrustList({ trustedIssuers: [ISSUER_1] });

      expect(trustList.isTrusted(ISSUER_1)).toBe(true);
    });

    it('should return false for untrusted issuer', () => {
      const trustList = createIssuerTrustList({ trustedIssuers: [ISSUER_1] });

      expect(trustList.isTrusted(ISSUER_2)).toBe(false);
    });

    it('should handle empty trust list', () => {
      const trustList = createIssuerTrustList({ trustedIssuers: [] });

      expect(trustList.isTrusted(ISSUER_1)).toBe(false);
    });

    it('should handle multiple trusted issuers', () => {
      const trustList = createIssuerTrustList({
        trustedIssuers: [ISSUER_1, ISSUER_2],
      });

      expect(trustList.isTrusted(ISSUER_1)).toBe(true);
      expect(trustList.isTrusted(ISSUER_2)).toBe(true);
      expect(trustList.isTrusted(ISSUER_3)).toBe(false);
    });
  });

  describe('add', () => {
    it('should add new issuer to trust list', () => {
      const trustList = createIssuerTrustList({ trustedIssuers: [ISSUER_1] });

      expect(trustList.isTrusted(ISSUER_2)).toBe(false);

      trustList.add(ISSUER_2);

      expect(trustList.isTrusted(ISSUER_2)).toBe(true);
    });

    it('should handle adding duplicate issuer', () => {
      const trustList = createIssuerTrustList({ trustedIssuers: [ISSUER_1] });

      trustList.add(ISSUER_1);

      expect(trustList.list()).toHaveLength(1);
      expect(trustList.isTrusted(ISSUER_1)).toBe(true);
    });
  });

  describe('remove', () => {
    it('should remove issuer from trust list', () => {
      const trustList = createIssuerTrustList({
        trustedIssuers: [ISSUER_1, ISSUER_2],
      });

      expect(trustList.isTrusted(ISSUER_1)).toBe(true);

      const removed = trustList.remove(ISSUER_1);

      expect(removed).toBe(true);
      expect(trustList.isTrusted(ISSUER_1)).toBe(false);
      expect(trustList.isTrusted(ISSUER_2)).toBe(true);
    });

    it('should return false when removing non-existent issuer', () => {
      const trustList = createIssuerTrustList({ trustedIssuers: [ISSUER_1] });

      const removed = trustList.remove(ISSUER_2);

      expect(removed).toBe(false);
    });
  });

  describe('list', () => {
    it('should return all trusted issuers', () => {
      const trustList = createIssuerTrustList({
        trustedIssuers: [ISSUER_1, ISSUER_2],
      });

      const issuers = trustList.list();

      expect(issuers).toHaveLength(2);
      expect(issuers).toContain(ISSUER_1);
      expect(issuers).toContain(ISSUER_2);
    });

    it('should return empty array for empty trust list', () => {
      const trustList = createIssuerTrustList({ trustedIssuers: [] });

      expect(trustList.list()).toEqual([]);
    });

    it('should reflect changes after add/remove', () => {
      const trustList = createIssuerTrustList({ trustedIssuers: [ISSUER_1] });

      trustList.add(ISSUER_2);
      expect(trustList.list()).toHaveLength(2);

      trustList.remove(ISSUER_1);
      expect(trustList.list()).toHaveLength(1);
      expect(trustList.list()).toContain(ISSUER_2);
    });
  });
});

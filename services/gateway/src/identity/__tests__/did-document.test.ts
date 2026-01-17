import { describe, it, expect } from 'vitest';
import { buildDIDDocument } from '../did-document.js';
import type { ParsedDIDKey } from '../types.js';

const TEST_DID = 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK';
const TEST_IDENTIFIER = 'z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK';

const createParsedKey = (): ParsedDIDKey => ({
  did: TEST_DID,
  method: 'key',
  identifier: TEST_IDENTIFIER,
  codecPrefix: 0xed,
  publicKey: new Uint8Array(32).fill(1),
});

describe('buildDIDDocument', () => {
  describe('structure', () => {
    it('should include required JSON-LD context', () => {
      const doc = buildDIDDocument(createParsedKey());

      expect(doc['@context']).toContain('https://www.w3.org/ns/did/v1');
    });

    it('should include Ed25519 security context', () => {
      const doc = buildDIDDocument(createParsedKey());

      expect(doc['@context']).toContain('https://w3id.org/security/suites/ed25519-2020/v1');
    });

    it('should set document id to the DID', () => {
      const doc = buildDIDDocument(createParsedKey());

      expect(doc.id).toBe(TEST_DID);
    });
  });

  describe('verification method', () => {
    it('should include one verification method', () => {
      const doc = buildDIDDocument(createParsedKey());

      expect(doc.verificationMethod).toHaveLength(1);
    });

    it('should use correct verification method id format', () => {
      const doc = buildDIDDocument(createParsedKey());
      const vm = doc.verificationMethod[0];

      expect(vm.id).toBe(`${TEST_DID}#${TEST_IDENTIFIER}`);
    });

    it('should set type to Ed25519VerificationKey2020', () => {
      const doc = buildDIDDocument(createParsedKey());
      const vm = doc.verificationMethod[0];

      expect(vm.type).toBe('Ed25519VerificationKey2020');
    });

    it('should set controller to the DID', () => {
      const doc = buildDIDDocument(createParsedKey());
      const vm = doc.verificationMethod[0];

      expect(vm.controller).toBe(TEST_DID);
    });

    it('should include public key in multibase format', () => {
      const doc = buildDIDDocument(createParsedKey());
      const vm = doc.verificationMethod[0];

      expect(vm.publicKeyMultibase).toBe(TEST_IDENTIFIER);
    });
  });

  describe('verification relationships', () => {
    it('should include authentication relationship', () => {
      const doc = buildDIDDocument(createParsedKey());

      expect(doc.authentication).toHaveLength(1);
      expect(doc.authentication[0]).toBe(`${TEST_DID}#${TEST_IDENTIFIER}`);
    });

    it('should include assertionMethod relationship', () => {
      const doc = buildDIDDocument(createParsedKey());

      expect(doc.assertionMethod).toHaveLength(1);
      expect(doc.assertionMethod[0]).toBe(`${TEST_DID}#${TEST_IDENTIFIER}`);
    });
  });

  describe('W3C compliance', () => {
    it('should produce valid JSON', () => {
      const doc = buildDIDDocument(createParsedKey());
      const json = JSON.stringify(doc);

      expect(() => JSON.parse(json)).not.toThrow();
    });

    it('should have all required properties', () => {
      const doc = buildDIDDocument(createParsedKey());

      expect(doc).toHaveProperty('@context');
      expect(doc).toHaveProperty('id');
      expect(doc).toHaveProperty('verificationMethod');
      expect(doc).toHaveProperty('authentication');
      expect(doc).toHaveProperty('assertionMethod');
    });
  });
});

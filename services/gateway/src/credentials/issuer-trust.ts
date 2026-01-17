/**
 * Trusted issuer management for VC verification.
 */

export interface IssuerTrustConfig {
  /** List of trusted issuer DIDs */
  trustedIssuers: string[];
}

export interface IssuerTrustList {
  isTrusted(issuer: string): boolean;
  add(issuer: string): void;
  remove(issuer: string): boolean;
  list(): string[];
}

/**
 * Create a mutable trusted issuer list.
 */
export function createIssuerTrustList(config: IssuerTrustConfig): IssuerTrustList {
  const issuers = new Set(config.trustedIssuers);

  return {
    isTrusted(issuer: string): boolean {
      return issuers.has(issuer);
    },

    add(issuer: string): void {
      issuers.add(issuer);
    },

    remove(issuer: string): boolean {
      return issuers.delete(issuer);
    },

    list(): string[] {
      return Array.from(issuers);
    },
  };
}

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createIceConfig,
  DEFAULT_STUN_SERVERS,
  IceServerConfig,
  TurnCredentials,
  getIceServers,
} from './iceConfig';

describe('iceConfig', () => {
  describe('DEFAULT_STUN_SERVERS', () => {
    it('should include Google STUN servers', () => {
      expect(DEFAULT_STUN_SERVERS).toContain('stun:stun.l.google.com:19302');
      expect(DEFAULT_STUN_SERVERS).toContain('stun:stun1.l.google.com:19302');
    });
  });

  describe('createIceConfig', () => {
    it('should create config with default STUN servers when no options provided', () => {
      const config = createIceConfig();

      expect(config.iceServers).toBeDefined();
      expect(config.iceServers!.length).toBeGreaterThan(0);
      expect(config.iceServers![0].urls).toBeDefined();
    });

    it('should include custom STUN servers', () => {
      const customStun = ['stun:custom.stun.server:3478'];
      const config = createIceConfig({ stunServers: customStun });

      const stunServer = config.iceServers!.find((server) =>
        Array.isArray(server.urls)
          ? server.urls.includes('stun:custom.stun.server:3478')
          : server.urls === 'stun:custom.stun.server:3478'
      );
      expect(stunServer).toBeDefined();
    });

    it('should include TURN server when credentials provided', () => {
      const turnCredentials: TurnCredentials = {
        urls: ['turn:turn.server.com:3478'],
        username: 'testuser',
        credential: 'testpass',
      };
      const config = createIceConfig({ turnCredentials });

      const turnServer = config.iceServers!.find(
        (server) =>
          server.username === 'testuser' && server.credential === 'testpass'
      );
      expect(turnServer).toBeDefined();
      expect(turnServer!.urls).toContain('turn:turn.server.com:3478');
    });

    it('should include TURNS (TLS) server when specified', () => {
      const turnCredentials: TurnCredentials = {
        urls: ['turns:turn.server.com:443'],
        username: 'testuser',
        credential: 'testpass',
      };
      const config = createIceConfig({ turnCredentials });

      const turnServer = config.iceServers!.find((server) =>
        Array.isArray(server.urls)
          ? server.urls.some((url) => url.startsWith('turns:'))
          : server.urls.startsWith('turns:')
      );
      expect(turnServer).toBeDefined();
    });

    it('should set iceCandidatePoolSize when specified', () => {
      const config = createIceConfig({ iceCandidatePoolSize: 5 });

      expect(config.iceCandidatePoolSize).toBe(5);
    });

    it('should set iceTransportPolicy when specified', () => {
      const config = createIceConfig({ iceTransportPolicy: 'relay' });

      expect(config.iceTransportPolicy).toBe('relay');
    });

    it('should set bundlePolicy when specified', () => {
      const config = createIceConfig({ bundlePolicy: 'max-bundle' });

      expect(config.bundlePolicy).toBe('max-bundle');
    });

    it('should use default values when not specified', () => {
      const config = createIceConfig();

      expect(config.iceCandidatePoolSize).toBe(0);
      expect(config.iceTransportPolicy).toBe('all');
      expect(config.bundlePolicy).toBe('balanced');
    });
  });

  describe('getIceServers', () => {
    it('should return STUN-only servers by default', () => {
      const servers = getIceServers();

      expect(servers.length).toBeGreaterThan(0);
      const hasOnlyStun = servers.every((server) => {
        const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
        return urls.every((url) => url.startsWith('stun:'));
      });
      expect(hasOnlyStun).toBe(true);
    });

    it('should add TURN servers when credentials provided', () => {
      const turnCredentials: TurnCredentials = {
        urls: ['turn:turn.example.com:3478'],
        username: 'user',
        credential: 'pass',
      };
      const servers = getIceServers(turnCredentials);

      const hasTurn = servers.some((server) => {
        const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
        return urls.some((url) => url.startsWith('turn:'));
      });
      expect(hasTurn).toBe(true);
    });
  });

  describe('IceServerConfig validation', () => {
    it('should support single URL string', () => {
      const config = createIceConfig({
        stunServers: ['stun:single.server.com:3478'],
      });

      expect(config.iceServers![0]).toBeDefined();
    });

    it('should support multiple URLs array', () => {
      const turnCredentials: TurnCredentials = {
        urls: [
          'turn:primary.turn.com:3478',
          'turn:secondary.turn.com:3478',
          'turns:primary.turn.com:443',
        ],
        username: 'user',
        credential: 'pass',
      };
      const config = createIceConfig({ turnCredentials });

      const turnServer = config.iceServers!.find(
        (server) => server.username === 'user'
      );
      expect(turnServer!.urls.length).toBe(3);
    });
  });
});

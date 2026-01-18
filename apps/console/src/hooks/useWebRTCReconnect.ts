import { useCallback, useMemo, useRef, useState } from 'react';

export interface ReconnectOptions {
  enabled: boolean;
  maxAttempts: number;
  delayMs: number;
}

export interface UseWebRTCReconnectOptions {
  config?: ReconnectOptions;
  onReconnectFailed?: () => void;
  checkStillDisconnected?: () => boolean;
}

export interface UseWebRTCReconnectReturn {
  reconnectAttempts: number;
  handleConnected: () => void;
  handleDisconnected: () => void;
  cleanup: () => void;
}

export function useWebRTCReconnect({
  config,
  onReconnectFailed,
  checkStillDisconnected,
}: UseWebRTCReconnectOptions): UseWebRTCReconnectReturn {
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasConnectedRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);

  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  const scheduleReconnect = useCallback(() => {
    if (!config?.enabled) return;

    if (reconnectAttemptsRef.current >= config.maxAttempts) {
      onReconnectFailed?.();
      return;
    }

    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectAttemptsRef.current += 1;
      const newAttempts = reconnectAttemptsRef.current;
      setReconnectAttempts(newAttempts);

      if (newAttempts >= config.maxAttempts) {
        onReconnectFailed?.();
        return;
      }

      if (checkStillDisconnected?.()) {
        scheduleReconnect();
      }
    }, config.delayMs);
  }, [config, onReconnectFailed, checkStillDisconnected]);

  const handleConnected = useCallback(() => {
    wasConnectedRef.current = true;
    reconnectAttemptsRef.current = 0;
    setReconnectAttempts(0);
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const handleDisconnected = useCallback(() => {
    if (wasConnectedRef.current && config?.enabled) {
      scheduleReconnect();
    }
  }, [config?.enabled, scheduleReconnect]);

  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  return useMemo(
    () => ({ reconnectAttempts, handleConnected, handleDisconnected, cleanup }),
    [reconnectAttempts, handleConnected, handleDisconnected, cleanup]
  );
}

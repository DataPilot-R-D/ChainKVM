import { useState, useCallback } from 'react';
import { Layout } from './components/layout';
import { RevocationNotification } from './components/session/RevocationNotification';

export interface RevocationState {
  isRevoked: boolean;
  reason: string;
}

export function App() {
  const [revocation, setRevocation] = useState<RevocationState>({
    isRevoked: false,
    reason: '',
  });

  // Callback to be passed to useSignaling's onRevoked option
  const handleRevoked = useCallback((_sessionId: string, reason: string) => {
    setRevocation({ isRevoked: true, reason });
  }, []);

  const handleDismiss = useCallback(() => {
    // In a real app, this would redirect to login
    // For now, just clear the revocation state
    setRevocation({ isRevoked: false, reason: '' });
  }, []);

  return (
    <>
      <Layout />
      {revocation.isRevoked && (
        <RevocationNotification
          reason={revocation.reason}
          onDismiss={handleDismiss}
        />
      )}
    </>
  );
}

// Export for use with useSignaling hook
export type { RevocationState };

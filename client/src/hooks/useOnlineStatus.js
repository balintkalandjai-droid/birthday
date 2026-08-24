// ============================================================
// useOnlineStatus hook
// Másold a /src/hooks/ mappába (vagy bárhova a src-ben)
// ============================================================
// Használat:
//   import { useOnlineStatus } from '../hooks/useOnlineStatus';
//   const isOnline = useOnlineStatus();
// ============================================================

import { useState, useEffect } from 'react';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline  = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online',  handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

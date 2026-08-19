import { useEffect, useState } from 'react';

const useEventNow = (intervalMs = 1000) => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);

  return now;
};

export default useEventNow;

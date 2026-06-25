import { useState, useEffect } from 'react';

// Phone breakpoint. Matches the `isMobile` definition used by the FPV circuit
// so "mobile" means the same thing everywhere (interactive view is disabled
// below this width).
export const MOBILE_BREAKPOINT = 768;

// Reactive mobile check: re-evaluates on resize/orientation change so routing
// and conditional UI (e.g. the view-switch pill) stay in sync if the viewport
// crosses the breakpoint.
export const useIsMobile = (breakpoint = MOBILE_BREAKPOINT) => {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth <= breakpoint
  );

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= breakpoint);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [breakpoint]);

  return isMobile;
};

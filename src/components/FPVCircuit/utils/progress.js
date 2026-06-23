import { useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';

let globalTargetProgress = 0;
let globalCurrentProgress = 0;
let scrollLocked = false;
// Upper bound for scroll progress. Lowered by the experience so the camera
// comes to rest with the "TRACK COMPLETE" banner framed ahead, rather than
// letting the user scroll past the end of the track.
let globalMaxProgress = 1.02;

export const setMaxProgress = (m) => {
  globalMaxProgress = m;
};

export const setTargetProgress = (p) => {
  if (scrollLocked) return;
  globalTargetProgress = Math.max(-0.02, Math.min(p, globalMaxProgress));
};

export const lockScroll = (duration) => {
  scrollLocked = true;
  setTimeout(() => {
    scrollLocked = false;
  }, duration);
};

export const getGlobalProgress = () => {
  return globalCurrentProgress;
};

export const resetProgress = (newProgress = 0) => {
  globalTargetProgress = newProgress;
  globalCurrentProgress = newProgress;
};

export const useFlightProgress = () => {
  const [progress, setProgress] = useState(0);
  const [isMobile] = useState(() => window.innerWidth <= 768);

  useEffect(() => {
    const handleWheel = (e) => {
      // Very smooth, small delta based on wheel scroll
      const delta = Math.sign(e.deltaY) * 0.0015;
      setTargetProgress(globalTargetProgress + delta);
    };

    window.addEventListener('wheel', handleWheel, { passive: true });
    
    let touchStartY = 0;
    const handleTouchStart = (e) => {
      touchStartY = e.touches[0].clientY;
    };
    const handleTouchMove = (e) => {
      const delta = Math.sign(touchStartY - e.touches[0].clientY) * 0.0015;
      touchStartY = e.touches[0].clientY;
      setTargetProgress(globalTargetProgress + delta);
    };
    
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });

    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
    };
  }, []);

  // Update React state periodically so the UI stays in sync without killing performance
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(globalCurrentProgress);
    }, 100);
    return () => clearInterval(interval);
  }, []);

  return { progress, isMobile };
};

export const FlightController = () => {
  useFrame((state, delta) => {
    // Smooth cinematic damping manually to avoid primitive property assignment
    // lambda = 2.0 for slow, smooth easing
    const lambda = 2.0; 
    globalCurrentProgress += (globalTargetProgress - globalCurrentProgress) * (1 - Math.exp(-lambda * delta));
  });
  return null;
};

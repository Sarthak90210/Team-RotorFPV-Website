import React, { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useIsMobile } from '../hooks/useIsMobile';
import './ViewDropdown.css';

const ViewDropdown = () => {
  const pillRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();

  const isInteractive = location.pathname === '/interactive-achievements';
  const isFormal = location.pathname === '/achievements';

  const views = [
    { label: 'FORMAL', path: '/achievements' },
    { label: 'INTERACTIVE', path: '/interactive-achievements' }
  ];

  const activeIndex = isFormal ? 0 : 1;

  useEffect(() => {
    const pill = pillRef.current;
    if (!pill) return;

    let isScrolling = false;

    const handleWheel = (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (isScrolling) return;
      
      const currentIndex = activeIndex;
      let nextIndex = currentIndex;
      
      if (e.deltaY > 0 && currentIndex < views.length - 1) {
        nextIndex = currentIndex + 1; // Scroll down goes to formal
      } else if (e.deltaY < 0 && currentIndex > 0) {
        nextIndex = currentIndex - 1; // Scroll up goes to interactive
      }
      
      if (nextIndex !== currentIndex && nextIndex >= 0 && nextIndex < views.length) {
        isScrolling = true;
        navigate(views[nextIndex].path);
        
        setTimeout(() => {
          isScrolling = false;
        }, 500); 
      }
    };

    pill.addEventListener('wheel', handleWheel, { passive: false });
    return () => pill.removeEventListener('wheel', handleWheel);
  }, [activeIndex, navigate]);

  // The interactive view is disabled on mobile, so there's nothing to switch
  // to — hide the view-switch pill entirely on phones.
  if (isMobile) {
    return null;
  }

  // Only render on achievement pages
  if (!isInteractive && !isFormal) {
    return null;
  }

  return (
    <div className="view-pill-container" ref={pillRef}>
      <div className="view-cylinder-container">
        {views.map((view, index) => {
          const offset = index - activeIndex;
          const isVisible = Math.abs(offset) <= 1;
          
          return (
            <div
              key={view.label}
              className="view-cylinder-item"
              style={{
                transform: `rotateX(${-offset * 45}deg) translateZ(25px)`,
                opacity: isVisible ? 1 - Math.abs(offset) * 0.5 : 0,
                pointerEvents: isVisible ? 'auto' : 'none',
                color: offset === 0 ? '#ffffff' : '#888888'
              }}
              onClick={() => navigate(view.path)}
            >
              {view.label}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ViewDropdown;

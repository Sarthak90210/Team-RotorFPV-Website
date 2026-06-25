import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import GlassSurface from './GlassSurface';
import './Navbar.css';

const allLinks = [
  { name: 'Gallery', path: '/gallery' },
  { name: 'Sponsor Us', path: '/sponsor-us' },
  { name: 'Drones', path: '/drones' },
  { name: 'Achievements', path: '/achievements' },
  { name: 'Board', path: '/board' },
  { name: 'Events', path: '/events' },
];

const leftLinks = allLinks.slice(0, 3);
const rightLinks = allLinks.slice(3);

const Navbar = () => {
  const location = useLocation();
  const navContainerRef = useRef(null);
  const linkRefs = useRef({});
  const [pillStyle, setPillStyle] = useState({ opacity: 0 });
  const [isInitial, setIsInitial] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  const updatePill = useCallback(() => {
    const activePath = location.pathname;
    const activeEl = linkRefs.current[activePath];
    const container = navContainerRef.current;

    if (!activeEl || !container) {
      setPillStyle((prev) => ({ ...prev, opacity: 0 }));
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const linkRect = activeEl.getBoundingClientRect();

    const paddingX = 14;
    const paddingY = 6;

    setPillStyle({
      left: linkRect.left - containerRect.left - paddingX,
      top: linkRect.top - containerRect.top - paddingY,
      width: linkRect.width + paddingX * 2,
      height: linkRect.height + paddingY * 2,
      opacity: 1,
    });

    // After first render, enable transitions
    if (isInitial) {
      requestAnimationFrame(() => {
        setIsInitial(false);
      });
    }
  }, [location.pathname, isInitial]);

  useEffect(() => {
    updatePill();
  }, [updatePill]);

  // Recalculate on resize
  useEffect(() => {
    window.addEventListener('resize', updatePill);
    return () => window.removeEventListener('resize', updatePill);
  }, [updatePill]);

  const setLinkRef = (path) => (el) => {
    linkRefs.current[path] = el;
  };

  const renderLinks = (links) =>
    links.map((link) => (
      <li key={link.path}>
        <Link
          ref={setLinkRef(link.path)}
          to={link.path}
          className={location.pathname === link.path ? 'active' : ''}
        >
          {link.name}
        </Link>
      </li>
    ));

  return (
    <nav className="navbar">
      <GlassSurface
        width="100%"
        height="100%"
        borderRadius={50}
        brightness={50}
        opacity={0.93}
        blur={11}
        backgroundOpacity={0.15}
        saturation={1.2}
        className="navbar-glass"
      >
        <div className="container nav-container" ref={navContainerRef}>
          {/* Sliding glass pill indicator */}
          <div
            className={`nav-pill ${isInitial ? '' : 'nav-pill--animated'}`}
            style={{
              transform: `translate(${pillStyle.left ?? 0}px, ${pillStyle.top ?? 0}px)`,
              width: pillStyle.width ?? 0,
              height: pillStyle.height ?? 0,
              opacity: pillStyle.opacity ?? 0,
            }}
          >
            <GlassSurface
              width="100%"
              height="100%"
              borderRadius={20}
              brightness={65}
              opacity={0.95}
              blur={20}
              backgroundOpacity={0.25}
              saturation={1.6}
              className="nav-pill-glass"
            />
          </div>

          <ul className="nav-links left-links">
            {renderLinks(leftLinks)}
          </ul>

          <Link to="/" className="nav-logo">
            <img src="/TRFPV_Assets/JUSTLOGO.png" alt="RotorFPV Logo" className="logo-img" />
          </Link>

          <ul className="nav-links right-links">
            {renderLinks(rightLinks)}
          </ul>

          <button className="mobile-menu-btn" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>
      </GlassSurface>

      {/* Mobile Dropdown Menu */}
      <div className={`mobile-dropdown ${menuOpen ? 'open' : ''}`}>
        <GlassSurface
          width="100%"
          height="100%"
          borderRadius={20}
          brightness={50}
          opacity={0.95}
          blur={15}
          backgroundOpacity={0.2}
          saturation={1.2}
          className="mobile-dropdown-glass"
        >
          <ul className="mobile-nav-links">
            {allLinks.map((link) => (
              <li key={link.path}>
                <Link
                  to={link.path}
                  className={location.pathname === link.path ? 'active' : ''}
                  onClick={() => setMenuOpen(false)}
                >
                  {link.name}
                </Link>
              </li>
            ))}
          </ul>
        </GlassSurface>
      </div>
    </nav>
  );
};

export default Navbar;

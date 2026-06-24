import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import './PillNav.css';

/**
 * PillNav (tab variant), adapted from the React Bits PillNav component.
 *
 * The original is a routing nav (anchor/Link per item). This variant drives
 * an in-page tab selection instead: each pill is a <button> that calls
 * onItemClick(key), and the active pill is determined by `activeKey`.
 * The signature GSAP hover-circle animation is preserved.
 *
 * items: [{ key: string, label: string }]
 */
const PillNav = ({
  items = [],
  activeKey,
  onItemClick,
  className = '',
  ease = 'power3.easeOut',
  baseColor = '#64ffda',        // hover-circle + active accent
  pillColor = 'transparent',    // inactive pill background
  hoveredPillTextColor = '#0a192f',
  pillTextColor = '#8892b0',
  initialLoadAnimation = true,
}) => {
  const circleRefs = useRef([]);
  const tlRefs = useRef([]);
  const activeTweenRefs = useRef([]);
  const navItemsRef = useRef(null);

  // Stable signature of the pill set. Used as the layout effect's dependency so
  // it only re-runs when the tabs actually change — NOT on every parent render
  // (e.g. when activeKey changes on a tab click, which would otherwise replay
  // the whole animation and look like the nav "reloading").
  const itemsKey = items.map((it) => it.key).join('|');

  useEffect(() => {
    const layout = () => {
      circleRefs.current.forEach((circle) => {
        if (!circle?.parentElement) return;

        const pill = circle.parentElement;
        const rect = pill.getBoundingClientRect();
        const { width: w, height: h } = rect;
        if (!w || !h) return;

        const R = ((w * w) / 4 + h * h) / (2 * h);
        const D = Math.ceil(2 * R) + 2;
        const delta = Math.ceil(R - Math.sqrt(Math.max(0, R * R - (w * w) / 4))) + 1;
        const originY = D - delta;

        circle.style.width = `${D}px`;
        circle.style.height = `${D}px`;
        circle.style.bottom = `-${delta}px`;

        gsap.set(circle, { xPercent: -50, scale: 0, transformOrigin: `50% ${originY}px` });

        const label = pill.querySelector('.pill-label');
        const white = pill.querySelector('.pill-label-hover');
        if (label) gsap.set(label, { y: 0 });
        if (white) gsap.set(white, { y: h + 12, opacity: 0 });

        const index = circleRefs.current.indexOf(circle);
        if (index === -1) return;

        tlRefs.current[index]?.kill();
        const tl = gsap.timeline({ paused: true });
        tl.to(circle, { scale: 1.2, xPercent: -50, duration: 2, ease, overwrite: 'auto' }, 0);
        if (label) tl.to(label, { y: -(h + 8), duration: 2, ease, overwrite: 'auto' }, 0);
        if (white) {
          gsap.set(white, { y: Math.ceil(h + 100), opacity: 0 });
          tl.to(white, { y: 0, opacity: 1, duration: 2, ease, overwrite: 'auto' }, 0);
        }
        tlRefs.current[index] = tl;
      });
    };

    layout();

    const onResize = () => layout();
    window.addEventListener('resize', onResize);

    if (document.fonts?.ready) {
      document.fonts.ready.then(layout).catch(() => {});
    }

    return () => window.removeEventListener('resize', onResize);
    // itemsKey (not items) keeps this stable across activeKey-only re-renders.
  }, [itemsKey, ease]);

  // Reveal animation — run ONCE on mount only, never on tab switches.
  useEffect(() => {
    if (!initialLoadAnimation || !navItemsRef.current) return;
    const navItems = navItemsRef.current;
    gsap.set(navItems, { width: 0, overflow: 'hidden' });
    gsap.to(navItems, { width: 'auto', duration: 0.6, ease });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEnter = (i) => {
    const tl = tlRefs.current[i];
    if (!tl) return;
    activeTweenRefs.current[i]?.kill();
    activeTweenRefs.current[i] = tl.tweenTo(tl.duration(), { duration: 0.3, ease, overwrite: 'auto' });
  };

  const handleLeave = (i) => {
    const tl = tlRefs.current[i];
    if (!tl) return;
    activeTweenRefs.current[i]?.kill();
    activeTweenRefs.current[i] = tl.tweenTo(0, { duration: 0.2, ease, overwrite: 'auto' });
  };

  const cssVars = {
    '--base': baseColor,
    '--pill-bg': pillColor,
    '--hover-text': hoveredPillTextColor,
    '--pill-text': pillTextColor,
  };

  return (
    <div className="pill-nav-container">
      <nav className={`pill-nav ${className}`} aria-label="Dashboard sections" style={cssVars}>
        <div className="pill-nav-items" ref={navItemsRef}>
          <ul className="pill-list" role="tablist">
            {items.map((item, i) => (
              <li key={item.key} role="presentation">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeKey === item.key}
                  className={`pill${activeKey === item.key ? ' is-active' : ''}`}
                  onClick={() => onItemClick?.(item.key)}
                  onMouseEnter={() => handleEnter(i)}
                  onMouseLeave={() => handleLeave(i)}
                >
                  <span
                    className="hover-circle"
                    aria-hidden="true"
                    ref={(el) => { circleRefs.current[i] = el; }}
                  />
                  <span className="label-stack">
                    <span className="pill-label">{item.label}</span>
                    <span className="pill-label-hover" aria-hidden="true">{item.label}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </div>
  );
};

export default PillNav;

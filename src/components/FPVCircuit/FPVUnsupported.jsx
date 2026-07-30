import React from 'react';
import { Link } from 'react-router-dom';

// Shown when the browser can't provide a WebGL context capable of running the
// FPV circuit. Keeps the neon OSD aesthetic and points the user to the formal
// achievements view (which works everywhere).
export const FPVUnsupported = () => {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '24px',
        background: '#050608',
        color: '#00ffff',
        fontFamily: 'monospace',
        zIndex: 2000,
      }}
    >
      <div style={{ fontSize: '28px', letterSpacing: '2px', marginBottom: '16px' }}>
        SIGNAL LOST — 3D VIEW UNAVAILABLE
      </div>
      <p
        style={{
          maxWidth: '520px',
          lineHeight: 1.6,
          color: '#9fdfe6',
          fontSize: '15px',
          marginBottom: '28px',
        }}
      >
        Your browser couldn't start the WebGL renderer this experience needs
        (<code>ANGLE_instanced_arrays</code> / WebGL2 not available). This usually
        means hardware acceleration is turned off, or your GPU/driver isn't
        supported. Try enabling hardware acceleration in your browser settings and
        reloading — or view the standard achievements below.
      </p>
      <Link
        to="/achievements"
        style={{
          padding: '12px 28px',
          border: '1px solid #00ffff',
          borderRadius: '6px',
          color: '#00ffff',
          textDecoration: 'none',
          fontFamily: 'monospace',
          letterSpacing: '1px',
        }}
      >
        VIEW ACHIEVEMENTS →
      </Link>
    </div>
  );
};

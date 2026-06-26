import React, { useState, useEffect, lazy, Suspense } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useIsMobile } from '../hooks/useIsMobile';
import ShinyText from '../components/ShinyText';
import TiltedCard from '../components/TiltedCard';
import Seo from '../components/Seo';
import ErrorBoundary from '../components/ErrorBoundary';
import './Drones.css';

// The 3D experience pulls in three/drei — load it only when a card is opened.
const DroneExperience = lazy(() => import('../components/DroneViewer/DroneExperience'));

const DroneCard = ({ drone, onClick }) => (
  <button type="button" className="drone-card-button" onClick={onClick} aria-label={`Explore ${drone.name}`}>
    <div className="drone-card-bg">
      <div className="drone-card-media">
        <TiltedCard
          imageSrc={drone.image}
          altText={drone.name}
          containerHeight="240px"
          containerWidth="180px"
          imageHeight="240px"
          imageWidth="180px"
          rotateAmplitude={12}
          scaleOnHover={1.08}
          showMobileWarning={false}
          showTooltip={false}
        />
      </div>
      <div className="drone-card-info">
        <h3 className="drone-card-name">{drone.name}</h3>
        {drone.description && <p className="drone-card-desc">{drone.description}</p>}
        <span className="drone-card-cta">Explore in 3D →</span>
      </div>
    </div>
  </button>
);

const Drones = () => {
  const [drones, setDrones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selected, setSelected] = useState(null);
  const [mobileNotice, setMobileNotice] = useState(false);
  const isMobile = useIsMobile();

  // The 3D viewer is desktop-only (heavy + scroll/orbit doesn't map to touch),
  // so on phones a card tap shows a notice instead of launching it.
  const openDrone = (drone) => {
    if (isMobile) setMobileNotice(true);
    else setSelected(drone);
  };

  useEffect(() => {
    const qDrones = query(collection(db, 'drones'), orderBy('order', 'asc'));
    const unsub = onSnapshot(qDrones, (snapshot) => {
      const all = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((d) => d.isActive !== false && d.modelUrl);
      setDrones(all);
      setLoadError(false);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching drones:', error);
      setLoadError(true);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return (
    <div className="drones-page">
      <Seo title="Drones" description="Explore Team RotorFPV's custom-built racing drones in interactive 3D — frames, motors, and electronics designed and assembled by the team." />
      <div className="drones-content">
        <h2 className="drones-title">
          <ShinyText text="Drones" speed={3} />
        </h2>

        <div className="drones-grid">
          {drones.map((drone) => (
            <DroneCard key={drone.id} drone={drone} onClick={() => openDrone(drone)} />
          ))}
        </div>

        {!loading && loadError && (
          <p className="drones-empty">Couldn't load drones right now. Please refresh to try again.</p>
        )}
        {!loading && !loadError && drones.length === 0 && (
          <p className="drones-empty">No drones to show yet. Check back soon!</p>
        )}
      </div>

      {selected && (
        <ErrorBoundary
          onReset={() => setSelected(null)}
          fallback={
            <div className="drone-mobile-notice" role="alert" onClick={() => setSelected(null)}>
              <div className="drone-mobile-notice-box" onClick={(e) => e.stopPropagation()}>
                <div className="drone-mobile-notice-icon">⚠️</div>
                <h3>Couldn't load the 3D viewer</h3>
                <p>The model failed to load. Please check your connection and try again.</p>
                <button type="button" className="drone-mobile-notice-btn" onClick={() => setSelected(null)}>Close</button>
              </div>
            </div>
          }
        >
          <Suspense fallback={null}>
            <DroneExperience
              modelUrl={selected.modelUrl}
              name={selected.name}
              description={selected.longDescription || selected.description || ''}
              components={selected.components || []}
              onClose={() => setSelected(null)}
            />
          </Suspense>
        </ErrorBoundary>
      )}

      {mobileNotice && (
        <div
          className="drone-mobile-notice"
          role="dialog"
          aria-modal="true"
          onClick={() => setMobileNotice(false)}
        >
          <div className="drone-mobile-notice-box" onClick={(e) => e.stopPropagation()}>
            <div className="drone-mobile-notice-icon">🖥️</div>
            <h3>Best viewed on desktop</h3>
            <p>The interactive 3D drone viewer isn’t available on mobile. Open this page on a laptop or desktop to explore the model.</p>
            <button
              type="button"
              className="drone-mobile-notice-btn"
              onClick={() => setMobileNotice(false)}
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Drones;

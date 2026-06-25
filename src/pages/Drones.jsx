import React, { useState, useEffect, lazy, Suspense } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import ShinyText from '../components/ShinyText';
import TiltedCard from '../components/TiltedCard';
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
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const qDrones = query(collection(db, 'drones'), orderBy('order', 'asc'));
    const unsub = onSnapshot(qDrones, (snapshot) => {
      const all = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((d) => d.isActive !== false && d.modelUrl);
      setDrones(all);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching drones:', error);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return (
    <div className="drones-page">
      <div className="drones-content">
        <h2 className="drones-title">
          <ShinyText text="Drones" speed={3} />
        </h2>

        <div className="drones-grid">
          {drones.map((drone) => (
            <DroneCard key={drone.id} drone={drone} onClick={() => setSelected(drone)} />
          ))}
        </div>

        {!loading && drones.length === 0 && (
          <p className="drones-empty">No drones to show yet. Check back soon!</p>
        )}
      </div>

      {selected && (
        <Suspense fallback={null}>
          <DroneExperience modelUrl={selected.modelUrl} onClose={() => setSelected(null)} />
        </Suspense>
      )}
    </div>
  );
};

export default Drones;

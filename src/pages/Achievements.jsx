import React, { useState, useEffect } from 'react';
import './Achievements.css';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { FPVCircuitProvider } from '../components/FPVCircuit/FPVCircuitProvider';
import { FPVExperience } from '../components/FPVCircuit/FPVExperience';
import Seo from '../components/Seo';

const Achievements = () => {
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // If you want actual firebase data, keep this.
    // We are locking body scroll locally for the FPV experience via CSS.
    document.body.style.overflow = 'auto'; // ensure scroll is enabled
    document.documentElement.style.overflow = 'auto';

    const q = query(collection(db, 'achievements'), orderBy('order', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAchievements(data);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching achievements: ", error);
      // Fallback data for preview/testing if firebase fails or is empty
      setAchievements([
        { id: '1', title: 'National Champions', year: '2023', position: '1st', description: 'Won the national drone racing championship.' },
        { id: '2', title: 'Best Engineering', year: '2023', position: '2nd', description: 'Awarded for best custom frame design.' },
        { id: '3', title: 'Global Qualifiers', year: '2024', position: '3rd', description: 'Qualified for the international tournament.' },
        { id: '4', title: 'Speed Record', year: '2024', position: '1st', description: 'Broke the track speed record.' },
        { id: '5', title: 'Innovation Award', year: '2025', position: '1st', description: 'New aerodynamic propulsion system.' },
        { id: '6', title: 'Endurance Test', year: '2025', position: '2nd', description: 'Longest flight time in competition.' },
        { id: '7', title: 'Autonomous Flight', year: '2026', position: '1st', description: 'First fully autonomous circuit completion.' },
      ]);
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="achievements-loading" style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00ffff', fontFamily: 'monospace', fontSize: '24px' }}>
        BOOTING O4 OSD...
      </div>
    );
  }

  return (
    <div className="achievements-page-fpv">
      <Seo description="Fly through Team RotorFPV's achievements in an interactive 3D FPV circuit." />
      <FPVCircuitProvider rawAchievements={achievements}>
        {/* The canvas container is fixed, but the page itself is scrollable to drive progress */}
        <div className="fpv-canvas-container">
          <FPVExperience />
        </div>
        {/* Empty scrollable space */}
        <div className="fpv-scroll-space"></div>
      </FPVCircuitProvider>
    </div>
  );
};

export default Achievements;

import React, { useEffect, useState, useRef } from 'react';
import GlassSurface from '../components/GlassSurface';
import ShinyText from '../components/ShinyText';
import TiltedCard from '../components/TiltedCard';
import { FaLinkedin, FaGithub } from 'react-icons/fa';
import { collection, onSnapshot, query, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import Seo from '../components/Seo';
import './Board.css';

const MemberCard = ({ member }) => {
  return (
    <GlassSurface
      className="member-card-glass"
      width="250px"
      height="450px"
      borderRadius={15}
      brightness={40}
      opacity={0.8}
      blur={10}
      backgroundOpacity={0.1}
      useFallback={true}
    >
      <div className="member-card">
        <TiltedCard
          imageSrc={member.image}
          altText={member.name}
          containerHeight="280px"
          containerWidth="220px"
          imageHeight="280px"
          imageWidth="220px"
          rotateAmplitude={12}
          scaleOnHover={1.05}
          showMobileWarning={false}
          showTooltip={false}
          displayOverlayContent={true}
          overlayContent={
            <div className="tilted-card-name-overlay">{member.name}</div>
          }
        />
        <div className={`member-info-below ${member.jobTitle ? 'has-job-title' : ''}`}>
          <h3 className="member-name-text">{member.name}</h3>
          <p className="member-role-text">{member.role}</p>
          {member.jobTitle && <p className="member-job-title">{member.jobTitle}</p>}
          <div className="member-socials">
            <a href={member.linkedin} className="member-linkedin" target="_blank" rel="noreferrer">
              <FaLinkedin size={24} />
            </a>
            {member.github && (
              <a href={member.github} className="member-github" target="_blank" rel="noreferrer">
                <FaGithub size={24} />
              </a>
            )}
          </div>
        </div>
      </div>
    </GlassSurface>
  );
};

const formatBoardYear = (year) => {
  if (typeof year === 'string' && year.length === 4 && !isNaN(parseInt(year))) {
    return `${year}-${parseInt(year) + 1}`;
  }
  return year;
};

const Board = () => {
  const [teamData, setTeamData] = useState({});
  const [years, setYears] = useState([]);
  const [teamYearsData, setTeamYearsData] = useState({});
  const [activeYear, setActiveYear] = useState(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showExBoardOverlay, setShowExBoardOverlay] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const pillRef = useRef(null);
  const isWheelScrollingRef = useRef(false);
  const overscrollAmountRef = useRef(0);

  // All transition timers are tracked here and cleared on unmount so a year
  // change in flight can't fire setState on an unmounted component.
  const timersRef = useRef([]);
  const schedule = (fn, ms) => {
    const id = setTimeout(fn, ms);
    timersRef.current.push(id);
    return id;
  };
  useEffect(() => () => timersRef.current.forEach(clearTimeout), []);

  useEffect(() => {
    // We need to fetch team years and members
    const unsubs = [];
    
    // Default structure helper
    const getEmptyYear = () => ({ leaders: [], technical: [], essential: [] });

    // 1. Fetch years
    const qYears = query(collection(db, 'team_years'), orderBy('year', 'desc'));
    const unsubYears = onSnapshot(qYears, (snapshot) => {
      const fetchedYears = [];
      const yearsDataMap = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        fetchedYears.push(data.year);
        yearsDataMap[data.year] = { id: doc.id, ...data };
      });
      setYears(fetchedYears);
      setTeamYearsData(yearsDataMap);
      if (fetchedYears.length > 0) {
         setActiveYear(prev => prev || fetchedYears[0]);
      }
    }, (err) => {
      console.error('Error fetching team_years:', err);
      setError('Error fetching years: ' + err.message);
      setLoading(false);
    });
    unsubs.push(unsubYears);

    // 2. Fetch active members
    const qMembers = query(collection(db, 'team_members'), orderBy('order', 'asc'));
    const unsubMembers = onSnapshot(qMembers, async (snapshot) => {
      
      const rawMembers = snapshot.docs.map(d => ({ id: d.id, ...d.data() })).filter(d => d.isActive !== false);
      const userIds = [...new Set(rawMembers.map(m => m.userId).filter(Boolean))];

      // Fetch all referenced users
      const usersMap = {};
      try {
        const userDocs = await Promise.all(userIds.map(id => getDoc(doc(db, 'users', id))));
        userDocs.forEach(d => {
          if (d.exists()) {
            usersMap[d.id] = d.data();
          }
        });
      } catch (err) {
        console.error("Error fetching users for board:", err);
      }

      const newTeamData = {};
      
      rawMembers.forEach(data => {
        const year = data.year;
        if (!newTeamData[year]) {
          newTeamData[year] = getEmptyYear();
        }
        
        let category = data.category || 'leaders';
        if (category === 'miscellaneous') category = 'essential';
        
        // Merge user data
        const userData = usersMap[data.userId] || {};
        const mergedMember = {
          ...data,
          name: userData.name || data.name || 'Unknown',
          image: userData.image || data.image || '',
          linkedin: userData.linkedin || data.linkedin || '',
          github: userData.github || data.github || '',
          jobTitle: userData.jobTitle || data.jobTitle || ''
        };

        if (newTeamData[year][category]) {
          newTeamData[year][category].push(mergedMember);
        }
      });
      
      setTeamData(newTeamData);
      setLoading(false);
    }, (err) => {
      console.error('Error fetching team_members:', err);
      setError('Error fetching members: ' + err.message);
      setLoading(false);
    });
    unsubs.push(unsubMembers);

    return () => unsubs.forEach(unsub => unsub());
  }, []);

  const changeYear = (newYear) => {
    if (newYear === activeYear) return;
    setIsAnimating(true);
    // Slight delay to allow fade out, then change data and fade in
    schedule(() => {
      setActiveYear(newYear);
      setIsAnimating(false);
    }, 300); // 300ms transition time
  };

  useEffect(() => {
    const pill = pillRef.current;
    if (!pill) return;

    const handleWheel = (e) => {
      e.preventDefault();
      
      if (isWheelScrollingRef.current) return;
      
      const currentIndex = years.indexOf(activeYear);
      let nextIndex = currentIndex;
      
      if (e.deltaY > 0 && currentIndex < years.length - 1) {
        nextIndex = currentIndex + 1; // Scroll down goes to next year
      } else if (e.deltaY < 0 && currentIndex > 0) {
        nextIndex = currentIndex - 1; // Scroll up goes to previous year
      }
      
      if (nextIndex !== currentIndex) {
        isWheelScrollingRef.current = true;
        const nextYear = years[nextIndex];
        changeYear(nextYear);

        // Unlock wheel scrolling after animation
        schedule(() => {
          isWheelScrollingRef.current = false;
        }, 800);
      }
    };

    pill.addEventListener('wheel', handleWheel, { passive: false });
    return () => pill.removeEventListener('wheel', handleWheel);
  }, [activeYear, years]);

  useEffect(() => {
    const handleWindowWheel = (e) => {
      // Only trigger if not already animating/transitioning
      if (!isWheelScrollingRef.current && !isAnimating && !showExBoardOverlay) {
        if (e.deltaY > 0) {
          // Check if at the bottom of the page
          const scrollPosition = window.innerHeight + window.scrollY;
          const threshold = document.body.offsetHeight - 50; // Give leeway
          
          if (scrollPosition >= threshold) {
            overscrollAmountRef.current += e.deltaY;
            
            if (overscrollAmountRef.current > 300) {
              const currentIndex = years.indexOf(activeYear);
              if (currentIndex < years.length - 1) { // If there is a previous board
                const nextYear = years[currentIndex + 1];
                
                isWheelScrollingRef.current = true;
                overscrollAmountRef.current = 0;
                
                if (currentIndex === 0) {
                  setShowExBoardOverlay(true);
                  
                  // Change year immediately (which triggers its own 300ms fade)
                  changeYear(nextYear);
                  
                  // Smoothly scroll back to the top
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                  
                  // Hide the overlay after 1 second
                  schedule(() => {
                    setShowExBoardOverlay(false);
                  }, 1000);

                  // Unlock scrolling
                  schedule(() => {
                    isWheelScrollingRef.current = false;
                  }, 1200);
                } else {
                  // For older years, just change year without the overlay delay
                  changeYear(nextYear);
                  window.scrollTo({ top: 0, behavior: 'smooth' });

                  // Unlock scrolling after regular animation
                  schedule(() => {
                    isWheelScrollingRef.current = false;
                  }, 800);
                }
              }
            }
          } else {
            overscrollAmountRef.current = 0;
          }
        } else {
          // Scrolling up resets the overscroll amount
          overscrollAmountRef.current = 0;
        }
      }
    };

    window.addEventListener('wheel', handleWindowWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWindowWheel);
  }, [activeYear, years, isAnimating, showExBoardOverlay]);


  if (error) {
    return (
      <div className="team-page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'white' }}>
        <p style={{ color: '#ff6b6b' }}>{error}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="team-page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'white' }}>
        <p>Loading roster...</p>
      </div>
    );
  }

  if (years.length === 0 || !activeYear) {
    return (
      <div className="team-page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'white' }}>
        <p>No team data available.</p>
      </div>
    );
  }

  const activeData = teamData[activeYear] || { leaders: [], technical: [], essential: [] };

  // Touch devices can't drive the pill with a scroll wheel, so the mobile arrows
  // step through years directly. Years are sorted newest-first, so up goes to a
  // newer year (lower index) and down to an older one.
  const activeIndex = years.indexOf(activeYear);
  const goToNewerYear = () => {
    if (activeIndex > 0) changeYear(years[activeIndex - 1]);
  };
  const goToOlderYear = () => {
    if (activeIndex >= 0 && activeIndex < years.length - 1) changeYear(years[activeIndex + 1]);
  };

  return (
    <div className="team-page">
      <Seo description="Meet the team behind Team RotorFPV — the management, technical, and essential members driving VIT's FPV drone racing team." />
      <div className="team-content">
        <div className={`team-year-section active-section ${isAnimating ? 'fade-out' : 'fade-in'}`}>
          <h2 className="year-title">
            <ShinyText text={`Meet Our ${formatBoardYear(activeYear)} Board`} speed={3} />
          </h2>
          
          {activeData.leaders.length > 0 && <h3 className="section-heading">Management</h3>}
          <div className="team-leaders">
            {activeData.leaders.map((member) => (
              <MemberCard key={member.id} member={member} />
            ))}
          </div>
          
          {activeData.technical.length > 0 && <h3 className="section-heading">Technical</h3>}
          <div className="team-grid">
            {activeData.technical.map((member) => (
              <MemberCard key={member.id} member={member} />
            ))}
          </div>

          {activeData.essential.length > 0 && <h3 className="section-heading">Essential</h3>}
          <div className="team-grid">
            {activeData.essential.map((member) => (
              <MemberCard key={member.id} member={member} />
            ))}
          </div>

          {teamYearsData[activeYear]?.seniorCorePhoto && (
            <>
              <h3 className="section-heading" style={{ marginTop: '40px' }}>Senior Core</h3>
              <div className="senior-core-photo-container">
                <TiltedCard
                  imageSrc={teamYearsData[activeYear].seniorCorePhoto}
                  altText="Senior Core"
                  containerHeight="400px"
                  containerWidth="100%"
                  imageHeight="400px"
                  imageWidth="100%"
                  rotateAmplitude={5}
                  scaleOnHover={1.02}
                  showMobileWarning={false}
                  showTooltip={false}
                  displayOverlayContent={false}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* The Pill Timeline */}
      <div className="timeline-pill-container" ref={pillRef}>
        {/* Mobile-only year steppers (no scroll wheel on touch) */}
        <button
          type="button"
          className="timeline-arrow timeline-arrow--up"
          onClick={goToNewerYear}
          disabled={activeIndex <= 0}
          aria-label="Newer year"
        >
          ▲
        </button>

        <GlassSurface
          width={100}
          height={130}
          borderRadius={30}
          brightness={40}
          opacity={0.8}
          blur={10}
          backgroundOpacity={0.1}
          className="timeline-pill-glass"
          useFallback={true}
        >
          <div className="cylinder-container">
            {years.map((year, index) => {
              const offset = index - activeIndex;
              const isVisible = Math.abs(offset) <= 2;
              
              return (
                <div
                  key={year}
                  className={`cylinder-item ${offset === 0 ? 'active' : ''}`}
                  style={{
                    transform: `rotateX(${-offset * 40}deg)`,
                    opacity: isVisible ? 1 - Math.abs(offset) * 0.5 : 0,
                    pointerEvents: isVisible ? 'auto' : 'none',
                    scale: offset === 0 ? 1.05 : 0.95
                  }}
                  onClick={() => changeYear(year)}
                >
                  {formatBoardYear(year)}
                </div>
              );
            })}
          </div>
        </GlassSurface>

        <button
          type="button"
          className="timeline-arrow timeline-arrow--down"
          onClick={goToOlderYear}
          disabled={activeIndex >= years.length - 1}
          aria-label="Older year"
        >
          ▼
        </button>
      </div>

      {showExBoardOverlay && (
        <div className="ex-board-overlay">
          <h2>EX BOARD</h2>
        </div>
      )}
    </div>
  );
};

export default Board;

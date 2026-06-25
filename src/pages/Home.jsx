import React, { useRef, useState, useEffect } from 'react';
import { doc, onSnapshot, collection, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import VariableProximity from '../components/VariableProximity';
import ShinyText from '../components/ShinyText';
import GlassSurface from '../components/GlassSurface';
import PixelCard from '../components/PixelCard';
import './Home.css';

const DEFAULT_ABOUT =
  "Team Rotor FPV is VIT's premier first-person-view drone racing and engineering team. We design, build, and fly high-performance racing drones from the ground up — pushing the limits of aerodynamics, electronics, and control systems. United by a passion for flight, we compete at national and international stages while fostering hands-on technical education for the next generation of engineers.";

const EventCard = ({ event, onClick }) => (
  <button type="button" className="event-card-button" onClick={onClick} aria-label={`Explore ${event.name}`}>
    <GlassSurface
      className="event-card-glass"
      width="100%"
      height="340px"
      borderRadius={15}
      brightness={40}
      opacity={0.8}
      blur={10}
      backgroundOpacity={0.1}
      useFallback={true}
    >
      <PixelCard variant="blue" className="event-card-inner">
        <div className="event-image-wrap">
          <img src={event.image} alt={event.name} className="event-image" loading="lazy" />
          <div className="event-name-overlay">{event.name}</div>
        </div>
        <div className="event-info">
          <h4 className="event-name">{event.name}</h4>
          {event.description && <p className="event-desc">{event.description}</p>}
        </div>
      </PixelCard>
    </GlassSurface>
  </button>
);

const EventModal = ({ event, onClose }) => {
  const [index, setIndex] = useState(0);

  // Build the picture set: cover first, then any gallery images (de-duplicated).
  const images = [...new Set([event.image, ...(event.galleryImages || [])].filter(Boolean))];
  const longDesc = event.longDescription?.trim() ? event.longDescription : (event.description || '');

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') setIndex((i) => (i + 1) % images.length);
      else if (e.key === 'ArrowLeft') setIndex((i) => (i - 1 + images.length) % images.length);
    };
    document.addEventListener('keydown', onKey);
    // Lock background scroll while the modal is open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [images.length, onClose]);

  const go = (dir) => setIndex((i) => (i + dir + images.length) % images.length);

  return (
    <div className="event-modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label={event.name}>
      <div className="event-modal" onClick={(e) => e.stopPropagation()}>
        <button className="event-modal-close" onClick={onClose} aria-label="Close">×</button>

        <div className="event-modal-gallery">
          {/* Render every image stacked so they're all loaded up-front — switching
              is then instant (just a crossfade) instead of fetching on each click. */}
          {images.map((src, i) => (
            <img
              key={src}
              src={src}
              alt={`${event.name} ${i + 1}`}
              className={`event-modal-image ${i === index ? 'active' : ''}`}
            />
          ))}
          {images.length > 1 && (
            <>
              <button className="gallery-nav prev" onClick={() => go(-1)} aria-label="Previous image">‹</button>
              <button className="gallery-nav next" onClick={() => go(1)} aria-label="Next image">›</button>
              <div className="gallery-dots">
                {images.map((_, i) => (
                  <button
                    key={i}
                    className={`gallery-dot ${i === index ? 'active' : ''}`}
                    onClick={() => setIndex(i)}
                    aria-label={`Go to image ${i + 1}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        <div className="event-modal-body">
          <span className={`event-status-badge ${event.status === 'past' ? 'past' : 'upcoming'}`}>
            {event.status === 'past' ? 'Past Event' : 'Upcoming Event'}
          </span>
          <h3 className="event-modal-title">{event.name}</h3>
          {longDesc
            .split('\n')
            .filter((line) => line.trim() !== '')
            .map((line, i) => (
              <p key={i} className="event-modal-desc">{line}</p>
            ))}
        </div>
      </div>
    </div>
  );
};

const Home = () => {
  const containerRef = useRef(null);
  const [videoSrc, setVideoSrc] = useState("/TRFPV_Assets/Teamvideo.mp4");
  const [aboutText, setAboutText] = useState(DEFAULT_ABOUT);
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'settings', 'home'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setVideoSrc(data.backgroundVideoUrl || "/TRFPV_Assets/Teamvideo.mp4");
        setAboutText(data.aboutUs?.trim() ? data.aboutUs : DEFAULT_ABOUT);
      } else {
        setVideoSrc("/TRFPV_Assets/Teamvideo.mp4");
        setAboutText(DEFAULT_ABOUT);
      }
    }, (error) => {
      console.error("Error fetching home settings:", error);
    });

    const qEvents = query(collection(db, 'events'), orderBy('order', 'asc'));
    const unsubEvents = onSnapshot(qEvents, (snapshot) => {
      const all = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(ev => ev.isActive !== false);
      setEvents(all);
    }, (error) => {
      console.error("Error fetching events:", error);
    });

    return () => {
      unsubscribe();
      unsubEvents();
    };
  }, []);

  // Samsung-style scroll effect: the hero video shrinks (and rounds) as the
  // user scrolls into the page, and grows back when scrolling up. We drive it
  // with a 0→1 progress var so the actual animation lives in CSS.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Writing only a CSS custom property (no layout read) is cheap enough to do
    // directly on each scroll event without rAF throttling.
    const update = () => {
      const distance = window.innerHeight * 0.6; // fully shrunk after ~60vh
      const progress = Math.min(1, Math.max(0, window.scrollY / distance));
      el.style.setProperty('--hero-scroll', progress.toString());
    };

    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);

  const upcomingEvents = events.filter(ev => (ev.status || 'upcoming') === 'upcoming');
  const pastEvents = events.filter(ev => ev.status === 'past');

  return (
    <>
      <div className="home-container" ref={containerRef}>
        <div className="video-background">
          <video key={videoSrc} autoPlay loop muted playsInline>
            <source src={videoSrc} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
          <div className="video-overlay"></div>
        </div>

        <div className="hero-content">
          <h1 className="brand-font hero-quote">
            <VariableProximity
              label='"Build . Fly . Crash . Repeat"'
              className="variable-proximity-demo"
              fromFontVariationSettings="'wght' 200, 'opsz' 9"
              toFontVariationSettings="'wght' 500, 'opsz' 40"
              containerRef={containerRef}
              radius={120}
              falloff="exponential"
            />
          </h1>
        </div>
      </div>

      <section id="about-us" className="about-section">
        <div className="about-content">
          <h2 className="about-title">
            <ShinyText text="About Us" speed={3} />
          </h2>
          {aboutText
            .split('\n')
            .filter((line) => line.trim() !== '')
            .map((line, idx) => (
              <p key={idx} className="about-paragraph">{line}</p>
            ))}
        </div>
      </section>

      {events.length > 0 && (
        <section id="events" className="events-section">
          <div className="events-content">
            <h2 className="events-title">
              <ShinyText text="Events" speed={3} />
            </h2>

            {upcomingEvents.length > 0 && (
              <div className="events-group">
                <h3 className="events-subheading">Upcoming Events</h3>
                <div className="events-grid">
                  {upcomingEvents.map((ev) => (
                    <EventCard key={ev.id} event={ev} onClick={() => setSelectedEvent(ev)} />
                  ))}
                </div>
              </div>
            )}

            {pastEvents.length > 0 && (
              <div className="events-group">
                <h3 className="events-subheading">Past Events</h3>
                <div className="events-grid">
                  {pastEvents.map((ev) => (
                    <EventCard key={ev.id} event={ev} onClick={() => setSelectedEvent(ev)} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {selectedEvent && (
        <EventModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}
    </>
  );
};

export default Home;

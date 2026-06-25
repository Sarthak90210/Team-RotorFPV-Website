import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, doc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import ShinyText from '../components/ShinyText';
import SpotlightCard from '../components/SpotlightCard';
import LogoLoop from '../components/LogoLoop';
import { Cpu, Code, Factory } from 'lucide-react';
import './SponsorUs.css';

const SponsorUs = () => {
  const [sponsors, setSponsors] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Fetch settings
    const unsubSettings = onSnapshot(doc(db, 'settings', 'sponsors'), (docSnap) => {
      if (docSnap.exists()) {
        setSettings(docSnap.data());
      } else {
        setSettings({
          title: 'Sponsor Us',
          description: '',
          teamImage: { url: '' },
          brochure: { url: '' },
          whySponsorUs: ''
        });
      }
    });

    // Fetch sponsors
    const q = query(
      collection(db, "sponsors"),
      orderBy("order", "asc")
    );

    const unsubSponsors = onSnapshot(q, (snapshot) => {
      const allSponsors = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSponsors(allSponsors.filter(s => s.isActive !== false));
      setLoading(false);
    }, (error) => {
      console.error("Error fetching sponsors:", error);
      setLoading(false);
    });

    return () => {
      unsubSettings();
      unsubSponsors();
    };
  }, []);

  if (loading) {
    return (
      <div className="partners-page">
        <div className="partners-content flex-center">
          <div className="loading-spinner">Loading sponsors...</div>
        </div>
      </div>
    );
  }

  const getDownloadUrl = (url) => {
    if (!url) return "#";
    
    // Raw files (PDFs) don't support image transformations, they download by default with the download attribute
    if (url.includes('/raw/upload/')) {
      return url;
    }

    // Force download by appending fl_attachment for images/videos
    if (url.includes('cloudinary.com') && url.includes('/upload/')) {
      return url.replace('/upload/', '/upload/fl_attachment/');
    }
    return url;
  };

  // The contact form now lives on the home page; go there and scroll to it.
  const goToContact = () => {
    navigate('/');
    setTimeout(() => {
      document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
    }, 350);
  };

  const helpOptions = [
    {
      title: "Technical Collaboration",
      icon: Cpu,
      description: "Component donations, dev boards, electronics and hardware."
    },
    {
      title: "Software & Licenses",
      icon: Code,
      description: "Software licenses, compute credits, SDKs."
    },
    {
      title: "Manufacturing",
      icon: Factory,
      description: "Machining, 3D printing, carbon fiber cutting, and custom parts fabrication."
    }
  ];

  return (
    <div className="partners-page">
      <div className="partners-content fade-in">

        {/* Sponsor Us Hero */}
        <section className="sponsor-hero">
          <div className="sponsor-hero-grid">
            <div className="sponsor-hero-text">
              <h2 className="sponsor-hero-title">
                <ShinyText text={settings?.title || "Sponsor Us"} speed={3} />
              </h2>
              <p>{settings?.description || "Partnering with Team Rotor FPV provides a unique platform to engage with a highly passionate community of engineers, innovators, and drone enthusiasts. Your support fuels our journey in pushing the boundaries of FPV technology, competing at international stages, and fostering technical education."}</p>
              
              <div className="hero-actions">
                <a 
                  href={getDownloadUrl(settings?.brochure?.url)} 
                  target={settings?.brochure?.url ? "_blank" : "_self"} 
                  rel="noreferrer" 
                  download={settings?.brochure?.name || "RotorFPV_Brochure.pdf"}
                  className="brochure-btn"
                  onClick={(e) => {
                    if (!settings?.brochure?.url) {
                      e.preventDefault();
                      alert("Brochure has not been uploaded yet. Please upload it from the Admin Panel.");
                    }
                  }}
                >
                  Download Brochure
                </a>
                <button onClick={goToContact} className="contact-btn">
                  Contact Us
                </button>
              </div>
            </div>

            <div className="sponsor-hero-image">
              {settings?.teamImage?.url ? (
                <img src={settings.teamImage.url} alt="Team Rotor FPV" />
              ) : (
                <div className="image-placeholder">Team Image Area</div>
              )}
            </div>
          </div>
        </section>

        {/* How Can You Help */}
        <section className="how-to-help-section">
          <h2 className="section-title">
            <ShinyText text="How Can You Help" speed={3} />
          </h2>
          <div className="help-cards-grid">
            {helpOptions.map((option, idx) => (
              <SpotlightCard key={idx} className="help-card" spotlightColor="rgba(59, 130, 246, 0.5)">
                <div className="help-card-icon">
                  <option.icon size={32} />
                </div>
                <h3>{option.title}</h3>
                <p>{option.description}</p>
              </SpotlightCard>
            ))}
          </div>
        </section>

        {/* Why Sponsor Us */}
        <section className="why-sponsor-section">
          <h2 className="section-title">
            <ShinyText text="Why Sponsor Us" speed={3} />
          </h2>
          <SpotlightCard className="why-sponsor-card" spotlightColor="rgba(59, 130, 246, 0.2)">
            <div className="why-sponsor-content">
              {(settings?.whySponsorUs || "By sponsoring us, you gain valuable brand visibility among future tech leaders and contribute to the growth of cutting-edge aerospace initiatives.")
                .split('\n')
                .filter(line => line.trim() !== '')
                .map((line, idx) => {
                  const trimmed = line.trim();
                  if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
                    return (
                      <div key={idx} className="sponsor-bullet">
                        <span className="bullet-icon">•</span>
                        <span>{trimmed.substring(1).trim()}</span>
                      </div>
                    );
                  }
                  return <p key={idx}>{line}</p>;
                })}
            </div>
          </SpotlightCard>
        </section>

        {/* Our Sponsors Grid */}
        <h2 className="year-title" style={{ marginTop: '60px' }}>
          <ShinyText text="Our Sponsors" speed={3} />
        </h2>
        
        {sponsors.length > 0 ? (
          <div className="sponsors-loop">
            <LogoLoop
              logos={sponsors.map((sponsor) => ({
                src: sponsor.logo,
                alt: sponsor.name,
                title: sponsor.name,
                href: sponsor.website
              }))}
              speed={80}
              direction="left"
              logoHeight={64}
              gap={80}
              hoverSpeed={0}
              scaleOnHover
              ariaLabel="Our sponsors"
              renderItem={(item) => (
                <a
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="sponsor-loop-link"
                  aria-label={item.title}
                >
                  <img src={item.src} alt={item.alt} className="sponsor-loop-logo" draggable={false} />
                  <span className="sponsor-loop-name">{item.title}</span>
                </a>
              )}
            />
          </div>
        ) : (
          <div className="no-partners">
            <p>Sponsors will be added here soon.</p>
          </div>
        )}

      </div>
    </div>
  );
};

export default SponsorUs;

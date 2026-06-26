import { useEffect } from 'react';

// Per-route document title + meta description.
//
// This is a SPA with no SSR, so social scrapers (which don't run JS) rely on the
// static tags in index.html. This component handles the JS-side concerns:
// updating the browser tab title on navigation and keeping the existing meta
// description in sync for JS-rendering crawlers (e.g. Googlebot). It UPDATES the
// existing tags rather than appending, so there are never duplicate tags.
const SITE_NAME = 'Team RotorFPV';

const Seo = ({ title, description }) => {
  const fullTitle = title ? `${title} — ${SITE_NAME}` : SITE_NAME;

  useEffect(() => {
    document.title = fullTitle;
    if (description) {
      const tag = document.querySelector('meta[name="description"]');
      if (tag) tag.setAttribute('content', description);
    }
  }, [fullTitle, description]);

  return null;
};

export default Seo;

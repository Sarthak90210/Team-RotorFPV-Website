import { useEffect } from 'react';

// Per-route meta description, for SEO / JS-rendering crawlers (Googlebot).
// The browser tab title is intentionally left CONSTANT ("Team RotorFPV", from
// index.html) — this component never changes document.title, so every page shows
// the same tab title. Social scrapers rely on the static tags in index.html.
const Seo = ({ description }) => {
  useEffect(() => {
    if (description) {
      const tag = document.querySelector('meta[name="description"]');
      if (tag) tag.setAttribute('content', description);
    }
  }, [description]);

  return null;
};

export default Seo;

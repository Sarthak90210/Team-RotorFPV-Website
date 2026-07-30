import React from 'react';
import { FPVUnsupported } from './FPVUnsupported';

// Catches any runtime error thrown from inside the WebGL Canvas (e.g. a driver
// that reports instancing support up front but then fails mid-render) so it
// degrades to the fallback instead of crashing the whole page.
export class FPVErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('FPV circuit failed to render:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return <FPVUnsupported />;
    }
    return this.props.children;
  }
}

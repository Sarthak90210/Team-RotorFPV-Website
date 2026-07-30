// The FPV circuit needs the ANGLE_instanced_arrays capability in TWO places:
//
//  1. three.js instanced rendering for the scene geometry.
//  2. drei's <Text> (troika-three-text) — it creates its OWN WebGL1 context to
//     build the glyph SDF atlas, and the atlas blit hard-requires the
//     ANGLE_instanced_arrays extension with NO JavaScript fallback. When it's
//     missing, troika throws an *async* "ANGLE_instanced_arrays not supported"
//     rejection that React error boundaries can't catch, and the page dies.
//
// troika always requests a WebGL1 context for this, so the real capability we
// must verify is: a WebGL1 context that exposes ANGLE_instanced_arrays. Some
// environments (hardware acceleration disabled, blocklisted GPUs, VMs / remote
// desktops) hand back a context without it — those simply can't run this scene,
// so we detect that up front and show a fallback instead of crashing.
export const detectWebGLSupport = () => {
  try {
    const canvas = document.createElement('canvas');

    const gl1 =
      canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    const instancing = !!(gl1 && gl1.getExtension('ANGLE_instanced_arrays'));
    const webgl2 = !!canvas.getContext('webgl2');

    // Gate on ANGLE_instanced_arrays specifically — it's the exact extension
    // troika needs and also covers three's instanced geometry.
    return { supported: instancing, webgl2, instancing };
  } catch {
    return { supported: false, webgl2: false, instancing: false };
  }
};

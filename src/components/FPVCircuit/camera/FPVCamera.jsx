import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getGlobalProgress } from '../utils/progress';

// World-space distance (in track units) the camera looks ahead of itself.
// Matches the spacing between loops in TrackGenerator (spacingZ = 250) so that,
// at the instant the drone passes through the last loop before an achievement,
// the camera is aimed exactly at that achievement (perfectly centered). It also
// makes the camera yaw/bank toward the next loop like a real drone chasing gates.
export const LOOK_AHEAD_DISTANCE = 250;

export const FPVCamera = ({ spline }) => {
  const targetLookAt = useRef(new THREE.Vector3());
  const currentPos = useRef(new THREE.Vector3());
  const currentLookAt = useRef(new THREE.Vector3());

  // Track total target rotations for tricks
  const targetBank = useRef(0);
  const targetPitch = useRef(0);

  // Total arc length of the spline, computed once. Used to convert the fixed
  // world-space look-ahead distance into the normalized [0,1] curve parameter,
  // so anticipation stays consistent regardless of total track length.
  const totalLength = useMemo(() => (spline ? spline.getLength() : 1), [spline]);

  useFrame((state, delta) => {
    if (!spline) return;

    // We no longer rely on external easing for `p` because FlightController handles smooth damping of globalCurrentProgress.
    // We just read the current damped value directly.
    const p = Math.max(0, Math.min(getGlobalProgress(), 1));

    const splinePos = spline.getPointAt(p);
    const tangent = spline.getTangentAt(p);
    
    // Look-ahead calculation: aim a fixed world-distance ahead along the track,
    // so the camera turns to face the next loop in its direction of travel.
    const lookAheadU = Math.min(p + LOOK_AHEAD_DISTANCE / totalLength, 1);
    const lookAheadPos = spline.getPointAt(lookAheadU);
    
    // Add banking (roll) based on how sharp the curve is turning
    const up = new THREE.Vector3(0, 1, 0);
    const axis = new THREE.Vector3().crossVectors(up, tangent).normalize();
    const baseBankAngle = axis.x * 0.15; 

    // Calculate FPV Tricks!
    let trickRoll = 0;
    let trickPitch = 0;
    
    // Barrel rolls at various track percentages
    const rollCenters = [0.35];
    rollCenters.forEach((center, idx) => {
      // Extended trick duration (16% of track) so it slowly rolls through gates
      const t = (p - center) / 0.08; 
      if (t > -1 && t < 1) {
        const nT = (t + 1) / 2;
        // Alternate left/right rolls based on index
        const direction = idx % 2 === 0 ? 1 : -1;
        trickRoll += direction * nT * nT * (3 - 2 * nT) * Math.PI * 2;
      } else if (t >= 1) {
        const direction = idx % 2 === 0 ? 1 : -1;
        trickRoll += direction * Math.PI * 2;
      }
    });

    // Flips have been removed per user request to keep visibility clear.
    trickPitch = 0;

    // Calculate final target look-at position
    targetLookAt.current.copy(lookAheadPos);
    
    // Smoothly interpolate current camera position to spline position
    const dist = currentPos.current.distanceTo(splinePos);
    // Use a smaller lerp factor if we're jumping to a new track (>500 units away)
    // so it travels beautifully through 3D space
    const posLerpFactor = dist > 500 ? 0.02 : 0.5;
    currentPos.current.lerp(splinePos, posLerpFactor);
    state.camera.position.copy(currentPos.current);

    // Smoothly interpolate where the camera is looking
    const lookAtLerpFactor = dist > 500 ? 0.02 : 0.5;
    currentLookAt.current.lerp(targetLookAt.current, lookAtLerpFactor);
    
    // Base camera orientation
    state.camera.lookAt(currentLookAt.current);
    
    // Smoothly apply tricks using references to maintain momentum/lag
    targetBank.current = THREE.MathUtils.lerp(targetBank.current, baseBankAngle + trickRoll, 0.1);
    targetPitch.current = THREE.MathUtils.lerp(targetPitch.current, trickPitch, 0.1);
    
    // Apply local rotations for the tricks!
    state.camera.rotateX(targetPitch.current);
    state.camera.rotateZ(targetBank.current);
  });

  return null;
};

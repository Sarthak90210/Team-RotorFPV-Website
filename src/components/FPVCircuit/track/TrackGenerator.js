import * as THREE from 'three';

export const generateContinuousTrack = (yearCircuits) => {
  if (!yearCircuits || yearCircuits.length === 0) {
    return {
      masterSpline: new THREE.CatmullRomCurve3([new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,-1)]),
      allIslandsData: []
    };
  }

  let masterPoints = [];
  const spacingZ = 250;
  const scatterWidthX = 100;
  const scatterHeightY = 100;

  let currentZ = 0;
  let allIslandsData = [];
  
  // First, we accumulate all checkpoints, images, arrows for each year
  // But we also need to build the continuous masterPoints array.

  yearCircuits.forEach((yearData, yearIndex) => {
    const isFirstYear = yearIndex === 0;
    const isLastYear = yearIndex === yearCircuits.length - 1;

    let startPos = new THREE.Vector3(0, 0, currentZ);
    let checkpoints = [];
    let checkpointIndex = 0;

    // Approach Monument
    if (isFirstYear) {
      // Start 300m away, pass straight through the monument (at 0,0,0)
      masterPoints.push(startPos.clone().add(new THREE.Vector3(0, 0, 300))); 
      masterPoints.push(startPos.clone().add(new THREE.Vector3(0, 0, 100)));
      masterPoints.push(startPos.clone().add(new THREE.Vector3(0, 0, -200)));
      currentZ -= 400; // Far past monument
    } else {
      // We are arriving from the transition loops!
      // The previous transition loop ended exactly 100 units before this monument.
      // We pass through the monument.
      masterPoints.push(startPos.clone().add(new THREE.Vector3(0, 0, 100)));
      masterPoints.push(startPos.clone());
      masterPoints.push(startPos.clone().add(new THREE.Vector3(0, 0, -200)));
      currentZ -= 400; 
    }

    yearData.achievements.forEach((ach, index) => {
      const numFiller = Math.floor(Math.random() * 3) + 1;
      
      const achXOffset = Math.sin((checkpointIndex + numFiller) * 0.8) * scatterWidthX; 
      const achYOffset = Math.sin((checkpointIndex + numFiller) * 1.7) * scatterHeightY; 

      for (let j = 0; j < numFiller; j++) {
        let xOffset, yOffset;
        if (j === numFiller - 1) {
          // The last loop before the achievement aligns perfectly with it
          xOffset = achXOffset;
          yOffset = achYOffset;
        } else {
          xOffset = Math.sin(checkpointIndex * 0.8) * scatterWidthX; 
          yOffset = Math.sin(checkpointIndex * 1.7) * scatterHeightY; 
        }

        checkpoints.push({
          type: 'gate',
          id: `gate-${yearIndex}-${checkpointIndex}`,
          worldPosition: new THREE.Vector3(
            startPos.x + xOffset,
            startPos.y + yOffset, 
            currentZ
          )
        });
        currentZ -= spacingZ;
        checkpointIndex++;
      }

      // Achievement
      checkpoints.push({ 
        ...ach, 
        type: 'achievement',
        globalIndex: index,
        worldPosition: new THREE.Vector3(
          startPos.x + achXOffset,
          startPos.y + achYOffset, 
          currentZ
        )
      });
      currentZ -= spacingZ;
      checkpointIndex++;
    });

    // Pass through every checkpoint
    checkpoints.forEach((cp) => {
      masterPoints.push(cp.worldPosition.clone().add(new THREE.Vector3(0, 0, 50)));
      masterPoints.push(cp.worldPosition.clone());
      masterPoints.push(cp.worldPosition.clone().add(new THREE.Vector3(0, 0, -50)));
    });

    const lastCpPos = checkpoints.length > 0 
      ? checkpoints[checkpoints.length - 1].worldPosition 
      : startPos.clone().add(new THREE.Vector3(0, 0, -400));
    
    const exitPos = lastCpPos.clone().add(new THREE.Vector3(0, 0, -spacingZ));
    masterPoints.push(exitPos);

    // Transition to the next year
    let finalPosition = null;

    if (!isLastYear) {
      // Snake through 3 transition loops before arriving at the next year's monument
      const nextYearStartPos = new THREE.Vector3(0, 0, exitPos.z - 2000); // 2000 units gap
      
      const gapDistance = exitPos.z - nextYearStartPos.z; // 2000
      const loopSpacing = gapDistance / 4; // 500 units per loop

      for (let i = 1; i <= 3; i++) {
        const loopZ = exitPos.z - (i * loopSpacing);
        // Snake pattern: alternate left and right, and maybe up/down
        const loopX = Math.sin(i * 1.5) * 150;
        const loopY = Math.cos(i * 1.5) * 100;
        
        const loopPos = new THREE.Vector3(loopX, loopY, loopZ);
        
        // Add it directly as a gate checkpoint so YearCircuit renders it like all other loops
        checkpoints.push({
          type: 'gate',
          id: `trans-gate-${yearIndex}-${i}`,
          worldPosition: loopPos
        });

        masterPoints.push(loopPos.clone().add(new THREE.Vector3(0, 0, 100)));
        masterPoints.push(loopPos.clone());
        masterPoints.push(loopPos.clone().add(new THREE.Vector3(0, 0, -100)));
      }

      currentZ = nextYearStartPos.z; // Set up Z for the next year!

    } else {
      // Final Rise, then a straight run-up. The TRACK COMPLETE banner sits at the
      // very end of the spline; the experience clamps max scroll to one look-ahead
      // distance short of it, so the banner rests centered ahead and can't be flown past.
      const risePos = exitPos.clone().add(new THREE.Vector3(0, 30, -80));
      masterPoints.push(risePos.clone());

      finalPosition = risePos.clone().add(new THREE.Vector3(0, 0, -400));
      masterPoints.push(finalPosition.clone());
    }

    allIslandsData.push({
      ...yearData,
      checkpoints: checkpoints,
      startPos: startPos.clone(),
      islandLength: Math.abs(startPos.z - currentZ), 
      finalPosition: finalPosition ? finalPosition.clone() : null
    });
  });

  const masterSpline = new THREE.CatmullRomCurve3(masterPoints, false, 'catmullrom', 0.5);
  const lengths = masterSpline.getLengths();
  const totalLength = lengths[lengths.length - 1];

  // Helper to accurately find the spline progress 'p' for a given world position
  const getProgressForTarget = (targetPos, searchStartP = 0, searchEndP = 1) => {
    let bestP = searchStartP;
    let minDist = Infinity;
    const steps = 2000;
    for (let i = 0; i <= steps; i++) {
      const p = searchStartP + (i / steps) * (searchEndP - searchStartP);
      const pt = masterSpline.getPointAt(p);
      const d = pt.distanceToSquared(targetPos);
      if (d < minDist) {
        minDist = d;
        bestP = p;
      }
    }
    // Refine search around bestP
    const refineSteps = 50;
    const stepSize = (searchEndP - searchStartP) / steps;
    const refineStart = Math.max(searchStartP, bestP - stepSize);
    const refineEnd = Math.min(searchEndP, bestP + stepSize);
    for (let i = 0; i <= refineSteps; i++) {
      const p = refineStart + (i / refineSteps) * (refineEnd - refineStart);
      const pt = masterSpline.getPointAt(p);
      const d = pt.distanceToSquared(targetPos);
      if (d < minDist) {
        minDist = d;
        bestP = p;
      }
    }
    return bestP;
  };

  let currentSearchP = 0;
  
  allIslandsData.forEach((island, yearIndex) => {
    // Start progress (find monument position)
    island.startProgress = getProgressForTarget(island.startPos, currentSearchP, 1.0);
    currentSearchP = island.startProgress;

    // Checkpoints
    island.checkpoints.forEach((cp) => {
      cp.progress = getProgressForTarget(cp.worldPosition, currentSearchP, 1.0);
      currentSearchP = cp.progress;
    });

    // End progress of this year
    const isLastYear = yearIndex === allIslandsData.length - 1;
    if (isLastYear) {
      island.endProgress = 1.0;
    } else {
      // For middle years, endProgress is the start of the next year
      // We will set this in a second pass or estimate it as the last checkpoint's progress
      island.endProgress = currentSearchP + 0.001; 
    }
  });

  // Second pass to accurately set endProgress
  for (let i = 0; i < allIslandsData.length - 1; i++) {
    allIslandsData[i].endProgress = allIslandsData[i + 1].startProgress - 0.001;
  }

  // Generate floating images and arrows
  allIslandsData.forEach((island, yearIndex) => {
    // Collect all images available in this year
    const allImages = [];
    island.achievements.forEach(ach => {
      if (ach.images && ach.images.length > 0) {
        allImages.push(...ach.images);
      } else if (ach.imageUrl) {
        allImages.push(ach.imageUrl);
      }
    });

    const floatingImages = [];
    if (allImages.length > 0) {
      const numImages = Math.floor(Math.random() * 2) + 1;
      let imgIdx = Math.floor(Math.random() * allImages.length);

      for (let i = 0; i < numImages; i++) {
        // Random spot within THIS island's progress segment
        const p = island.startProgress + 0.15 * (island.endProgress - island.startProgress) + Math.random() * 0.7 * (island.endProgress - island.startProgress);
        
        let isTooClose = false;
        island.checkpoints.forEach((cp) => {
          if (Math.abs(cp.progress - p) < 0.03) isTooClose = true;
        });
        if (isTooClose) continue;

        const point = masterSpline.getPointAt(p);
        const tangent = masterSpline.getTangentAt(p);
        const img = allImages[imgIdx++ % allImages.length];
        
        const isVertical = Math.random() > 0.5;
        const offsetDistance = 250 + Math.random() * 100;
        const side = Math.random() > 0.5 ? 1 : -1;
        
        let pos;
        if (isVertical) {
          pos = point.clone().add(new THREE.Vector3(0, offsetDistance * side, 0));
        } else {
          const up = new THREE.Vector3(0, 1, 0);
          const right = new THREE.Vector3().crossVectors(tangent, up).normalize();
          pos = point.clone().add(right.multiplyScalar(offsetDistance * side));
        }
          
        floatingImages.push({
          id: `random-img-${yearIndex}-${i}`,
          src: img,
          position: pos,
          rotation: new THREE.Euler(0, Math.atan2(tangent.x, tangent.z), 0),
          scale: 150 + Math.random() * 100 
        });
      }
    }
    island.floatingImages = floatingImages;

    // Guide arrows
    const guideArrows = [];
    // Number of arrows proportional to segment length (balanced density ground)
    const segmentLength = (island.endProgress - island.startProgress) * totalLength;
    const numArrows = Math.floor(segmentLength / 100); // balanced mid-range spacing
    
    for (let i = 0; i <= numArrows; i++) {
      const p = island.startProgress + (i / numArrows) * (island.endProgress - island.startProgress);
      
      if (p >= 0.0 && p <= 1.0) {
        const pos = masterSpline.getPointAt(Math.max(0, Math.min(p, 1)));
        const tangent = masterSpline.getTangentAt(Math.max(0, Math.min(p, 1)));
        
        const up = new THREE.Vector3(0, 1, 0);
        const right = new THREE.Vector3().crossVectors(tangent, up).normalize();
        
        // Single row of arrows on the right side, offset to be safely parallel (28 units out, -8 units down)
        const offsetPos = pos.clone().add(right.multiplyScalar(28)).add(new THREE.Vector3(0, -8, 0));
        guideArrows.push({
          id: `arrow-${yearIndex}-${i}`,
          position: offsetPos,
          lookAtPos: offsetPos.clone().add(tangent)
        });
      }
    }
    island.guideArrows = guideArrows;
  });

  return { masterSpline, allIslandsData };
};

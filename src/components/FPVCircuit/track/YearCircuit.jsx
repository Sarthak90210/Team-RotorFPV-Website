import React from 'react';
import { YearMonument, TrackComplete } from './AchievementPedestal';
import { AchievementGate } from '../gates/AchievementGate';
import { RaceGate } from '../pillars/RaceGate';
import { GuideArrow } from './GuideArrow';
import { Image } from '@react-three/drei';

export const YearCircuit = ({ yearData, startPos }) => {
  const { year, checkpoints, floatingImages, finalPosition } = yearData;

  return (
    <group>
      <YearMonument year={year} position={startPos} />
      
      {checkpoints.map((data, i) => {
        if (data.type === 'gate') {
          return <RaceGate key={data.id || i} position={data.worldPosition} />;
        } else {
          return (
            <AchievementGate key={data.id || i} gateData={data} index={data.globalIndex || i} />
          );
        }
      })}

      {/* Render the ambient scattered images */}
      {floatingImages && floatingImages.map((imgData) => (
        <group key={imgData.id} position={imgData.position} rotation={imgData.rotation}>
          <Image 
            url={imgData.src} 
            scale={[imgData.scale, imgData.scale * 0.6]} 
            transparent
            opacity={0.65}
          />
        </group>
      ))}

      {/* Render directional guide arrows */}
      {yearData.guideArrows && yearData.guideArrows.map((arrowData) => (
        <GuideArrow key={arrowData.id} data={arrowData} />
      ))}

      {/* End Marker: only present on the final (oldest) year's last segment */}
      {finalPosition && (
        <TrackComplete position={finalPosition} />
      )}
    </group>
  );
};

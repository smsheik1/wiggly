import React from 'react';
import { Composition } from 'remotion';
import { MugsyExplainsVideo } from './mugsy-explains.jsx';

export const RemotionRoot = () => {
  return (
    <Composition
      id="mugsy-explains"
      component={MugsyExplainsVideo}
      durationInFrames={1200}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{
        title: 'Mugsy Explains',
        lessons: [],
        sentences: []
      }}
      calculateMetadata={({ props }) => {
        const sentences = props.sentences || [];
        if (!sentences.length) {
          return { durationInFrames: 1200 };
        }
        const last = sentences[sentences.length - 1];
        const durationSec = last ? last.endSeconds : 40;
        const frames = Math.max(300, Math.ceil((durationSec + 1.0) * 30));
        return {
          durationInFrames: frames
        };
      }}
    />
  );
};

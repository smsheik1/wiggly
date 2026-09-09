import React from "react";
import { Composition } from "remotion";
import { TutorialVideo } from "./tutorial-video.jsx";

const placeholder = {
  title: "Tutorial Video",
  audience: "New users",
  format: {
    name: "Wiggly Format",
    slug: "example",
    promise: "Turn supplied ingredients into a finished result.",
    url: "https://wiggly.agentenamel.com/discover",
    outputLabel: "final.mp4",
  },
  steps: [],
  durationInFrames: 30,
  fps: 30,
  width: 1920,
  height: 1080,
  music: null,
};

export function TutorialRoot() {
  return (
    <Composition
      id="TutorialVideo"
      component={TutorialVideo}
      width={1920}
      height={1080}
      fps={30}
      durationInFrames={30}
      defaultProps={placeholder}
      calculateMetadata={({ props }) => ({ durationInFrames: props.durationInFrames, props })}
    />
  );
}

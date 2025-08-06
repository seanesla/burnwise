import React, { useCallback } from "react";
import Particles from "@tsparticles/react";
import { loadFull } from "tsparticles";
import { loadFirePreset } from "@tsparticles/preset-fire";

const TsParticlesFireOfficial = ({ onComplete }) => {
  const particlesInit = useCallback(async (engine) => {
    console.log("Initializing tsParticles with fire preset...");
    await loadFull(engine);
    await loadFirePreset(engine);
  }, []);

  const particlesLoaded = useCallback(async (container) => {
    console.log("Fire particles loaded");
    setTimeout(() => {
      if (onComplete) onComplete();
    }, 6000);
  }, [onComplete]);

  return (
    <Particles
      id="tsparticles-fire"
      init={particlesInit}
      loaded={particlesLoaded}
      options={{
        preset: "fire",
        background: {
          color: "#000000"
        }
      }}
      style={{
        position: "fixed",
        zIndex: 9999,
        top: 0,
        left: 0,
        width: "100%",
        height: "100%"
      }}
    />
  );
};

export default TsParticlesFireOfficial;
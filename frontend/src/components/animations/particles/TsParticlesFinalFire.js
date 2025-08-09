import React, { useCallback } from "react";
import Particles from "@tsparticles/react";
import { loadFull } from "tsparticles";
import { loadColorUpdater } from "@tsparticles/updater-color";
import { loadOpacityUpdater } from "@tsparticles/updater-opacity";

const TsParticlesFinalFire = ({ onComplete }) => {
  const particlesInit = useCallback(async (engine) => {
    console.log("Initializing tsParticles Final Fire...");
    // Load the required plugins
    await loadFull(engine);
    await loadColorUpdater(engine);
    await loadOpacityUpdater(engine);
  }, []);

  const particlesLoaded = useCallback(async (container) => {
    console.log("Final Fire particles loaded:", container);
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
        background: {
          color: {
            value: "#000000"
          }
        },
        fpsLimit: 60,
        particles: {
          number: {
            value: 80,
            density: {
              enable: true,
              area: 800
            }
          },
          color: {
            value: ["#FF6B35", "#FF5722", "#FFB000", "#ff8c42"]
          },
          opacity: {
            value: {
              min: 0.3,
              max: 0.8
            },
            animation: {
              enable: true,
              speed: 1,
              sync: false
            }
          },
          size: {
            value: {
              min: 5,
              max: 15
            },
            animation: {
              enable: true,
              speed: 3,
              sync: false
            }
          },
          shape: {
            type: "circle"
          },
          move: {
            enable: true,
            speed: {
              min: 2,
              max: 5
            },
            direction: "top",
            random: true,
            straight: false,
            outModes: {
              default: "out",
              top: "destroy"
            },
            attract: {
              enable: false
            }
          }
        },
        detectRetina: true
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

export default TsParticlesFinalFire;
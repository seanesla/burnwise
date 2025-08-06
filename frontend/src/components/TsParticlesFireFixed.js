import React, { useCallback } from "react";
import Particles from "@tsparticles/react";
import { loadFull } from "tsparticles";

const TsParticlesFireFixed = ({ onComplete }) => {
  const particlesInit = useCallback(async (engine) => {
    console.log("Initializing tsParticles...");
    await loadFull(engine);
  }, []);

  const particlesLoaded = useCallback(async (container) => {
    console.log("Particles loaded");
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
            value: 150,
            density: {
              enable: true,
              area: 800
            }
          },
          color: {
            value: "#ff6b35"
          },
          stroke: {
            width: 0,
            color: "#000000"
          },
          shape: {
            type: "circle"
          },
          opacity: {
            value: 0.8,
            random: false,
            anim: {
              enable: false,
              speed: 1,
              opacity_min: 0.1,
              sync: false
            }
          },
          size: {
            value: 5,
            random: true,
            anim: {
              enable: false,
              speed: 40,
              size_min: 0.1,
              sync: false
            }
          },
          line_linked: {
            enable: false
          },
          move: {
            enable: true,
            speed: 2,
            direction: "top",
            random: false,
            straight: false,
            out_mode: "out",
            bounce: false,
            attract: {
              enable: false,
              rotateX: 600,
              rotateY: 1200
            }
          }
        },
        interactivity: {
          detect_on: "canvas",
          events: {
            onhover: {
              enable: false
            },
            onclick: {
              enable: false
            },
            resize: true
          }
        },
        retina_detect: true
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

export default TsParticlesFireFixed;
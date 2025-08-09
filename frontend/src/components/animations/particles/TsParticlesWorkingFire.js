import React, { useCallback } from "react";
import Particles from "@tsparticles/react";
import { loadFull } from "tsparticles";

const TsParticlesWorkingFire = ({ onComplete }) => {
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
            value: 0
          },
          color: {
            value: ["#FF6B35", "#FF5722", "#FFB000"]
          },
          shape: {
            type: "circle"
          },
          opacity: {
            value: { min: 0.1, max: 1 },
            animation: {
              enable: true,
              speed: 1,
              sync: false
            }
          },
          size: {
            value: { min: 1, max: 10 },
            animation: {
              enable: true,
              speed: 5,
              sync: false
            }
          },
          move: {
            enable: true,
            speed: { min: 1, max: 3 },
            direction: "top",
            random: true,
            straight: false,
            outModes: {
              default: "destroy"
            }
          },
          life: {
            duration: {
              value: 3
            }
          }
        },
        emitters: [
          {
            position: {
              x: 30,
              y: 100
            },
            rate: {
              delay: 0.1,
              quantity: 2
            },
            size: {
              width: 20,
              height: 0
            }
          },
          {
            position: {
              x: 50,
              y: 100
            },
            rate: {
              delay: 0.1,
              quantity: 3
            },
            size: {
              width: 20,
              height: 0
            }
          },
          {
            position: {
              x: 70,
              y: 100
            },
            rate: {
              delay: 0.1,
              quantity: 2
            },
            size: {
              width: 20,
              height: 0
            }
          }
        ],
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

export default TsParticlesWorkingFire;
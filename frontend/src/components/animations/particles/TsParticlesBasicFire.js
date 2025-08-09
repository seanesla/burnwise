import React, { useCallback } from "react";
import Particles from "@tsparticles/react";
import { loadFull } from "tsparticles";

const TsParticlesBasicFire = ({ onComplete }) => {
  const particlesInit = useCallback(async (engine) => {
    console.log("Initializing tsParticles Basic Fire...");
    await loadFull(engine);
  }, []);

  const particlesLoaded = useCallback(async (container) => {
    console.log("Basic Fire particles loaded:", container);
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
        fpsLimit: 120,
        interactivity: {
          events: {
            onClick: {
              enable: false
            },
            onHover: {
              enable: false
            },
            resize: true
          }
        },
        particles: {
          number: {
            value: 80,
            density: {
              enable: true,
              value_area: 800
            }
          },
          color: {
            value: ["#ff6b35", "#ff8c42", "#ffb000", "#ff5722"]
          },
          shape: {
            type: "circle"
          },
          opacity: {
            value: 0.7,
            random: true,
            animation: {
              enable: true,
              speed: 1,
              opacity_min: 0.1,
              sync: false
            }
          },
          size: {
            value: 8,
            random: {
              enable: true,
              minimumValue: 3
            },
            animation: {
              enable: true,
              speed: 5,
              size_min: 0.5,
              sync: false
            }
          },
          links: {
            enable: false
          },
          move: {
            enable: true,
            speed: 2,
            direction: "top",
            random: true,
            straight: false,
            outModes: {
              default: "bounce",
              top: "destroy",
              bottom: "bounce"
            },
            attract: {
              enable: false,
              rotateX: 600,
              rotateY: 1200
            }
          },
          life: {
            duration: {
              sync: false,
              value: 3
            },
            count: 1,
            delay: {
              random: {
                enable: true,
                minimumValue: 0.1
              },
              value: 0
            }
          }
        },
        emitters: {
          position: {
            x: 50,
            y: 100
          },
          size: {
            width: 100,
            height: 0
          },
          rate: {
            delay: 0.1,
            quantity: 2
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

export default TsParticlesBasicFire;
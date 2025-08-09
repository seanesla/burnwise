import React, { useCallback } from "react";
import Particles from "@tsparticles/react";
import { loadFull } from "tsparticles";

const TsParticlesV3Fire = ({ onComplete }) => {
  const particlesInit = useCallback(async (engine) => {
    console.log("Initializing tsParticles v3...");
    await loadFull(engine);
  }, []);

  const particlesLoaded = useCallback(async (container) => {
    console.log("Particles loaded:", container);
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
            value: 0  // Start with 0, emitters will create them
          },
          color: {
            value: {
              r: 255,
              g: 107,
              b: 53
            }
          },
          shape: {
            type: "circle"
          },
          opacity: {
            value: {
              min: 0.3,
              max: 0.8
            },
            animation: {
              enable: true,
              speed: 1,
              sync: false,
              startValue: "random"
            }
          },
          size: {
            value: {
              min: 5,
              max: 20
            },
            animation: {
              enable: true,
              speed: 3,
              sync: false
            }
          },
          move: {
            enable: true,
            speed: {
              min: 1,
              max: 4
            },
            direction: "top",
            random: true,
            straight: false,
            outModes: {
              default: "destroy",
              top: "destroy"
            },
            gravity: {
              enable: true,
              acceleration: -0.5  // Negative for upward motion
            }
          },
          life: {
            duration: {
              value: 3,
              sync: false
            },
            count: 1
          },
          wobble: {
            enable: true,
            distance: 5,
            speed: {
              min: -5,
              max: 5
            }
          }
        },
        emitters: [
          {
            position: {
              x: 35,
              y: 85
            },
            rate: {
              delay: 0.1,
              quantity: 3
            },
            particles: {
              color: {
                value: {
                  r: 255,
                  g: 107,
                  b: 53
                }
              }
            }
          },
          {
            position: {
              x: 50,
              y: 90
            },
            rate: {
              delay: 0.1,
              quantity: 4
            },
            particles: {
              color: {
                value: {
                  r: 255,
                  g: 176,
                  b: 0
                }
              }
            }
          },
          {
            position: {
              x: 65,
              y: 85
            },
            rate: {
              delay: 0.1,
              quantity: 3
            },
            particles: {
              color: {
                value: {
                  r: 255,
                  g: 87,
                  b: 34
                }
              }
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

export default TsParticlesV3Fire;
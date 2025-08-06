import React, { useCallback, useMemo } from "react";
import Particles from "@tsparticles/react";
import { loadFull } from "tsparticles";

const TsParticlesFireLogo = ({ onComplete }) => {
  // Initialize tsParticles with all features
  const particlesInit = useCallback(async (engine) => {
    await loadFull(engine);
  }, []);

  // Called when particles are loaded
  const particlesLoaded = useCallback(async (container) => {
    console.log("Particles loaded:", container);
    
    // Start the animation
    if (container) {
      await container.start();
      console.log("Container started, particles:", container.particles.count);
    }
    
    // Complete after animation duration
    setTimeout(() => {
      if (onComplete) {
        onComplete();
      }
    }, 6000);
  }, [onComplete]);

  // Fire preset configuration with BURNWISE logo colors
  const options = useMemo(() => ({
    fullScreen: {
      enable: true,
      zIndex: 9999
    },
    background: {
      color: {
        value: "#000000"
      }
    },
    fpsLimit: 60,
    autoPlay: true,
    particles: {
      number: {
        value: 200,
        density: {
          enable: true,
          area: 800
        }
      },
      color: {
        value: ["#FF6B35", "#FF5722", "#FFB000", "#FF8C42", "#FF4500"],
        animation: {
          enable: true,
          speed: 20,
          sync: false
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
          speed: 2,
          minimumValue: 0.1,
          sync: false,
          destroy: "max"
        }
      },
      size: {
        value: {
          min: 1,
          max: 8
        },
        animation: {
          enable: true,
          speed: 15,
          minimumValue: 1,
          sync: false,
          destroy: "max"
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
          default: "out",
          top: "destroy"
        },
        attract: {
          enable: false
        },
        gravity: {
          enable: true,
          acceleration: -0.5
        },
        trail: {
          enable: true,
          length: 5,
          fillColor: {
            value: "#FF6B35"
          }
        }
      },
      wobble: {
        enable: true,
        distance: 10,
        speed: 10
      },
      life: {
        duration: {
          sync: false,
          value: 3
        },
        count: 0,
        delay: {
          random: {
            enable: true,
            minimumValue: 0.1
          },
          value: 0
        }
      },
      roll: {
        darken: {
          enable: true,
          value: 10
        },
        enlighten: {
          enable: true,
          value: 10
        },
        enable: true,
        speed: {
          min: 5,
          max: 15
        }
      },
      tilt: {
        enable: true,
        direction: "random",
        value: {
          min: 0,
          max: 360
        },
        animation: {
          enable: true,
          speed: 30
        }
      },
      twinkle: {
        particles: {
          enable: true,
          frequency: 0.05,
          opacity: 1,
          color: {
            value: "#FFD700"
          }
        }
      }
    },
    emitters: [
      // Left flame emitter
      {
        position: {
          x: 35,
          y: 70
        },
        rate: {
          delay: 0.1,
          quantity: 3
        },
        size: {
          width: 20,
          height: 30,
          mode: "percent"
        },
        particles: {
          size: {
            value: {
              min: 2,
              max: 6
            }
          },
          move: {
            direction: "top-right",
            speed: {
              min: 2,
              max: 5
            }
          },
          color: {
            value: "#FF6B35"
          }
        }
      },
      // Center flame emitter (larger)
      {
        position: {
          x: 50,
          y: 70
        },
        rate: {
          delay: 0.1,
          quantity: 5
        },
        size: {
          width: 25,
          height: 40,
          mode: "percent"
        },
        particles: {
          size: {
            value: {
              min: 3,
              max: 10
            }
          },
          move: {
            direction: "top",
            speed: {
              min: 3,
              max: 7
            }
          },
          color: {
            value: "#FF5722"
          }
        }
      },
      // Right flame emitter
      {
        position: {
          x: 65,
          y: 70
        },
        rate: {
          delay: 0.1,
          quantity: 3
        },
        size: {
          width: 20,
          height: 30,
          mode: "percent"
        },
        particles: {
          size: {
            value: {
              min: 2,
              max: 6
            }
          },
          move: {
            direction: "top-left",
            speed: {
              min: 2,
              max: 5
            }
          },
          color: {
            value: "#FFB000"
          }
        }
      }
    ],
    interactivity: {
      detectsOn: "window",
      events: {
        onClick: {
          enable: true,
          mode: "push"
        },
        onHover: {
          enable: true,
          mode: "bubble",
          parallax: {
            enable: true,
            force: 2,
            smooth: 10
          }
        },
        resize: true
      },
      modes: {
        push: {
          quantity: 10,
          particles: {
            color: {
              value: "#FFD700"
            },
            size: {
              value: {
                min: 5,
                max: 15
              }
            },
            move: {
              speed: {
                min: 5,
                max: 10
              }
            }
          }
        },
        bubble: {
          distance: 100,
          duration: 2,
          size: 15,
          opacity: 0.8,
          color: {
            value: "#FF8C42"
          }
        }
      }
    },
    detectRetina: true,
    pauseOnBlur: true,
    pauseOnOutsideViewport: true,
    smooth: true
  }), []);

  return (
    <Particles
      id="tsparticles-fire"
      init={particlesInit}
      loaded={particlesLoaded}
      options={options}
      className="tsparticles-fire-container"
    />
  );
};

export default TsParticlesFireLogo;
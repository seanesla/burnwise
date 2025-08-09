import React, { useCallback } from "react";
import Particles from "@tsparticles/react";
import { loadFull } from "tsparticles";

const TsParticlesFireSimple = ({ onComplete }) => {
  // Initialize tsParticles
  const particlesInit = useCallback(async (engine) => {
    console.log("Initializing tsParticles engine...");
    await loadFull(engine);
    console.log("tsParticles engine initialized");
  }, []);

  // Called when particles are loaded
  const particlesLoaded = useCallback(async (container) => {
    console.log("Particles container loaded:", container);
    
    // Auto-complete after 6 seconds
    setTimeout(() => {
      if (onComplete) {
        onComplete();
      }
    }, 6000);
  }, [onComplete]);

  // Simple fire configuration
  const options = {
    background: {
      color: {
        value: "transparent"
      }
    },
    fpsLimit: 60,
    particles: {
      number: {
        value: 80,
        density: {
          enable: true,
          value_area: 800
        }
      },
      color: {
        value: "#FF6B35"
      },
      shape: {
        type: "circle"
      },
      opacity: {
        value: 1,
        random: false,
        animation: {
          enable: true,
          speed: 1,
          minimumValue: 0.1,
          sync: false
        }
      },
      size: {
        value: 10,
        random: true,
        animation: {
          enable: true,
          speed: 2,
          minimumValue: 3,
          sync: false
        }
      },
      move: {
        enable: true,
        speed: 3,
        direction: "top",
        random: true,
        straight: false,
        outModes: {
          default: "out",
          bottom: "out",
          left: "out",
          right: "out",
          top: "destroy"
        }
      }
    },
    interactivity: {
      detectsOn: "canvas",
      events: {
        onClick: {
          enable: true,
          mode: "push"
        },
        resize: true
      },
      modes: {
        push: {
          particles_nb: 4
        }
      }
    },
    emitters: {
      position: {
        x: 50,
        y: 100
      },
      rate: {
        delay: 0.1,
        quantity: 2
      }
    },
    detectRetina: true
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 9999 }}>
      <Particles
        id="tsparticles-simple"
        init={particlesInit}
        loaded={particlesLoaded}
        options={options}
      />
    </div>
  );
};

export default TsParticlesFireSimple;
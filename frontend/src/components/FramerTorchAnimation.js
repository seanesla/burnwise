import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AnimatedFlameLogo from "./animations/logos/AnimatedFlameLogo";

const FramerTorchAnimation = ({ onComplete }) => {
  const [phase, setPhase] = useState("center"); // 'center', 'morphing', 'complete'
  const [positions, setPositions] = useState({
    start: {
      x: window.innerWidth / 2 - 90, // Center minus half of 180px width
      y: window.innerHeight / 2 - 90, // Center minus half of 180px height
    },
    end: { x: 0, y: 0 },
  });
  const containerRef = useRef(null);

  useEffect(() => {
    // Measure the exact position of "I" in BURNWISE
    const measureTarget = () => {
      // Create a hidden element matching Landing.js structure
      const testEl = document.createElement("div");
      testEl.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: clamp(3rem, 8vw, 6rem);
        font-weight: 900;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        letter-spacing: -0.02em;
        visibility: hidden;
        pointer-events: none;
        white-space: nowrap;
      `;

      // Match Landing.js structure: BURNW[I]SE
      testEl.innerHTML = `
        <span style="position: relative; display: inline-block;">
          BURNW<span style="position: relative; display: inline-block;">I</span>SE
        </span>
      `;
      document.body.appendChild(testEl);

      // Get the I span
      const iSpan = testEl.querySelector("span span");
      const iRect = iSpan.getBoundingClientRect();

      // Calculate offset from viewport center
      const viewportCenterX = window.innerWidth / 2;
      const viewportCenterY = window.innerHeight / 2;

      // The flame center should align with I center
      const iCenterX = iRect.left + iRect.width / 2;
      const iTop = iRect.top;

      document.body.removeChild(testEl);

      // Return absolute positions
      // When scaled to 0.36, the 180px element becomes 64.8px (≈ 65px)
      // The Landing.js flame is 65px size positioned 65px above the "I"
      const scaledSize = 65;
      const halfScaledSize = scaledSize / 2;

      return {
        start: {
          x: viewportCenterX - 90, // Center minus half of 180px width
          y: viewportCenterY - 90, // Center minus half of 180px height
        },
        end: {
          // Position for 180px element that when scaled to 0.36 will match Landing flame
          // Scaled size: 180 * 0.36 = 64.8px ≈ 65px
          // Landing flame is positioned -55px from top of I (top edge of flame)
          // Scaled flame top at: iTop - 55, so center at: iTop - 55 + 32.5 = iTop - 22.5
          // Unscaled element needs same center position
          // Unscaled top = center - 90 = iTop - 22.5 - 90
          x: iCenterX - 90 - 6, // Center the unscaled element on I with offset
          y: iTop - 140, // Fine-tuned position to match Landing flame
        },
      };
    };

    // Wait for fonts to load
    document.fonts.ready.then(() => {
      const positions = measureTarget();
      setPositions(positions);

      // Start animation sequence
      setTimeout(() => {
        setPhase("morphing");
      }, 2500); // Hold at center for 2.5s

      setTimeout(() => {
        setPhase("complete");
        if (onComplete) onComplete();
      }, 4095); // Complete just before Landing flame appears
    });
  }, [onComplete]);

  const variants = {
    center: {
      left: positions.start.x,
      top: positions.start.y,
      scale: 1,
      opacity: 1,
    },
    morph: {
      left: positions.end.x,
      top: positions.end.y,
      scale: 0.36,
      opacity: 1,
    },
    fade: {
      left: positions.end.x,
      top: positions.end.y,
      scale: 0.36,
      opacity: 0,
    },
  };

  return (
    <>
      <AnimatePresence>
        {phase !== "complete" && (
          <motion.div
            key="flame-animation"
            ref={containerRef}
            style={{
              position: "fixed",
              zIndex: 999999,
              width: 180,
              height: 180,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
            }}
            initial="center"
            animate={phase === "morphing" ? "morph" : "center"}
            exit="fade"
            variants={variants}
            transition={{
              duration: phase === "morphing" ? 1.6 : 0.5,
              ease: phase === "morphing" ? [0.4, 0, 0.1, 1] : "easeOut", // Smoother easing for morph
              exit: { duration: 0 }, // Instant disappear
            }}
          >
            <AnimatedFlameLogo size={180} animated={true} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Black background that fades */}
      <AnimatePresence>
        <motion.div
          key="black-background"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "#000",
            zIndex: 999998,
            pointerEvents: "none",
          }}
          initial={{ opacity: 1 }}
          animate={{
            opacity: phase === "morphing" || phase === "complete" ? 0 : 1,
          }}
          exit={{ opacity: 0 }}
          transition={{
            duration: 1.8,
            ease: "easeOut",
          }}
        />
      </AnimatePresence>
    </>
  );
};

export default FramerTorchAnimation;

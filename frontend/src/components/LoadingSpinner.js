import React from 'react';
import { motion } from 'framer-motion';

const LoadingSpinner = ({ size = 'medium', color = '#ff6b35' }) => {
  const sizes = {
    small: 24,
    medium: 48,
    large: 64
  };

  const spinnerSize = sizes[size] || sizes.medium;

  return (
    <div className="flex items-center justify-center">
      <motion.div
        className="relative"
        style={{ width: spinnerSize, height: spinnerSize }}
      >
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            border: `2px solid ${color}20`,
            borderTopColor: color,
            borderRightColor: color
          }}
          animate={{ rotate: 360 }}
          transition={{
            duration: 1,
            repeat: Infinity,
            ease: "linear"
          }}
        />
        <motion.div
          className="absolute inset-2 rounded-full"
          style={{
            border: `2px solid ${color}40`,
            borderBottomColor: color,
            borderLeftColor: color
          }}
          animate={{ rotate: -360 }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "linear"
          }}
        />
      </motion.div>
    </div>
  );
};

export default LoadingSpinner;
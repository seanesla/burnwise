import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PhoneInput, { isValidPhoneNumber, formatPhoneNumber } from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import CryptoJS from 'crypto-js';
import { 
  FaPhone, 
  FaShieldAlt, 
  FaClock, 
  FaCheck, 
  FaTimes, 
  FaSpinner, 
  FaSms,
  FaBell,
  FaLock
} from 'react-icons/fa';
import toast from 'react-hot-toast';
import { springPresets } from '../styles/animations';
import AnimatedFlameLogo from './AnimatedFlameLogo';
import './DemoPhoneModal.css';

const DemoPhoneModal = ({ isOpen, onComplete, onSkip, demoSession }) => {
  const [step, setStep] = useState('intro');
  const [phone, setPhone] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [encryptionKey, setEncryptionKey] = useState('');

  // Generate encryption key on mount
  useEffect(() => {
    if (isOpen && !encryptionKey) {
      // Generate a unique encryption key for this session
      const key = CryptoJS.lib.WordArray.random(256/8).toString();
      setEncryptionKey(key);
      sessionStorage.setItem('demo_encryption_key', key);
    }
  }, [isOpen, encryptionKey]);

  const benefits = [
    {
      icon: <FaSms />,
      title: 'Real-time Burn Alerts',
      description: 'Get SMS notifications when burn conditions change'
    },
    {
      icon: <FaBell />,
      title: 'Weather Updates',
      description: 'Receive critical weather warnings that affect your burns'
    },
    {
      icon: <FaShieldAlt />,
      title: 'Conflict Notifications',
      description: 'Be alerted when nearby farms schedule conflicting burns'
    }
  ];

  const securityFeatures = [
    {
      icon: <FaLock />,
      title: 'Client-Side Encryption',
      description: 'Your phone number is encrypted before leaving your device'
    },
    {
      icon: <FaClock />,
      title: 'Auto-Deletion',
      description: 'All data automatically deleted after 24 hours'
    },
    {
      icon: <FaShieldAlt />,
      title: 'Demo Only',
      description: 'Used solely for demonstration purposes'
    }
  ];

  const encryptPhone = (phoneNumber) => {
    if (!encryptionKey || !phoneNumber) return '';
    return CryptoJS.AES.encrypt(phoneNumber, encryptionKey).toString();
  };

  const handlePhoneSubmit = async () => {
    if (!phone) {
      toast.error('Please enter a phone number');
      return;
    }

    if (!isValidPhoneNumber(phone)) {
      toast.error('Please enter a valid phone number');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const encryptedPhone = encryptPhone(phone);
      
      const response = await fetch('/api/demo/add-phone', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Demo-Mode': 'true'
        },
        credentials: 'include',
        body: JSON.stringify({
          sessionId: demoSession.sessionId,
          phone: encryptedPhone
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to add phone number');
      }

      const data = await response.json();
      
      toast.success('Phone number added successfully!');
      setStep('verification');

      // For demo purposes, show the verification code in console
      console.log('Demo verification code: 123456');
      
    } catch (error) {
      console.error('Phone submission error:', error);
      toast.error(error.message || 'Failed to add phone number');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerification = async () => {
    if (verificationCode !== '123456') {
      toast.error('Invalid verification code. For demo, use: 123456');
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Simulate verification process
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast.success('Phone number verified successfully!');
      setStep('success');
      
      // Complete after showing success
      setTimeout(() => {
        onComplete({
          phoneAdded: true,
          phoneNumber: formatPhoneNumber(phone),
          encrypted: true
        });
      }, 2000);
      
    } catch (error) {
      toast.error('Verification failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkipStep = () => {
    if (onSkip) {
      onSkip();
    } else {
      onComplete({ phoneAdded: false });
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div 
        className="demo-phone-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="demo-phone-modal"
          initial={{ opacity: 0, scale: 0.9, y: 50 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 50 }}
          transition={springPresets.smooth}
        >
          {/* Header */}
          <div className="demo-phone-header">
            <AnimatedFlameLogo size={24} />
            <h2 className="demo-phone-title">
              {step === 'intro' && 'Enhance Your Demo Experience'}
              {step === 'phone' && 'Add Phone Number'}
              {step === 'verification' && 'Verify Phone Number'}
              {step === 'success' && 'All Set!'}
            </h2>
            <button className="demo-phone-close" onClick={handleSkipStep}>
              <FaTimes />
            </button>
          </div>

          {/* Content */}
          <div className="demo-phone-content">
            {step === 'intro' && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="intro-step"
              >
                <p className="demo-phone-subtitle">
                  Add your phone number to experience SMS alerts and notifications
                </p>

                <div className="benefits-grid">
                  {benefits.map((benefit, index) => (
                    <motion.div
                      key={index}
                      className="benefit-card"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <div className="benefit-icon">{benefit.icon}</div>
                      <h3>{benefit.title}</h3>
                      <p>{benefit.description}</p>
                    </motion.div>
                  ))}
                </div>

                <div className="security-section">
                  <h3 className="security-title">
                    <FaShieldAlt />
                    Security & Privacy
                  </h3>
                  <div className="security-features">
                    {securityFeatures.map((feature, index) => (
                      <div key={index} className="security-feature">
                        <div className="security-icon">{feature.icon}</div>
                        <div>
                          <strong>{feature.title}</strong>
                          <p>{feature.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="intro-actions">
                  <motion.button
                    className="btn-primary"
                    onClick={() => setStep('phone')}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <FaPhone />
                    Add Phone Number
                  </motion.button>
                  <button className="btn-secondary" onClick={handleSkipStep}>
                    Skip for Now
                  </button>
                </div>
              </motion.div>
            )}

            {step === 'phone' && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="phone-step"
              >
                <p className="step-description">
                  Enter your phone number to receive demo SMS notifications
                </p>

                <div className="phone-input-section">
                  <label className="phone-label">
                    Phone Number
                  </label>
                  <PhoneInput
                    international
                    defaultCountry="US"
                    value={phone}
                    onChange={setPhone}
                    className="demo-phone-input"
                    countryCallingCodeEditable={false}
                    placeholder="(555) 123-4567"
                  />
                  {phone && !isValidPhoneNumber(phone) && (
                    <p className="phone-error">Please enter a valid phone number</p>
                  )}
                </div>

                <div className="encryption-notice">
                  <FaLock />
                  <span>Your phone number will be encrypted before transmission</span>
                </div>

                <div className="phone-actions">
                  <motion.button
                    className="btn-primary"
                    onClick={handlePhoneSubmit}
                    disabled={!phone || !isValidPhoneNumber(phone) || isSubmitting}
                    whileHover={!isSubmitting ? { scale: 1.02 } : {}}
                    whileTap={!isSubmitting ? { scale: 0.98 } : {}}
                  >
                    {isSubmitting ? (
                      <>
                        <FaSpinner className="spinning" />
                        Adding Phone...
                      </>
                    ) : (
                      <>
                        <FaCheck />
                        Add Phone Number
                      </>
                    )}
                  </motion.button>
                  <button className="btn-secondary" onClick={handleSkipStep}>
                    Skip
                  </button>
                </div>
              </motion.div>
            )}

            {step === 'verification' && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="verification-step"
              >
                <div className="verification-icon">
                  <FaSms />
                </div>
                <h3>Enter Verification Code</h3>
                <p>
                  We sent a verification code to <strong>{formatPhoneNumber(phone)}</strong>
                </p>
                
                <div className="demo-note">
                  <strong>For Demo:</strong> Use code <code>123456</code>
                </div>

                <input
                  type="text"
                  className="verification-input"
                  placeholder="123456"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  maxLength={6}
                />

                <div className="verification-actions">
                  <motion.button
                    className="btn-primary"
                    onClick={handleVerification}
                    disabled={verificationCode.length !== 6 || isSubmitting}
                    whileHover={!isSubmitting ? { scale: 1.02 } : {}}
                    whileTap={!isSubmitting ? { scale: 0.98 } : {}}
                  >
                    {isSubmitting ? (
                      <>
                        <FaSpinner className="spinning" />
                        Verifying...
                      </>
                    ) : (
                      <>
                        <FaCheck />
                        Verify Code
                      </>
                    )}
                  </motion.button>
                </div>
              </motion.div>
            )}

            {step === 'success' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="success-step"
              >
                <div className="success-icon">
                  <FaCheck />
                </div>
                <h3>Phone Number Added!</h3>
                <p>
                  You'll now receive SMS notifications for your demo session.
                  All data will be automatically deleted in 24 hours.
                </p>
                
                <div className="success-features">
                  <div className="success-feature">
                    <FaBell />
                    <span>SMS alerts enabled</span>
                  </div>
                  <div className="success-feature">
                    <FaShieldAlt />
                    <span>Securely encrypted</span>
                  </div>
                  <div className="success-feature">
                    <FaClock />
                    <span>Auto-expires in 24h</span>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default DemoPhoneModal;
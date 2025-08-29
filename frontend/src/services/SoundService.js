/**
 * SoundService.js - Web Audio API Sound Generation
 * Generates notification sounds programmatically
 * No audio files required - uses oscillators
 */

class SoundService {
  constructor() {
    this.audioContext = null;
    this.initialized = false;
    this.muted = this.getMutedState();
  }

  /**
   * Initialize AudioContext
   * Must be called after user interaction due to autoplay policy
   */
  async initialize() {
    if (this.initialized) return;

    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // Resume if suspended (autoplay policy)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      
      this.initialized = true;
      console.log('SoundService initialized');
    } catch (error) {
      console.error('Failed to initialize AudioContext:', error);
    }
  }

  /**
   * Play a beep sound
   * @param {number} frequency - Frequency in Hz
   * @param {number} duration - Duration in ms
   * @param {number} volume - Volume 0-1
   */
  async playBeep(frequency = 440, duration = 200, volume = 0.3) {
    if (!this.initialized) {
      await this.initialize();
    }

    if (this.muted || !this.audioContext) return;

    try {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      // Configure oscillator
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
      
      // Configure gain (volume)
      gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
      
      // Connect nodes
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      // Start and stop
      oscillator.start();
      oscillator.stop(this.audioContext.currentTime + (duration / 1000));
      
    } catch (error) {
      console.error('Error playing beep:', error);
    }
  }

  /**
   * Play alert sound (three beeps)
   */
  async playAlertSound() {
    if (this.muted) return;
    
    // Three ascending beeps
    await this.playBeep(440, 150, 0.3);  // A4
    setTimeout(() => this.playBeep(554, 150, 0.3), 200);  // C#5
    setTimeout(() => this.playBeep(659, 200, 0.3), 400);  // E5
  }

  /**
   * Play success sound (two quick high beeps)
   */
  async playSuccessSound() {
    if (this.muted) return;
    
    await this.playBeep(659, 100, 0.25);  // E5
    setTimeout(() => this.playBeep(880, 150, 0.25), 120);  // A5
  }

  /**
   * Play warning sound (low beep)
   */
  async playWarningSound() {
    if (this.muted) return;
    
    await this.playBeep(220, 300, 0.35);  // A3
  }

  /**
   * Toggle mute state
   */
  toggleMute() {
    this.muted = !this.muted;
    localStorage.setItem('burnwise-sound-muted', this.muted.toString());
    return this.muted;
  }

  /**
   * Get muted state from localStorage
   */
  getMutedState() {
    const stored = localStorage.getItem('burnwise-sound-muted');
    return stored === 'true';
  }

  /**
   * Set mute state
   */
  setMuted(muted) {
    this.muted = muted;
    localStorage.setItem('burnwise-sound-muted', muted.toString());
  }

  /**
   * Check if sound is enabled
   */
  isEnabled() {
    return this.initialized && !this.muted;
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      muted: this.muted,
      enabled: this.isEnabled()
    };
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
      this.initialized = false;
    }
  }
}

// Export singleton instance
export default new SoundService();
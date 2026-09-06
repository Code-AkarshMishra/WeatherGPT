/**
 * weatherAudio.js
 * High-fidelity procedural Web Audio engine for realistic ambient weather soundscapes.
 * Synthesizes rain droplets, thunder rumbles, wind breeze, and warm sunlight tones.
 * Zero external asset dependencies — 100% offline, immediate, and synchronized.
 */

class WeatherAudioManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.rainGain = null;
    this.windGain = null;
    this.sunnyGain = null;
    this.noiseNode = null;
    this.activeCondition = null;
    this.isMuted = localStorage.getItem('weathergpt_audio_muted') !== 'false'; // muted by default until user toggles
    this.listeners = new Set();
  }

  init() {
    if (this.ctx) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.45, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);
  }

  // Create pink/brownish filtered noise buffer for natural rain sounds
  createNoiseBuffer() {
    if (!this.ctx) return null;
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
    return buffer;
  }

  startRain(intensity = 0.5) {
    if (!this.ctx || this.rainSource) return;

    const noiseBuffer = this.createNoiseBuffer();
    if (!noiseBuffer) return;

    this.rainSource = this.ctx.createBufferSource();
    this.rainSource.buffer = noiseBuffer;
    this.rainSource.loop = true;

    // Filter to make it sound like falling rain and droplets
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800 + intensity * 1200, this.ctx.currentTime);

    // Highpass to eliminate harsh low rumblings from the noise
    const hpFilter = this.ctx.createBiquadFilter();
    hpFilter.type = 'highpass';
    hpFilter.frequency.setValueAtTime(250, this.ctx.currentTime);

    this.rainGain = this.ctx.createGain();
    const targetVol = Math.min(0.6, 0.15 + intensity * 0.4);
    this.rainGain.gain.setValueAtTime(0.01, this.ctx.currentTime);
    this.rainGain.gain.exponentialRampToValueAtTime(targetVol, this.ctx.currentTime + 1.2);

    this.rainSource.connect(filter);
    filter.connect(hpFilter);
    hpFilter.connect(this.rainGain);
    this.rainGain.connect(this.masterGain);

    this.rainSource.start(0);

    // Add random soft droplet clicks
    this.dropletInterval = setInterval(() => {
      if (!this.ctx || this.isMuted) return;
      this.playSingleDroplet();
    }, 280 / Math.max(0.3, intensity));
  }

  playSingleDroplet() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      const baseFreq = 1200 + Math.random() * 800;
      osc.frequency.setValueAtTime(baseFreq, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.4, this.ctx.currentTime + 0.04);

      gain.gain.setValueAtTime(0.03 + Math.random() * 0.04, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.045);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(this.ctx.currentTime);
      osc.stop(this.ctx.currentTime + 0.05);
    } catch {
      // Audio element safety
    }
  }

  triggerThunder() {
    if (!this.ctx || this.isMuted) return;
    try {
      const now = this.ctx.currentTime;

      // Deep rumble sub oscillator
      const subOsc = this.ctx.createOscillator();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(55, now);
      subOsc.frequency.exponentialRampToValueAtTime(28, now + 2.2);

      const subGain = this.ctx.createGain();
      subGain.gain.setValueAtTime(0.35, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 2.5);

      subOsc.connect(subGain);
      subGain.connect(this.masterGain);
      subOsc.start(now);
      subOsc.stop(now + 2.6);

      // Noise burst for the crack / rumble body
      const noiseBuffer = this.createNoiseBuffer();
      if (!noiseBuffer) return;

      const noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;

      const thunderFilter = this.ctx.createBiquadFilter();
      thunderFilter.type = 'lowpass';
      thunderFilter.frequency.setValueAtTime(320, now);
      thunderFilter.frequency.linearRampToValueAtTime(140, now + 1.8);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.01, now);
      noiseGain.gain.linearRampToValueAtTime(0.45, now + 0.08); // sharp crack
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 2.8);

      noiseSource.connect(thunderFilter);
      thunderFilter.connect(noiseGain);
      noiseGain.connect(this.masterGain);

      noiseSource.start(now);
      noiseSource.stop(now + 3.0);
    } catch (e) {
      console.warn('Thunder sound trigger failed:', e);
    }
  }

  startWind() {
    if (!this.ctx || this.windSource) return;
    const noiseBuffer = this.createNoiseBuffer();
    if (!noiseBuffer) return;

    this.windSource = this.ctx.createBufferSource();
    this.windSource.buffer = noiseBuffer;
    this.windSource.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(380, this.ctx.currentTime);
    filter.Q.setValueAtTime(2.5, this.ctx.currentTime);

    this.windGain = this.ctx.createGain();
    this.windGain.gain.setValueAtTime(0.01, this.ctx.currentTime);
    this.windGain.gain.linearRampToValueAtTime(0.2, this.ctx.currentTime + 2);

    this.windSource.connect(filter);
    filter.connect(this.windGain);
    this.windGain.connect(this.masterGain);

    this.windSource.start(0);
  }

  stopAll() {
    if (this.dropletInterval) {
      clearInterval(this.dropletInterval);
      this.dropletInterval = null;
    }

    if (this.rainSource) {
      try {
        this.rainGain?.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.4);
        setTimeout(() => {
          this.rainSource?.stop();
          this.rainSource?.disconnect();
          this.rainSource = null;
        }, 450);
      } catch {
        this.rainSource = null;
      }
    }

    if (this.windSource) {
      try {
        this.windGain?.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.4);
        setTimeout(() => {
          this.windSource?.stop();
          this.windSource?.disconnect();
          this.windSource = null;
        }, 450);
      } catch {
        this.windSource = null;
      }
    }
  }

  setCondition(condition, rainProbability = 40) {
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended' && !this.isMuted) {
      this.ctx.resume();
    }

    this.stopAll();
    this.activeCondition = condition;

    const prob = Math.min(1, Math.max(0.1, (rainProbability || 40) / 100));

    if (condition === 'storm') {
      this.startRain(prob);
      this.startWind();
      // Schedule first thunder after 1.5s
      setTimeout(() => this.triggerThunder(), 1500);
    } else if (condition === 'rain') {
      this.startRain(prob);
    } else if (condition === 'cloudy') {
      this.startWind();
    } else if (condition === 'snow') {
      this.startWind();
    }
  }

  toggleMute() {
    this.init();
    this.isMuted = !this.isMuted;
    localStorage.setItem('weathergpt_audio_muted', String(this.isMuted));

    if (this.ctx && this.masterGain) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
      this.masterGain.gain.linearRampToValueAtTime(this.isMuted ? 0 : 0.45, now + 0.2);
    }

    if (!this.isMuted && this.activeCondition) {
      this.setCondition(this.activeCondition);
    }

    this.listeners.forEach((fn) => fn(this.isMuted));
    return this.isMuted;
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  getMuted() {
    return this.isMuted;
  }
}

export const weatherAudio = new WeatherAudioManager();

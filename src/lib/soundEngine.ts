import { SoundId, SOUNDS } from './sounds';

class SoundEngine {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private soundNodes: Map<SoundId, { source: AudioBufferSourceNode | null; gainNode: GainNode }> = new Map();
  private audioBuffers: Map<SoundId, AudioBuffer> = new Map();
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      this.audioContext = new AudioContext();
      this.masterGain = this.audioContext.createGain();
      this.masterGain.connect(this.audioContext.destination);

      for (const sound of SOUNDS) {
        const gainNode = this.audioContext.createGain();
        gainNode.connect(this.masterGain);
        this.soundNodes.set(sound.id, { source: null, gainNode });
      }
      
      this.initialized = true;
    } catch (e) {
      console.warn("SoundEngine initialization failed:", e);
    }
  }

  private async ensureBuffer(soundId: SoundId): Promise<AudioBuffer | null> {
    if (this.audioBuffers.has(soundId)) {
      return this.audioBuffers.get(soundId)!;
    }

    if (!this.audioContext) return null;

    const sound = SOUNDS.find(s => s.id === soundId);
    if (!sound) return null;

    try {
      console.log('Fetching sound:', sound.sampleFile);
      const response = await fetch(sound.sampleFile);
      console.log('Response:', response.status, response.statusText);
      if (!response.ok) return null;
      
      const arrayBuffer = await response.arrayBuffer();
      console.log('Decoding audio...');
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      console.log('Audio decoded successfully');
      this.audioBuffers.set(soundId, audioBuffer);
      return audioBuffer;
    } catch (error) {
      console.warn(`Failed to load sound ${soundId}:`, error);
      return null;
    }
  }

  private async playSound(soundId: SoundId): Promise<void> {
    if (!this.audioContext || !this.masterGain) return;

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    const node = this.soundNodes.get(soundId);
    if (!node) return;

    const buffer = await this.ensureBuffer(soundId);
    if (!buffer) return;

    if (node.source) {
      node.source.stop();
      node.source.disconnect();
    }

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(node.gainNode);
    source.start();

    node.source = source;
  }

  private stopSound(soundId: SoundId): void {
    console.log('stopSound called for:', soundId);
    const node = this.soundNodes.get(soundId);
    console.log('node:', node);
    if (!node) return;

    if (node.source) {
      console.log('Stopping source for:', soundId);
      node.source.stop();
      node.source.disconnect();
      node.source = null;
      console.log('Stopped and disconnected for:', soundId);
    }
  }

  async setSoundEnabled(soundId: SoundId, enabled: boolean, volume?: number): Promise<void> {
    if (enabled) {
      if (volume !== undefined) {
        this.setSoundVolume(soundId, volume);
      }
      await this.playSound(soundId);
    } else {
      this.stopSound(soundId);
    }
  }

  setSoundVolume(soundId: SoundId, volume: number): void {
    const node = this.soundNodes.get(soundId);
    if (node) {
      node.gainNode.gain.setValueAtTime(volume, this.audioContext?.currentTime || 0);
    }
  }

  setMasterEnabled(enabled: boolean): void {
    if (this.masterGain) {
      this.masterGain.gain.setValueAtTime(enabled ? 1 : 0, this.audioContext?.currentTime || 0);
    }
  }

  setMasterVolume(volume: number): void {
    if (this.masterGain) {
      this.masterGain.gain.setValueAtTime(volume, this.audioContext?.currentTime || 0);
    }
  }

  isPlaying(soundId: SoundId): boolean {
    const node = this.soundNodes.get(soundId);
    return node?.source !== null;
  }

  resume(): void {
    if (this.audioContext?.state === 'suspended') {
      this.audioContext.resume();
    }
  }
}

export const soundEngine = new SoundEngine();

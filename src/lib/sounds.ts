export type SoundId = 'rain' | 'whiteNoise' | 'people';

export interface Sound {
  id: SoundId;
  name: string;
  sampleFile: string;
}

export const SOUNDS: Sound[] = [
  { id: 'rain', name: 'Rain', sampleFile: '/sounds/rain-1.mp3' },
  { id: 'whiteNoise', name: 'White Noise', sampleFile: '/sounds/whitenoise-1.mp3' },
  { id: 'people', name: 'People', sampleFile: '/sounds/people-1.mp3' },
];
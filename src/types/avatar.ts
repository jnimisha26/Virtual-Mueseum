export type AvatarAnimationName =
  | 'standing_idle'
  | 'start_walk'
  | 'walking'
  | 'stop_walk'
  | 'bow'
  | 'thinking';

export const ONE_SHOT_CLIPS: AvatarAnimationName[] = [
  'bow',
  'thinking',
  'start_walk',
  'stop_walk',
];
import * as THREE from 'three';
import { type AvatarAnimationName, ONE_SHOT_CLIPS } from './types/avatar';

export class AvatarController {
  public mixer: THREE.AnimationMixer;
  public actions: Partial<Record<AvatarAnimationName, THREE.AnimationAction>> = {};
  public currentClip: AvatarAnimationName | null = null;
  private onFinishQueue: AvatarAnimationName | null = null;

  constructor(model: THREE.Object3D, animations: THREE.AnimationClip[]) {
    // Fix hair/eyelash alpha sorting and prevent skinned mesh clipping
    model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.frustumCulled = false;
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (mat?.name === 'Ch31_hair') {
          mat.depthWrite = false;
        }
      }
    });

    this.mixer = new THREE.AnimationMixer(model);

    animations.forEach((clip) => {
      const name = clip.name as AvatarAnimationName;
      this.actions[name] = this.mixer.clipAction(clip);
    });

    this.mixer.addEventListener('finished', () => {
      if (this.onFinishQueue) {
        const next = this.onFinishQueue;
        this.onFinishQueue = null;
        this.play(next);
      }
    });

    this.play('standing_idle');
  }

  public play(name: AvatarAnimationName, nextAfterFinish: AvatarAnimationName | null = null, fadeDuration = 0.25) {
    if (this.currentClip === name && !ONE_SHOT_CLIPS.includes(name)) return;

    const nextAction = this.actions[name];
    if (!nextAction) return;

    const prevAction = this.currentClip ? this.actions[this.currentClip] : null;
    if (prevAction && prevAction !== nextAction) {
      prevAction.fadeOut(fadeDuration);
    }

    nextAction.reset().fadeIn(fadeDuration);

    if (ONE_SHOT_CLIPS.includes(name)) {
      nextAction.setLoop(THREE.LoopOnce, 1);
      nextAction.clampWhenFinished = true;
      this.onFinishQueue = nextAfterFinish;
    } else {
      nextAction.setLoop(THREE.LoopRepeat, Infinity);
      nextAction.clampWhenFinished = false;
      this.onFinishQueue = null;
    }

    nextAction.play();
    this.currentClip = name;
  }

  public isMovingState(): boolean {
    return this.currentClip === 'start_walk' || this.currentClip === 'walking';
  }

  public update(delta: number) {
    this.mixer.update(delta);
  }
}
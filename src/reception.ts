import * as THREE from 'three';
import * as SkeletonUtils  from 'three/addons/utils/SkeletonUtils.js';
import { AvatarController } from './AvatarController';

export interface ReceptionHandle {
    update: (delta: number) => void;
    playDoorTransition: (onComplete: () => void) => void;
    cleanup: () => void;
}

const SLIDESHOW_GALLERIES: { id: string; imgId: string }[] = [
    { id: 'Gallery 1', imgId: 'slide-img-0' }, // Classical Wing
    { id: 'Gallery 2', imgId: 'slide-img-1' }, // Modern Wing
    { id: 'Gallery 3', imgId: 'slide-img-2' }, // Labyrinth Maze
];

const GALLERY_META = [
    { title: 'Classical Wing', sub: 'Gallery 1 • Renaissance & Baroque' },
    { title: 'Modern Wing', sub: 'Gallery 2 • Contemporary & Abstract' },
    { title: 'Labyrinth Maze', sub: 'Gallery 3 • Exploratory Winding Halls' },
];

export function buildReceptionScene(
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    characterScene: THREE.Group | null,
    characterAnimations: THREE.AnimationClip[],
    preloadedArtworks: { gallery_id: string; image_url: string }[] = [],
    skipWelcome = false
): ReceptionHandle {
    const receptionGroup = new THREE.Group();
    scene.add(receptionGroup);

    // Warm Grand Lobby Palette
    const prevBg = scene.background;
    const prevFog = scene.fog;
    scene.background = new THREE.Color(0x281e24);
    scene.fog = new THREE.Fog(0x281e24, 16, 46);

    // Camera positioned closer to the reception desk & double gallery doors
    camera.rotation.order = 'YXZ';
    camera.position.set(0.3, 1.62, 2.55);
    camera.lookAt(0.15, 1.45, -4.5);

    // Warm Lobby Lighting
    const lobbyKeyLight = new THREE.PointLight(0xffe6c2, 3.4, 26, 1.3);
    lobbyKeyLight.position.set(0, 4.4, 1.6);
    lobbyKeyLight.castShadow = true;
    receptionGroup.add(lobbyKeyLight);

    const deskFillLight = new THREE.SpotLight(0xfff1dc, 4.4, 16, Math.PI / 3.2, 0.55, 1);
    deskFillLight.position.set(-1.1, 4.0, 1.8);
    deskFillLight.target.position.set(0.8, 1.0, -1.6);
    receptionGroup.add(deskFillLight, deskFillLight.target);

    const doorRimLight = new THREE.PointLight(0xffd2a6, 2.8, 18, 1.4);
    doorRimLight.position.set(0, 3.3, -4.6);
    receptionGroup.add(doorRimLight);

    const leftWallLight = new THREE.PointLight(0xf2d3c9, 1.4, 14, 1.6);
    leftWallLight.position.set(-4.8, 2.8, 0);
    receptionGroup.add(leftWallLight);

    const rightWallLight = new THREE.PointLight(0xf2d3c9, 1.4, 14, 1.6);
    rightWallLight.position.set(4.8, 2.8, 0);
    receptionGroup.add(rightWallLight);

    // Materials (Unified Dark Wall Tone)
    const marbleFloorMat = new THREE.MeshStandardMaterial({
        color: 0xe6ddd2,
        roughness: 0.22,
        metalness: 0.12,
    });
    const carpetMat = new THREE.MeshStandardMaterial({
        color: 0x6b2833,
        roughness: 0.85,
    });
    const darkWallMat = new THREE.MeshStandardMaterial({
        color: 0x2c1d18,
        roughness: 0.65,
        metalness: 0.08,
    });
    const goldMat = new THREE.MeshStandardMaterial({
        color: 0xc5a46d,
        roughness: 0.28,
        metalness: 0.84,
    });
    const darkWoodMat = new THREE.MeshStandardMaterial({
        color: 0x2c1d18,
        roughness: 0.36,
        metalness: 0.15,
    });
    const doorWoodMat = new THREE.MeshStandardMaterial({
        color: 0x3c261f,
        roughness: 0.38,
        metalness: 0.2,
    });
    const ceilingMat = new THREE.MeshStandardMaterial({
        color: 0xf4ede4,
        roughness: 0.85,
    });

    // Floor & Central Runner Carpet
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 16), marbleFloorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    receptionGroup.add(floor);

    const carpet = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 13.5), carpetMat);
    carpet.rotation.x = -Math.PI / 2;
    carpet.position.set(0, 0.004, -0.5);
    receptionGroup.add(carpet);

    [-1.32, 1.32].forEach((bx) => {
        const border = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 13.5), goldMat);
        border.rotation.x = -Math.PI / 2;
        border.position.set(bx, 0.006, -0.5);
        receptionGroup.add(border);
    });

    // Ceiling & Coffered Gold Beams
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(14, 16), ceilingMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = 4.8;
    receptionGroup.add(ceiling);

    [-4.2, -1.4, 1.4, 4.2].forEach((bz) => {
        const beam = new THREE.Mesh(new THREE.BoxGeometry(13.8, 0.16, 0.24), goldMat);
        beam.position.set(0, 4.72, bz);
        receptionGroup.add(beam);
    });

    // Left & Right Side Walls + Trim + Pilasters (Single Dark Wall Color)
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4.8, 16), darkWallMat);
    leftWall.position.set(-6.4, 2.4, -0.5);
    receptionGroup.add(leftWall);

    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4.8, 16), darkWallMat);
    rightWall.position.set(6.4, 2.4, -0.5);
    receptionGroup.add(rightWall);

    const backWallBehindCam = new THREE.Mesh(new THREE.BoxGeometry(13.2, 4.8, 0.4), darkWallMat);
    backWallBehindCam.position.set(0, 2.4, 7.2);
    receptionGroup.add(backWallBehindCam);

    [-6.18, 6.18].forEach((wx) => {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.08, 15.6), goldMat);
        rail.position.set(wx, 1.18, -0.5);
        receptionGroup.add(rail);

        [-4.5, -1.5, 1.5, 4.5].forEach((pz) => {
            const pilaster = new THREE.Mesh(new THREE.BoxGeometry(0.18, 4.7, 0.34), darkWallMat);
            pilaster.position.set(wx, 2.35, pz);
            receptionGroup.add(pilaster);

            const cap = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, 0.4), goldMat);
            cap.position.set(wx, 4.62, pz);
            receptionGroup.add(cap);
        });
    });

    // Front Wall Framing the Double Gallery Doors (z = -6.2, Single Dark Wall Color)
    const frontLeftWall = new THREE.Mesh(new THREE.BoxGeometry(4.9, 4.8, 0.4), darkWallMat);
    frontLeftWall.position.set(-3.85, 2.4, -6.2);
    receptionGroup.add(frontLeftWall);

    const frontRightWall = new THREE.Mesh(new THREE.BoxGeometry(4.9, 4.8, 0.4), darkWallMat);
    frontRightWall.position.set(3.85, 2.4, -6.2);
    receptionGroup.add(frontRightWall);

    const frontHeaderWall = new THREE.Mesh(new THREE.BoxGeometry(3.0, 1.5, 0.4), darkWallMat);
    frontHeaderWall.position.set(0, 4.05, -6.2);
    receptionGroup.add(frontHeaderWall);

    // Gold Doorway Arch Surround
    const leftDoorJamb = new THREE.Mesh(new THREE.BoxGeometry(0.22, 3.35, 0.52), goldMat);
    leftDoorJamb.position.set(-1.42, 1.675, -6.2);
    receptionGroup.add(leftDoorJamb);

    const rightDoorJamb = new THREE.Mesh(new THREE.BoxGeometry(0.22, 3.35, 0.52), goldMat);
    rightDoorJamb.position.set(1.42, 1.675, -6.2);
    receptionGroup.add(rightDoorJamb);

    const topDoorLintel = new THREE.Mesh(new THREE.BoxGeometry(3.06, 0.24, 0.56), goldMat);
    topDoorLintel.position.set(0, 3.38, -6.2);
    receptionGroup.add(topDoorLintel);

    // Warm Interior Glow Behind the Double Doors
    const portalBackdrop = new THREE.Mesh(
        new THREE.PlaneGeometry(3.2, 3.5),
        new THREE.MeshBasicMaterial({ color: 0xffe8c8 })
    );
    portalBackdrop.position.set(0, 1.65, -6.65);
    receptionGroup.add(portalBackdrop);

    // Animated Double Gallery Doors (Hinged at x = -1.3 and x = +1.3)
    const leftDoorPivot = new THREE.Group();
    leftDoorPivot.position.set(-1.3, 0, -6.18);
    receptionGroup.add(leftDoorPivot);

    const leftDoorLeaf = new THREE.Mesh(new THREE.BoxGeometry(1.28, 3.26, 0.12), doorWoodMat);
    leftDoorLeaf.position.set(0.64, 1.63, 0);
    leftDoorPivot.add(leftDoorLeaf);

    const leftDoorTrim = new THREE.Mesh(new THREE.BoxGeometry(0.96, 2.7, 0.15), goldMat);
    leftDoorTrim.position.set(0.64, 1.63, 0);
    leftDoorPivot.add(leftDoorTrim);

    const leftDoorInner = new THREE.Mesh(new THREE.BoxGeometry(0.84, 2.58, 0.16), doorWoodMat);
    leftDoorInner.position.set(0.64, 1.63, 0);
    leftDoorPivot.add(leftDoorInner);

    const leftHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.34, 12), goldMat);
    leftHandle.position.set(1.14, 1.45, 0.1);
    leftDoorPivot.add(leftHandle);

    const rightDoorPivot = new THREE.Group();
    rightDoorPivot.position.set(1.3, 0, -6.18);
    receptionGroup.add(rightDoorPivot);

    const rightDoorLeaf = new THREE.Mesh(new THREE.BoxGeometry(1.28, 3.26, 0.12), doorWoodMat);
    rightDoorLeaf.position.set(-0.64, 1.63, 0);
    rightDoorPivot.add(rightDoorLeaf);

    const rightDoorTrim = new THREE.Mesh(new THREE.BoxGeometry(0.96, 2.7, 0.15), goldMat);
    rightDoorTrim.position.set(-0.64, 1.63, 0);
    rightDoorPivot.add(rightDoorTrim);

    const rightDoorInner = new THREE.Mesh(new THREE.BoxGeometry(0.84, 2.58, 0.16), doorWoodMat);
    rightDoorInner.position.set(-0.64, 1.63, 0);
    rightDoorPivot.add(rightDoorInner);

    const rightHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.34, 12), goldMat);
    rightHandle.position.set(-1.14, 1.45, 0.1);
    rightDoorPivot.add(rightHandle);

    // Concierge / Reception Desk (Placed Right of Center so Doorway Remains Visible)
    const deskGroup = new THREE.Group();
    deskGroup.position.set(1.35, 0, -1.6);
    deskGroup.rotation.y = -0.22;
    receptionGroup.add(deskGroup);

    const deskBody = new THREE.Mesh(new THREE.BoxGeometry(2.35, 1.02, 0.85), darkWoodMat);
    deskBody.position.set(0, 0.51, 0);
    deskBody.castShadow = true;
    deskBody.receiveShadow = true;
    deskGroup.add(deskBody);

    const deskCounterTop = new THREE.Mesh(new THREE.BoxGeometry(2.52, 0.08, 1.02), marbleFloorMat);
    deskCounterTop.position.set(0, 1.06, 0);
    deskGroup.add(deskCounterTop);

    const deskGoldPanel = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.72, 0.04), goldMat);
    deskGoldPanel.position.set(0, 0.52, 0.43);
    deskGroup.add(deskGoldPanel);

    const deskInnerPanel = new THREE.Mesh(new THREE.BoxGeometry(1.98, 0.6, 0.05), carpetMat);
    deskInnerPanel.position.set(0, 0.52, 0.435);
    deskGroup.add(deskInnerPanel);

    // Brass Desk Lamp
    const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.03, 16), goldMat);
    lampBase.position.set(0.82, 1.115, 0.14);
    deskGroup.add(lampBase);

    const lampStem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.28, 12), goldMat);
    lampStem.position.set(0.82, 1.26, 0.14);
    deskGroup.add(lampStem);

    const lampShade = new THREE.Mesh(
        new THREE.ConeGeometry(0.14, 0.14, 16),
        new THREE.MeshStandardMaterial({
            color: 0xffe4b5,
            emissive: 0xffc978,
            emissiveIntensity: 0.65,
        })
    );
    lampShade.position.set(0.82, 1.4, 0.14);
    deskGroup.add(lampShade);

    // Decorative Potted Planters Flanking the Entrance Doors
    [-2.4, 2.4].forEach((px) => {
        const planter = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.18, 0.44, 16), goldMat);
        planter.position.set(px, 0.22, -5.55);
        receptionGroup.add(planter);

        const foliage = new THREE.Mesh(
            new THREE.SphereGeometry(0.32, 14, 14),
            new THREE.MeshStandardMaterial({ color: 0x2e4a36, roughness: 0.8 })
        );
        foliage.position.set(px, 0.58, -5.55);
        receptionGroup.add(foliage);
    });

    // Curator NPC Positioned Behind the Reception Desk
    let curatorAvatar: AvatarController | null = null;
    if (characterScene) {
        const curator = SkeletonUtils.clone(characterScene) as THREE.Group;
        curator.scale.set(1.0, 1.0, 1.0);
        curator.position.set(1.22, 0, -2.35);
        curator.lookAt(0.3, 0, 2.55);
        receptionGroup.add(curator);

        if (characterAnimations && characterAnimations.length > 0) {
            curatorAvatar = new AvatarController(curator, characterAnimations);
            curatorAvatar.play('standing_idle');
        }
    }

    // Two-Step Reception UI + Auto-Rotating Coverflow Carousel + Slideshow
    const welcomeSplash = document.getElementById('welcome-splash');
    const gallerySelector = document.getElementById('gallery-selector');
    const coverflowStage = document.querySelector<HTMLElement>('.coverflow-stage');
    const enterBtn = document.getElementById('btn-enter-experience');
    const prevBtn = document.getElementById('btn-prev-gallery');
    const nextBtn = document.getElementById('btn-next-gallery');
    const activeTitleEl = document.getElementById('active-gallery-title');
    const activeSubEl = document.getElementById('active-gallery-sub');
    const cards = Array.from(document.querySelectorAll<HTMLElement>('.coverflow-card'));

    let activeCardIndex = 1; // Default center card: Modern Wing
    let slideshowTimer: ReturnType<typeof setInterval> | null = null;
    let carouselTimer: ReturnType<typeof setInterval> | null = null;
    let carouselPaused = false;
    let isDisposed = false;
    let doorTransitionActive = false;

    const updateCarouselClasses = () => {
        const total = cards.length;
        const leftIdx = (activeCardIndex - 1 + total) % total;
        const rightIdx = (activeCardIndex + 1) % total;

        cards.forEach((card, idx) => {
            card.classList.remove('is-center', 'is-left', 'is-right');
            if (idx === activeCardIndex) {
                card.classList.add('is-center');
            } else if (idx === leftIdx) {
                card.classList.add('is-left');
            } else {
                card.classList.add('is-right');
            }
        });

        const meta = GALLERY_META[activeCardIndex];
        if (activeTitleEl && meta) activeTitleEl.innerText = meta.title;
        if (activeSubEl && meta) activeSubEl.innerText = meta.sub;
    };

    const startCarouselAutoRotate = () => {
        if (carouselTimer) clearInterval(carouselTimer);
        carouselTimer = setInterval(() => {
            if (isDisposed || carouselPaused || doorTransitionActive) return;
            if (!gallerySelector || gallerySelector.classList.contains('hidden')) return;
            activeCardIndex = (activeCardIndex + 1) % cards.length;
            updateCarouselClasses();
        }, 3800);
    };

    if (skipWelcome) {
        welcomeSplash?.classList.add('hidden');
        gallerySelector?.classList.remove('hidden');
        curatorAvatar?.play('bow', 'standing_idle');
        startCarouselAutoRotate();
    } else {
        welcomeSplash?.classList.remove('hidden');
        gallerySelector?.classList.add('hidden');
    }

    updateCarouselClasses();

    const onStageEnter = () => {
        carouselPaused = true;
    };
    const onStageLeave = () => {
        carouselPaused = false;
    };
    coverflowStage?.addEventListener('mouseenter', onStageEnter);
    coverflowStage?.addEventListener('mouseleave', onStageLeave);

    const onEnterClick = () => {
        welcomeSplash?.classList.add('hidden');
        gallerySelector?.classList.remove('hidden');
        curatorAvatar?.play('bow', 'standing_idle');
        startCarouselAutoRotate();
    };

    const onPrevClick = () => {
        activeCardIndex = (activeCardIndex - 1 + cards.length) % cards.length;
        updateCarouselClasses();
        startCarouselAutoRotate();
    };

    const onNextClick = () => {
        activeCardIndex = (activeCardIndex + 1) % cards.length;
        updateCarouselClasses();
        startCarouselAutoRotate();
    };

    enterBtn?.addEventListener('click', onEnterClick);
    prevBtn?.addEventListener('click', onPrevClick);
    nextBtn?.addEventListener('click', onNextClick);

    const cardClickHandlers: { el: HTMLElement; fn: (e: Event) => void }[] = [];
    cards.forEach((card, idx) => {
        const fn = (e: Event) => {
            if ((e.target as HTMLElement).closest('button')) return;
            if (idx !== activeCardIndex) {
                activeCardIndex = idx;
                updateCarouselClasses();
                startCarouselAutoRotate();
            }
        };
        card.addEventListener('click', fn);
        cardClickHandlers.push({ el: card, fn });
    });

    // Populate rotating gallery preview images on each card from preloaded artworks
    const populateSlideshow = (artworks: { gallery_id: string; image_url: string }[]) => {
        if (isDisposed || !Array.isArray(artworks)) return;

        const grouped: Record<string, string[]> = {
            'Gallery 1': [],
            'Gallery 2': [],
            'Gallery 3': [],
        };

        artworks.forEach((art) => {
            if (grouped[art.gallery_id] && art.image_url) {
                grouped[art.gallery_id].push(art.image_url);
            }
        });

        const slideIndices = [0, 0, 0];

        SLIDESHOW_GALLERIES.forEach((item) => {
            const imgEl = document.getElementById(item.imgId) as HTMLImageElement | null;
            const urls = grouped[item.id];
            if (imgEl && urls && urls.length > 0) {
                imgEl.src = urls[0];
            }
        });

        slideshowTimer = setInterval(() => {
            SLIDESHOW_GALLERIES.forEach((item, idx) => {
                const imgEl = document.getElementById(item.imgId) as HTMLImageElement | null;
                const urls = grouped[item.id];
                if (imgEl && urls && urls.length > 1) {
                    slideIndices[idx] = (slideIndices[idx] + 1) % urls.length;
                    imgEl.style.opacity = '0.35';
                    setTimeout(() => {
                        if (!isDisposed && imgEl) {
                            imgEl.src = urls[slideIndices[idx]];
                            imgEl.style.opacity = '1';
                        }
                    }, 220);
                }
            });
        }, 3400);
    };

    if (preloadedArtworks.length > 0) {
        populateSlideshow(preloadedArtworks);
    } else {
        fetch('/artworks.json')
            .then((res) => res.json())
            .then((artworks) => populateSlideshow(artworks))
            .catch(() => {});
    }

    // Slower Doorway Opening + Camera Glide Animation
    let doorProgress = 0;
    let doorCallback: (() => void) | null = null;
    const startCamPos = new THREE.Vector3();
    const endCamPos = new THREE.Vector3(0, 1.55, -5.8);

    const playDoorTransition = (onComplete: () => void) => {
        if (doorTransitionActive) return;
        doorTransitionActive = true;
        doorProgress = 0;
        doorCallback = onComplete;
        startCamPos.copy(camera.position);
        curatorAvatar?.play('bow', 'standing_idle');
    };

    let idleGreetTimer = 0;

    const update = (delta: number) => {
        curatorAvatar?.update(delta);

        if (!doorTransitionActive) {
            idleGreetTimer += delta;
            if (idleGreetTimer > 12) {
                idleGreetTimer = 0;
                curatorAvatar?.play('bow', 'standing_idle');
            }
            return;
        }

        // Slower, smoother glide speed toward the doors
        doorProgress = Math.min(doorProgress + delta * 0.45, 1);
        const ease =
            doorProgress < 0.5
                ? 2 * doorProgress * doorProgress
                : 1 - Math.pow(-2 * doorProgress + 2, 2) / 2;

        // Swing double doors inward
        const doorAngle = ease * (Math.PI * 0.48);
        leftDoorPivot.rotation.y = doorAngle;
        rightDoorPivot.rotation.y = -doorAngle;

        // Glide camera past the desk toward the glowing gallery doorway
        camera.position.lerpVectors(startCamPos, endCamPos, ease);
        camera.lookAt(0, 1.55, -7.2);

        if (doorProgress >= 1) {
            doorTransitionActive = false;
            const cb = doorCallback;
            doorCallback = null;
            if (cb) cb();
        }
    };

    const cleanup = () => {
        isDisposed = true;
        if (slideshowTimer) clearInterval(slideshowTimer);
        if (carouselTimer) clearInterval(carouselTimer);
        coverflowStage?.removeEventListener('mouseenter', onStageEnter);
        coverflowStage?.removeEventListener('mouseleave', onStageLeave);
        enterBtn?.removeEventListener('click', onEnterClick);
        prevBtn?.removeEventListener('click', onPrevClick);
        nextBtn?.removeEventListener('click', onNextClick);
        cardClickHandlers.forEach(({ el, fn }) => el.removeEventListener('click', fn));

        scene.remove(receptionGroup);
        scene.background = prevBg;
        scene.fog = prevFog;
    };

    return { update, playDoorTransition, cleanup };
}
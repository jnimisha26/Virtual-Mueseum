import './style.css';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils  from 'three/addons/utils/SkeletonUtils.js';
import * as PF from 'pathfinding';
import { loadMuseumGrid, GRID_SIZE } from './grid';
import type { GalleryType } from './grid';
import { AvatarController } from './avatarController';
import { buildReceptionScene } from './reception';
import type { ReceptionHandle } from './reception';

// 1. Scene, Camera, & Renderer Setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a1a);
scene.fog = new THREE.Fog(0x1a1a1a, 15, 60);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('app')?.appendChild(renderer.domElement);

const hemisphereLight = new THREE.HemisphereLight(0xfff8ee, 0x444444, 0.8);
scene.add(hemisphereLight);

const ambientLight = new THREE.AmbientLight(0xfff5e6, 0.4);
scene.add(ambientLight);

// 2. Global Variables for Layout, Animation, & State
let appMode: 'reception' | 'museum' = 'reception';
let receptionHandle: ReceptionHandle | null = null;

let pfGrid = new PF.Grid(GRID_SIZE, GRID_SIZE);
let floorCells: { x: number; y: number }[] = [];
let wallObjects: THREE.Mesh[] = [];
let sceneObjects: THREE.Object3D[] = [];
let interactableArt: THREE.Mesh[] = [];

interface ArtSpot {
    standX: number; // Integer grid X for A* pathfinding
    standZ: number; // Integer grid Z for A* pathfinding
    viewX: number;  // Exact world X with wall clearance
    viewZ: number;  // Exact world Z with wall clearance
    artX: number;
    artZ: number;
}

let allArtPositions: ArtSpot[] = [];

const loadedArtObjects: { gallery_id: string; groupCreator: () => THREE.Group }[] = [];

interface NPCData {
    group: THREE.Group | THREE.Mesh;
    avatar?: AvatarController;
    currentPath: number[][];
    pathIndex: number;
    currentArtIndex: number;
    targetArtSpot: ArtSpot | null;
    pauseUntil: number;
    greetingUntil: number;
    lastGreeted: number;
    blockedSince: number;
    isLookingAtArt: boolean;
    hasAnimations: boolean;
}

let activeNPCs: NPCData[] = [];
let cachedCharacterGLTF: { scene: THREE.Group; animations: THREE.AnimationClip[] } | null = null;
const walkSpeed = 1.0; // Matched to Mixamo walk cycle stride (~1.0 m/s)
const clock = new THREE.Clock();

// 3. UI Elements
const startScreen = document.getElementById('start-screen');
const appContainer = document.getElementById('app');
const minimapCanvas = document.getElementById('minimap') as HTMLCanvasElement;
const minimapCtx = minimapCanvas?.getContext('2d');
const uiLayer = document.getElementById('ui-layer');
const artInfoPopup = document.getElementById('art-info');
const greetingToast = document.getElementById('greeting-toast');
const galleryLoader = document.getElementById('gallery-loader');
const loaderGalleryName = document.getElementById('loader-gallery-name');
let isPopupOpen = false;
let greetingTimeout: ReturnType<typeof setTimeout>;

const textureLoader = new THREE.TextureLoader();
textureLoader.crossOrigin = 'anonymous';

function enterReception() {
    appMode = 'reception';
    if (galleryLoader) {
        galleryLoader.classList.add('hidden');
        galleryLoader.style.display = 'none';
    }
    if (appContainer) appContainer.style.display = 'block';
    if (minimapCanvas) minimapCanvas.style.display = 'none';
    if (uiLayer) uiLayer.style.display = 'none';
    if (startScreen) startScreen.style.display = 'flex';

    if (cachedCharacterGLTF && !receptionHandle) {
        receptionHandle = buildReceptionScene(
            scene,
            camera,
            cachedCharacterGLTF.scene,
            cachedCharacterGLTF.animations
        );
    }
}

// Preload character model and artwork database, then launch the 3D reception lobby
const characterPromise = new Promise<void>((resolve) => {
    const loader = new GLTFLoader();
    loader.load(
        '/models/character_clean.glb',
        (gltf) => {
            cachedCharacterGLTF = { scene: gltf.scene, animations: gltf.animations };
            resolve();
        },
        undefined,
        (err) => {
            console.error('Failed to load character_clean.glb:', err);
            resolve();
        }
    );
});

const artworksPromise = fetch('/artworks.json')
    .then((res) => res.json())
    .then((artworkData: any[]) => {
        if (!artworkData || artworkData.length === 0) {
            return;
        }

        return Promise.all(
            artworkData.map((art) => {
                return new Promise<void>((resolve) => {
                    textureLoader.load(
                        art.image_url,
                        (texture) => {
                            texture.colorSpace = THREE.SRGBColorSpace;

                            const img = texture.image;
                            const aspect = img.width / img.height;
                            let w = 0.9;
                            let h = w / aspect;
                            if (h > 1.3) {
                                h = 1.3;
                                w = h * aspect;
                            }

                            const geo = new THREE.PlaneGeometry(w, h);
                            const mat = new THREE.MeshBasicMaterial({
                                map: texture,
                                side: THREE.FrontSide,
                            });
                            mat.needsUpdate = true;

                            const groupCreator = () => {
                                const group = new THREE.Group();
                                const frameGeo = new THREE.PlaneGeometry(w + 0.1, h + 0.1);
                                const frameMat = new THREE.MeshStandardMaterial({
                                    color: 0x2c2c2c,
                                    roughness: 0.2,
                                });
                                const frameMesh = new THREE.Mesh(frameGeo, frameMat);
                                frameMesh.position.z = -0.002;

                                const artMesh = new THREE.Mesh(geo, mat);
                                artMesh.position.z = 0.005;

                                artMesh.userData = {
                                    title: art.title,
                                    artist: `${art.artist} (${art.year})`,
                                    desc: art.description,
                                    imageSrc: art.image_url,
                                };

                                interactableArt.push(artMesh);

                                group.add(frameMesh);
                                group.add(artMesh);
                                return group;
                            };

                            loadedArtObjects.push({ gallery_id: art.gallery_id, groupCreator });
                            resolve();
                        },
                        undefined,
                        (err) => {
                            console.error(`Failed to load texture for ${art.title}:`, err);
                            resolve();
                        }
                    );
                });
            })
        );
    })
    .catch((err) => {
        console.error('Failed to load artworks.json:', err);
    });

Promise.all([characterPromise, artworksPromise]).then(() => {
    enterReception();
});

document.getElementById('btn-classical')?.addEventListener('click', () => initMuseum('classical'));
document.getElementById('btn-modern')?.addEventListener('click', () => initMuseum('modern'));
document.getElementById('btn-maze')?.addEventListener('click', () => initMuseum('maze'));

const GALLERY_LABELS: Record<GalleryType, string> = {
    classical: 'Entering Classical Wing...',
    modern: 'Entering Modern Wing...',
    maze: 'Entering Labyrinth Maze...',
};

function initMuseum(layoutType: GalleryType) {
    if (loaderGalleryName) {
        loaderGalleryName.innerText = GALLERY_LABELS[layoutType] || 'Entering Gallery...';
    }
    if (galleryLoader) {
        galleryLoader.classList.remove('hidden');
        galleryLoader.style.display = 'flex';
    }

    // Yield two frames so the browser renders the loader immediately before building the 3D gallery
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            if (receptionHandle) {
                receptionHandle.cleanup();
                receptionHandle = null;
            }

            appMode = 'museum';
            if (startScreen) startScreen.style.display = 'none';
            if (appContainer) appContainer.style.display = 'block';
            if (minimapCanvas) minimapCanvas.style.display = 'block';
            if (uiLayer) uiLayer.style.display = 'block';

            buildMuseumLayout(layoutType);

            setTimeout(() => {
                if (galleryLoader) {
                    galleryLoader.classList.add('hidden');
                    galleryLoader.style.display = 'none';
                }
            }, 400);
        });
    });
}

function resetToMenu() {
    if (appMode === 'reception') return;

    if (artInfoPopup) artInfoPopup.style.display = 'none';
    if (greetingToast) greetingToast.style.display = 'none';
    if (galleryLoader) {
        galleryLoader.classList.add('hidden');
        galleryLoader.style.display = 'none';
    }
    isPopupOpen = false;

    sceneObjects.forEach((obj) => scene.remove(obj));
    activeNPCs.forEach((npc) => scene.remove(npc.group));
    sceneObjects = [];
    wallObjects = [];
    interactableArt = [];
    floorCells = [];
    allArtPositions = [];
    activeNPCs = [];

    enterReception();
}

// 4. Build Museum with Taller Walls (3.5 units), Roof Ceiling, and Evenly Distributed Studio Lighting
function buildMuseumLayout(layoutType: GalleryType) {
    pfGrid = new PF.Grid(GRID_SIZE, GRID_SIZE);
    const { grid, start: entrance } = loadMuseumGrid(layoutType);

    const floorGeo = new THREE.PlaneGeometry(1, 1);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6 });

    const ceilingGeo = new THREE.PlaneGeometry(1, 1);
    const ceilingMat = new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.9 });

    const wallHeight = 3.5;
    const wallGeo = new THREE.BoxGeometry(1, wallHeight, 1);

    let outerWallColor = 0xf7f3e9;
    let innerWallColor = 0xb5b0a1;

    let targetGalleryId = 'Gallery 1';

    if (layoutType === 'classical') {
        outerWallColor = 0x8a9a86;
        innerWallColor = 0x6b343a;
        targetGalleryId = 'Gallery 1';
    } else if (layoutType === 'modern') {
        outerWallColor = 0x35483d;
        innerWallColor = 0xd0d4d8;
        targetGalleryId = 'Gallery 2';
    } else if (layoutType === 'maze') {
        outerWallColor = 0xb5b0a1;
        innerWallColor = 0xf7f3e9;
        targetGalleryId = 'Gallery 3';
    }

    const availableArtworks = loadedArtObjects
        .filter((art) => art.gallery_id === targetGalleryId)
        .sort(() => Math.random() - 0.5);

    let currentArtIndex = 0;

    interface WallFace {
        x: number;
        z: number;
        dirX: number;
        dirZ: number;
        rotY: number;
    }
    const potentialFaces: WallFace[] = [];

    let minX = GRID_SIZE,
        maxX = 0,
        minZ = GRID_SIZE,
        maxZ = 0;
    grid.forEach((row) => {
        row.forEach((cell) => {
            if (cell.type === 'wall') {
                if (cell.x < minX) minX = cell.x;
                if (cell.x > maxX) maxX = cell.x;
                if (cell.y < minZ) minZ = cell.y;
                if (cell.y > maxZ) maxZ = cell.y;
            }
        });
    });

    grid.forEach((row) => {
        row.forEach((cell) => {
            const floor = new THREE.Mesh(floorGeo, floorMat);
            floor.rotation.x = -Math.PI / 2;
            floor.position.set(cell.x, 0, cell.y);
            scene.add(floor);
            sceneObjects.push(floor);

            const ceiling = new THREE.Mesh(ceilingGeo, ceilingMat);
            ceiling.rotation.x = Math.PI / 2;
            ceiling.position.set(cell.x, wallHeight, cell.y);
            scene.add(ceiling);
            sceneObjects.push(ceiling);

            if (cell.type === 'wall') {
                const isOuterWall =
                    cell.x === minX || cell.x === maxX || cell.y === minZ || cell.y === maxZ;
                const solidWallColor = isOuterWall ? outerWallColor : innerWallColor;

                const wall = new THREE.Mesh(
                    wallGeo,
                    new THREE.MeshStandardMaterial({
                        color: solidWallColor,
                        roughness: 0.85,
                        metalness: 0.05,
                    })
                );
                wall.position.set(cell.x, wallHeight / 2, cell.y);
                scene.add(wall);
                pfGrid.setWalkableAt(cell.x, cell.y, false);
                wallObjects.push(wall);
                sceneObjects.push(wall);

                const checkAndCollectFace = (offsetX: number, offsetZ: number, rotationY: number) => {
                    const nx = cell.x + offsetX;
                    const nz = cell.y + offsetZ;
                    const neighbor = grid[nz]?.[nx];

                    if (!neighbor || (neighbor.type !== 'floor' && neighbor.type !== 'art')) return;

                    if (offsetX !== 0) {
                        const corner1 = grid[cell.y - 1]?.[cell.x];
                        const corner2 = grid[cell.y + 1]?.[cell.x];
                        const frontCorner1 = grid[cell.y - 1]?.[nx];
                        const frontCorner2 = grid[cell.y + 1]?.[nx];
                        if (corner1?.type === 'wall' && frontCorner1?.type === 'wall') return;
                        if (corner2?.type === 'wall' && frontCorner2?.type === 'wall') return;
                    } else if (offsetZ !== 0) {
                        const corner1 = grid[cell.y]?.[cell.x - 1];
                        const corner2 = grid[cell.y]?.[cell.x + 1];
                        const frontCorner1 = grid[nz]?.[cell.x - 1];
                        const frontCorner2 = grid[nz]?.[cell.x + 1];
                        if (corner1?.type === 'wall' && frontCorner1?.type === 'wall') return;
                        if (corner2?.type === 'wall' && frontCorner2?.type === 'wall') return;
                    }

                    potentialFaces.push({
                        x: cell.x,
                        z: cell.y,
                        dirX: offsetX,
                        dirZ: offsetZ,
                        rotY: rotationY,
                    });
                };

                checkAndCollectFace(-1, 0, -Math.PI / 2);
                checkAndCollectFace(1, 0, Math.PI / 2);
                checkAndCollectFace(0, -1, Math.PI);
                checkAndCollectFace(0, 1, 0);
            } else if (cell.type === 'floor' || cell.type === 'art') {
                floorCells.push({ x: cell.x, y: cell.y });
            }
        });
    });

    const nsSegments = new Map<string, WallFace[]>();
    const ewSegments = new Map<string, WallFace[]>();

    potentialFaces.forEach((face) => {
        if (face.dirZ !== 0) {
            const key = `${face.dirZ}_${face.z}`;
            if (!nsSegments.has(key)) nsSegments.set(key, []);
            nsSegments.get(key)!.push(face);
        } else {
            const key = `${face.dirX}_${face.x}`;
            if (!ewSegments.has(key)) ewSegments.set(key, []);
            ewSegments.get(key)!.push(face);
        }
    });

    const processSegments = (facesMap: Map<string, WallFace[]>, isHorizontal: boolean) => {
        facesMap.forEach((faces) => {
            faces.sort((a, b) => (isHorizontal ? a.x - b.x : a.z - b.z));

            let currentSegment: WallFace[] = [faces[0]];
            const allSegments: WallFace[][] = [];

            for (let i = 1; i < faces.length; i++) {
                const prev = faces[i - 1];
                const curr = faces[i];
                const isContinuous = isHorizontal ? curr.x === prev.x + 1 : curr.z === prev.z + 1;

                if (isContinuous) {
                    currentSegment.push(curr);
                } else {
                    allSegments.push(currentSegment);
                    currentSegment = [curr];
                }
            }
            allSegments.push(currentSegment);

            allSegments.forEach((seg) => {
                const length = seg.length;
                const count = Math.max(1, Math.round(length / 2.0));

                const startPos = isHorizontal ? seg[0].x - 0.5 : seg[0].z - 0.5;
                const rotY = seg[0].rotY;
                const dirX = seg[0].dirX;
                const dirZ = seg[0].dirZ;
                const fixedPos = isHorizontal ? seg[0].z : seg[0].x;

                for (let i = 0; i < count; i++) {
                    const offsetAlongSegment = (i + 0.5) * (length / count);
                    const centerPos = startPos + offsetAlongSegment;

                    const posX = isHorizontal ? centerPos : fixedPos + dirX * 0.51;
                    const posZ = isHorizontal ? fixedPos + dirZ * 0.51 : centerPos;

                    let framedGroup: THREE.Group;
                    if (currentArtIndex < availableArtworks.length) {
                        framedGroup = availableArtworks[currentArtIndex].groupCreator();
                        currentArtIndex++;
                    } else {
                        framedGroup = new THREE.Group();
                        const frameGeo = new THREE.PlaneGeometry(1.0, 1.0);
                        const frameMat = new THREE.MeshStandardMaterial({
                            color: 0x2c2c2c,
                            roughness: 0.2,
                        });
                        const frameMesh = new THREE.Mesh(frameGeo, frameMat);
                        frameMesh.position.z = -0.002;

                        const blankGeo = new THREE.PlaneGeometry(0.9, 0.9);
                        const blankMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
                        const blankMesh = new THREE.Mesh(blankGeo, blankMat);
                        blankMesh.position.z = 0.005;

                        blankMesh.userData = {
                            title: 'Empty Exhibit',
                            artist: 'Unknown',
                            desc: 'This wall space is currently empty.',
                            imageSrc: '',
                        };
                        interactableArt.push(blankMesh);
                        framedGroup.add(frameMesh);
                        framedGroup.add(blankMesh);
                    }

                    framedGroup.position.set(posX, 1.6, posZ);
                    framedGroup.rotation.y = rotY;

                    scene.add(framedGroup);
                    sceneObjects.push(framedGroup);

                    const fixtureGeo = new THREE.CylinderGeometry(0.08, 0.12, 0.2, 8);
                    const fixtureMat = new THREE.MeshStandardMaterial({
                        color: 0x111111,
                        metalness: 0.8,
                        roughness: 0.2,
                    });
                    const fixtureMesh = new THREE.Mesh(fixtureGeo, fixtureMat);
                    fixtureMesh.position.set(posX + dirX * 0.4, 3.45, posZ + dirZ * 0.4);
                    scene.add(fixtureMesh);
                    sceneObjects.push(fixtureMesh);

                    const artSpotlight = new THREE.SpotLight(0xfff0d1, 4.0, 8, Math.PI / 3, 0.5, 1);
                    artSpotlight.position.set(posX + dirX * 0.4, 3.45, posZ + dirZ * 0.4);
                    scene.add(artSpotlight);
                    scene.add(artSpotlight.target);
                    artSpotlight.target.position.set(posX, 1.6, posZ);
                    sceneObjects.push(artSpotlight as unknown as THREE.Object3D);

                    const nearX = Math.round(posX + dirX * 0.5);
                    const nearZ = Math.round(posZ + dirZ * 0.5);
                    // const farX = nearX + dirX;
                    // const farZ = nearZ + dirZ;

                    let standX = nearX;
                    let standZ = nearZ;
                    let viewX = nearX + dirX * 0;
                    let viewZ = nearZ + dirZ * 0;

                    // if (
                    //     farX >= 0 &&
                    //     farX < GRID_SIZE &&
                    //     farZ >= 0 &&
                    //     farZ < GRID_SIZE &&
                    //     pfGrid.isWalkableAt(nearX, nearZ) &&
                    //     pfGrid.isWalkableAt(farX, farZ)
                    // ) {
                    //     standX = farX;
                    //     standZ = farZ;
                    //     viewX = farX - dirX * 0.15;
                    //     viewZ = farZ - dirZ * 0.15;
                    // } else if (!pfGrid.isWalkableAt(standX, standZ)) {
                    //     const fallbackCell = floorCells.reduce((closest, cell) => {
                    //         const d1 = Math.hypot(
                    //             cell.x - (posX + dirX * 0.5),
                    //             cell.y - (posZ + dirZ * 0.5)
                    //         );
                    //         const d2 = Math.hypot(
                    //             closest.x - (posX + dirX * 0.5),
                    //             closest.y - (posZ + dirZ * 0.5)
                    //         );
                    //         return d1 < d2 ? cell : closest;
                    //     }, floorCells[0]);
                    //     standX = fallbackCell.x;
                    //     standZ = fallbackCell.y;
                    //     viewX = standX;
                    //     viewZ = standZ;
                    // }

                    allArtPositions.push({
                        standX,
                        standZ,
                        viewX,
                        viewZ,
                        artX: posX,
                        artZ: posZ,
                    });
                }
            });
        });
    };

    processSegments(nsSegments, true);
    processSegments(ewSegments, false);

    // Order art spots so consecutive stops are adjacent paintings
    if (allArtPositions.length > 1) {
        const ordered: ArtSpot[] = [allArtPositions[0]];
        const remaining = allArtPositions.slice(1);
        while (remaining.length > 0) {
            const last = ordered[ordered.length - 1];
            let nearestIdx = 0;
            let nearestDist = Infinity;
            remaining.forEach((spot, idx) => {
                const d = Math.hypot(spot.standX - last.standX, spot.standZ - last.standZ);
                if (d < nearestDist) {
                    nearestDist = d;
                    nearestIdx = idx;
                }
            });
            ordered.push(remaining.splice(nearestIdx, 1)[0]);
        }
        allArtPositions = ordered;
    }

    floorCells.forEach((fc, idx) => {
        if (idx % 3 === 0) {
            const overheadLight = new THREE.PointLight(0xfff4e0, 1.0, 6, 2);
            overheadLight.position.set(fc.x, 3.4, fc.y);
            scene.add(overheadLight);
            sceneObjects.push(overheadLight as unknown as THREE.Object3D);
        }
    });

    camera.position.set(entrance.x, 1.5, entrance.y);
    camera.lookAt(entrance.x, 1.5, entrance.y - 1);

    // Spawn a single NPC on a walkable floor tile away from entrance
    const farCells = floorCells.filter(
        (c) => Math.hypot(c.x - entrance.x, c.y - entrance.y) > 2.5
    );
    const spawnPool = farCells.length > 0 ? farCells : floorCells;
    const spawnLoc = spawnPool[Math.floor(Math.random() * spawnPool.length)] || entrance;
    spawnNPC(spawnLoc.x, spawnLoc.y);
}

// 5. Load character_clean.glb with SkeletonUtils & AvatarController
function spawnNPC(startX: number, startY: number) {
    const setupNPC = (gltfScene: THREE.Group, animations: THREE.AnimationClip[]) => {
        const npcGroup = SkeletonUtils.clone(gltfScene) as THREE.Group;
        npcGroup.scale.set(1.0, 1.0, 1.0);
        npcGroup.position.set(startX, 0, startY);
        scene.add(npcGroup);

        const hasAnimations = animations && animations.length > 0;
        const avatar = hasAnimations ? new AvatarController(npcGroup, animations) : undefined;

        const newNPC: NPCData = {
            group: npcGroup,
            avatar,
            currentPath: [],
            pathIndex: 0,
            currentArtIndex: -1,
            targetArtSpot: null,
            pauseUntil: 0,
            greetingUntil: 0,
            lastGreeted: Date.now() - 7000,
            blockedSince: 0,
            isLookingAtArt: false,
            hasAnimations,
        };
        activeNPCs.push(newNPC);
        assignNewPath(newNPC);
    };

    if (cachedCharacterGLTF) {
        setupNPC(cachedCharacterGLTF.scene, cachedCharacterGLTF.animations);
        return;
    }

    const loader = new GLTFLoader();
    loader.load(
        '/models/character_clean.glb',
        (gltf) => {
            cachedCharacterGLTF = { scene: gltf.scene, animations: gltf.animations };
            setupNPC(gltf.scene, gltf.animations);
        },
        undefined,
        (err) => {
            console.error('Failed to load character_clean.glb:', err);
        }
    );
}

function assignNewPath(npcData: NPCData, avoidPlayerTile = false) {
    if (allArtPositions.length === 0) return;

    npcData.currentArtIndex = (npcData.currentArtIndex + 1) % allArtPositions.length;
    const nextSpot = allArtPositions[npcData.currentArtIndex];
    npcData.targetArtSpot = nextSpot;

    const finder = new PF.AStarFinder();
    const gridClone = pfGrid.clone();

    const startGridX = Math.round(npcData.group.position.x);
    const startGridZ = Math.round(npcData.group.position.z);

    if (avoidPlayerTile) {
        const playerGridX = Math.round(camera.position.x);
        const playerGridZ = Math.round(camera.position.z);
        if (
            playerGridX >= 0 &&
            playerGridX < GRID_SIZE &&
            playerGridZ >= 0 &&
            playerGridZ < GRID_SIZE &&
            !(playerGridX === startGridX && playerGridZ === startGridZ) &&
            !(playerGridX === nextSpot.standX && playerGridZ === nextSpot.standZ)
        ) {
            gridClone.setWalkableAt(playerGridX, playerGridZ, false);
        }
    }

    const path = finder.findPath(
        startGridX,
        startGridZ,
        nextSpot.standX,
        nextSpot.standZ,
        gridClone
    );

    npcData.currentPath = path;
    npcData.pathIndex = path.length > 1 ? 1 : 0;
}

function displayGreeting(message: string) {
    if (greetingToast) {
        greetingToast.innerText = message;
        greetingToast.style.display = 'block';
        clearTimeout(greetingTimeout);
        greetingTimeout = setTimeout(() => {
            greetingToast.style.display = 'none';
        }, 3500);
    }
}

// 6. Controls, Collisions & Artwork Zoom/Pan Interactions
const keys: Record<string, boolean> = {
    w: false,
    a: false,
    s: false,
    d: false,
    arrowup: false,
    arrowdown: false,
    arrowleft: false,
    arrowright: false,
};

window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') resetToMenu();
    const k = e.key.toLowerCase();
    if (k in keys) keys[k] = true;
});
window.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    if (k in keys) keys[k] = false;
});

const interactionRaycaster = new THREE.Raycaster();
const screenCenter = new THREE.Vector2(0, 0);

let currentZoom = 1;
let baseImgWidth = 0;
let baseImgHeight = 0;

function applyImageZoom() {
    const imgEl = document.getElementById('art-detail-image') as HTMLImageElement | null;
    if (!imgEl) return;

    if (currentZoom <= 1) {
        currentZoom = 1;
        imgEl.classList.remove('is-zoomed');
        imgEl.style.width = '';
        imgEl.style.height = '';
    } else {
        if (!baseImgWidth || !baseImgHeight) {
            baseImgWidth = imgEl.clientWidth;
            baseImgHeight = imgEl.clientHeight;
        }
        imgEl.classList.add('is-zoomed');
        imgEl.style.width = `${Math.round(baseImgWidth * currentZoom)}px`;
        imgEl.style.height = `${Math.round(baseImgHeight * currentZoom)}px`;
    }
}

window.addEventListener('pointerdown', (e) => {
    if (appMode !== 'museum') return;

    if (isPopupOpen) {
        const popup = document.getElementById('art-info');
        if (popup && popup.contains(e.target as Node)) {
            return;
        }

        if (artInfoPopup) artInfoPopup.style.display = 'none';
        isPopupOpen = false;
        return;
    }

    interactionRaycaster.setFromCamera(screenCenter, camera);
    const intersects = interactionRaycaster.intersectObjects(interactableArt);

    if (intersects.length > 0 && intersects[0].distance < 3.0) {
        const hitArt = intersects[0].object;
        if (artInfoPopup) {
            const titleEl = document.getElementById('art-title');
            const artistEl = document.getElementById('art-artist');
            const descEl = document.getElementById('art-desc');
            const imgEl = document.getElementById('art-detail-image') as HTMLImageElement | null;

            if (titleEl) titleEl.innerText = hitArt.userData.title;
            if (artistEl) artistEl.innerText = hitArt.userData.artist;
            if (descEl) descEl.innerText = hitArt.userData.desc;

            if (imgEl) {
                currentZoom = 1;
                baseImgWidth = 0;
                baseImgHeight = 0;
                imgEl.classList.remove('is-zoomed');
                imgEl.style.width = '';
                imgEl.style.height = '';
                imgEl.src = hitArt.userData.imageSrc;
            }

            artInfoPopup.style.display = 'block';
            isPopupOpen = true;
        }
    }
});

const imgContainer = document.getElementById('art-image-container');
if (imgContainer) {
    imgContainer.addEventListener(
        'wheel',
        (e) => {
            if (e.shiftKey || e.ctrlKey || e.metaKey) {
                e.preventDefault();

                const prevZoom = currentZoom;
                const zoomSpeed = 0.25;
                currentZoom = e.deltaY < 0 ? currentZoom + zoomSpeed : currentZoom - zoomSpeed;
                currentZoom = Math.max(1, Math.min(currentZoom, 4));

                if (currentZoom !== prevZoom) {
                    const ratio = currentZoom / prevZoom;
                    const rect = imgContainer.getBoundingClientRect();
                    const cursorX = e.clientX - rect.left + imgContainer.scrollLeft;
                    const cursorY = e.clientY - rect.top + imgContainer.scrollTop;

                    applyImageZoom();

                    imgContainer.scrollLeft = cursorX * ratio - (e.clientX - rect.left);
                    imgContainer.scrollTop = cursorY * ratio - (e.clientY - rect.top);
                }
            }
            // Without Shift/Ctrl/Meta, standard mouse wheel scrolls vertically/horizontally through the zoomed image
        },
        { passive: false }
    );

    // Click-and-drag panning while zoomed in
    let isDraggingImage = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let startScrollLeft = 0;
    let startScrollTop = 0;

    imgContainer.addEventListener('pointerdown', (e) => {
        if (currentZoom <= 1) return;
        isDraggingImage = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        startScrollLeft = imgContainer.scrollLeft;
        startScrollTop = imgContainer.scrollTop;
        imgContainer.setPointerCapture(e.pointerId);
    });

    imgContainer.addEventListener('pointermove', (e) => {
        if (!isDraggingImage) return;
        imgContainer.scrollLeft = startScrollLeft - (e.clientX - dragStartX);
        imgContainer.scrollTop = startScrollTop - (e.clientY - dragStartY);
    });

    const stopDragging = () => {
        isDraggingImage = false;
    };
    imgContainer.addEventListener('pointerup', stopDragging);
    imgContainer.addEventListener('pointercancel', stopDragging);
}

const playerSpeed = 0.08;
const forwardVector = new THREE.Vector3();
const rightVector = new THREE.Vector3();
const moveRaycaster = new THREE.Raycaster();
const collisionDistance = 0.8;
const npcCollisionRadius = 0.75;
const npcWallClearance = 0.38;

function enforceWallClearance(pos: THREE.Vector3) {
    const gx = Math.round(pos.x);
    const gz = Math.round(pos.z);

    if (gx - 1 >= 0 && !pfGrid.isWalkableAt(gx - 1, gz)) {
        const minAllowedX = gx - 0.5 + npcWallClearance;
        if (pos.x < minAllowedX) pos.x = minAllowedX;
    }
    if (gx + 1 < GRID_SIZE && !pfGrid.isWalkableAt(gx + 1, gz)) {
        const maxAllowedX = gx + 0.5 - npcWallClearance;
        if (pos.x > maxAllowedX) pos.x = maxAllowedX;
    }
    if (gz - 1 >= 0 && !pfGrid.isWalkableAt(gx, gz - 1)) {
        const minAllowedZ = gz - 0.5 + npcWallClearance;
        if (pos.z < minAllowedZ) pos.z = minAllowedZ;
    }
    if (gz + 1 < GRID_SIZE && !pfGrid.isWalkableAt(gx, gz + 1)) {
        const maxAllowedZ = gz + 0.5 - npcWallClearance;
        if (pos.z > maxAllowedZ) pos.z = maxAllowedZ;
    }
}

function drawMinimap() {
    if (!minimapCtx || !minimapCanvas || minimapCanvas.style.display === 'none') return;

    minimapCtx.clearRect(0, 0, minimapCanvas.width, minimapCanvas.height);
    const cellSize = minimapCanvas.width / GRID_SIZE;

    wallObjects.forEach((wall) => {
        minimapCtx.fillStyle = '#666';
        minimapCtx.fillRect(wall.position.x * cellSize, wall.position.z * cellSize, cellSize, cellSize);
    });

    activeNPCs.forEach((npc) => {
        minimapCtx.fillStyle = '#00ffff';
        minimapCtx.beginPath();
        minimapCtx.arc(
            npc.group.position.x * cellSize + cellSize / 2,
            npc.group.position.z * cellSize + cellSize / 2,
            cellSize / 3,
            0,
            Math.PI * 2
        );
        minimapCtx.fill();
    });

    minimapCtx.fillStyle = '#ff4444';
    minimapCtx.beginPath();
    const px = camera.position.x * cellSize + cellSize / 2;
    const pz = camera.position.z * cellSize + cellSize / 2;
    minimapCtx.arc(px, pz, cellSize / 3, 0, Math.PI * 2);
    minimapCtx.fill();

    minimapCtx.strokeStyle = '#ff4444';
    minimapCtx.lineWidth = 2;
    minimapCtx.beginPath();
    minimapCtx.moveTo(px, pz);
    minimapCtx.lineTo(px + forwardVector.x * cellSize, pz + forwardVector.z * cellSize);
    minimapCtx.stroke();
}

// 7. Animation Loop
const npcForwardVec = new THREE.Vector3();
const toPlayerVec = new THREE.Vector3();
const greetingRaycaster = new THREE.Raycaster();
const npcWallRaycaster = new THREE.Raycaster();
const npcEyePos = new THREE.Vector3();
const npcChestPos = new THREE.Vector3();

function animate() {
    requestAnimationFrame(animate);
    const now = Date.now();
    const delta = clock.getDelta();

    if (appMode === 'reception') {
        receptionHandle?.update(delta);
        renderer.render(scene, camera);
        return;
    }

    if (!isPopupOpen) {
        const turnSpeed = 0.04;
        if (keys.arrowleft) camera.rotation.y += turnSpeed;
        if (keys.arrowright) camera.rotation.y -= turnSpeed;

        camera.getWorldDirection(forwardVector);
        forwardVector.y = 0;
        forwardVector.normalize();
        rightVector.crossVectors(forwardVector, camera.up).normalize();

        function canMove(dir: THREE.Vector3): boolean {
            moveRaycaster.set(camera.position, dir);
            const hits = moveRaycaster.intersectObjects(wallObjects);
            if (hits.length > 0 && hits[0].distance <= collisionDistance) {
                return false;
            }

            const nextX = camera.position.x + dir.x * playerSpeed;
            const nextZ = camera.position.z + dir.z * playerSpeed;
            for (const npc of activeNPCs) {
                const currentDist = Math.hypot(
                    camera.position.x - npc.group.position.x,
                    camera.position.z - npc.group.position.z
                );
                const nextDist = Math.hypot(
                    nextX - npc.group.position.x,
                    nextZ - npc.group.position.z
                );
                if (nextDist < npcCollisionRadius && nextDist < currentDist) {
                    return false;
                }
            }

            return true;
        }

        const moveForward = keys.w || keys.arrowup;
        const moveBackward = keys.s || keys.arrowdown;

        if (moveForward && canMove(forwardVector))
            camera.position.addScaledVector(forwardVector, playerSpeed);
        if (moveBackward && canMove(forwardVector.clone().negate()))
            camera.position.addScaledVector(forwardVector, -playerSpeed);
        if (keys.a && canMove(rightVector.clone().negate()))
            camera.position.addScaledVector(rightVector, -playerSpeed);
        if (keys.d && canMove(rightVector))
            camera.position.addScaledVector(rightVector, playerSpeed);
    }

    activeNPCs.forEach((npc) => {
        if (npc.avatar) npc.avatar.update(delta);

        toPlayerVec.subVectors(camera.position, npc.group.position);
        toPlayerVec.y = 0;
        const distToPlayer = toPlayerVec.length();
        if (distToPlayer > 0.0001) {
            toPlayerVec.normalize();
        }

        npcForwardVec.set(0, 0, 1).applyQuaternion(npc.group.quaternion);
        npcForwardVec.y = 0;
        npcForwardVec.normalize();

        const isPlayerInFrontOrSide = npcForwardVec.dot(toPlayerVec) > -0.15;

        let hasLineOfSight = false;
        if (distToPlayer < 1.8 && isPlayerInFrontOrSide) {
            npcEyePos.set(npc.group.position.x, 1.4, npc.group.position.z);
            greetingRaycaster.set(npcEyePos, toPlayerVec);
            const wallHits = greetingRaycaster.intersectObjects(wallObjects);
            hasLineOfSight = wallHits.length === 0 || wallHits[0].distance > distToPlayer;
        }

        if (hasLineOfSight && now > npc.lastGreeted + 10000) {
            displayGreeting("Hello! Beautiful day for art, isn't it?");
            npc.greetingUntil = now + 2800;
            npc.lastGreeted = now;

            if (npc.isLookingAtArt && npc.pauseUntil > now) {
                npc.pauseUntil += 2800;
            }

            npc.group.lookAt(camera.position.x, 0, camera.position.z);
            const postGreetClip = npc.isLookingAtArt ? 'thinking' : 'standing_idle';
            npc.avatar?.play('bow', postGreetClip);
        }

        const isGreeting = now < npc.greetingUntil;
        const isTooCloseToUser = distToPlayer < npcCollisionRadius;
        const isPaused = isGreeting || now < npc.pauseUntil || isTooCloseToUser;

        if (isPaused) {
            if (!isGreeting && npc.avatar && npc.avatar.isMovingState()) {
                npc.avatar.play('standing_idle');
            }

            if (isTooCloseToUser && !isGreeting && !npc.isLookingAtArt) {
                if (npc.blockedSince === 0) {
                    npc.blockedSince = now;
                } else if (now - npc.blockedSince > 1500) {
                    npc.blockedSince = 0;
                    assignNewPath(npc, true);
                }
            } else {
                npc.blockedSince = 0;
            }

            if (!isGreeting && npc.isLookingAtArt && npc.targetArtSpot) {
                npc.group.lookAt(npc.targetArtSpot.artX, 0, npc.targetArtSpot.artZ);
            }
        } else {
            npc.blockedSince = 0;

            if (npc.currentPath.length > 0 && npc.pathIndex < npc.currentPath.length) {
                const isLastWaypoint = npc.pathIndex === npc.currentPath.length - 1;
                const rawTargetX =
                    isLastWaypoint && npc.targetArtSpot
                        ? npc.targetArtSpot.viewX
                        : npc.currentPath[npc.pathIndex][0];
                const rawTargetZ =
                    isLastWaypoint && npc.targetArtSpot
                        ? npc.targetArtSpot.viewZ
                        : npc.currentPath[npc.pathIndex][1];

                const currentPos = npc.group.position;
                const targetPos = new THREE.Vector3(rawTargetX, 0, rawTargetZ);
                enforceWallClearance(targetPos);

                const moveDir = new THREE.Vector3().subVectors(targetPos, currentPos);
                moveDir.y = 0;

                const dist = moveDir.length();
                const step = walkSpeed * delta;

                if (dist > step && dist > 0.06) {
                    moveDir.normalize();

                    const nextPos = new THREE.Vector3(
                        currentPos.x + moveDir.x * step,
                        0,
                        currentPos.z + moveDir.z * step
                    );
                    enforceWallClearance(nextPos);

                    const actualMoved = Math.hypot(
                        nextPos.x - currentPos.x,
                        nextPos.z - currentPos.z
                    );

                    // Snap to waypoint if wall-clamping stalls movement instead of walking in place
                    if (actualMoved < step * 0.15) {
                        npc.pathIndex++;
                        return;
                    }

                    const nextDistToUser = Math.hypot(
                        nextPos.x - camera.position.x,
                        nextPos.z - camera.position.z
                    );

                    npcChestPos.set(currentPos.x, 1.0, currentPos.z);
                    npcWallRaycaster.set(npcChestPos, moveDir);
                    const wallHits = npcWallRaycaster.intersectObjects(wallObjects);
                    const hitsWall = wallHits.length > 0 && wallHits[0].distance < npcWallClearance;

                    if (hitsWall) {
                        assignNewPath(npc, true);
                        return;
                    }

                    if (nextDistToUser < npcCollisionRadius && nextDistToUser < distToPlayer) {
                        if (npc.avatar && npc.avatar.isMovingState()) {
                            npc.avatar.play('standing_idle');
                        }
                        return;
                    }

                    if (npc.avatar && npc.avatar.currentClip !== 'walking') {
                        npc.avatar.play('walking');
                    }

                    currentPos.copy(nextPos);
                    npc.group.lookAt(targetPos.x, 0, targetPos.z);
                    currentPos.y = 0;
                } else {
                    currentPos.copy(targetPos);
                    npc.pathIndex++;
                }
            } else {
                if (!npc.isLookingAtArt) {
                    npc.pauseUntil = now + (Math.random() * 3000 + 5000);
                    npc.isLookingAtArt = true;
                    if (npc.targetArtSpot) {
                        npc.group.lookAt(npc.targetArtSpot.artX, 0, npc.targetArtSpot.artZ);
                    }
                    npc.avatar?.play('thinking', 'standing_idle');
                } else {
                    npc.isLookingAtArt = false;
                    assignNewPath(npc, true);
                }
            }
        }
    });

    drawMinimap();
    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
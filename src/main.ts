import './style.css';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as  SkeletonUtils  from 'three/addons/utils/SkeletonUtils.js';
import * as PF from 'pathfinding';
import { loadMuseumGrid, GRID_SIZE } from './grid';
import type { GalleryType } from './grid';
import { AvatarController } from './AvatarController';
import { buildReceptionScene } from './reception';
import type { ReceptionHandle } from './reception';

// 1. Scene, Camera, & Renderer Setup (Original Gallery Lighting Preserved)
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a1a);
scene.fog = new THREE.Fog(0x1a1a1a, 15, 60);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.rotation.order = 'YXZ';

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
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
let isTransitioningGallery = false;

let pfGrid = new PF.Grid(GRID_SIZE, GRID_SIZE);
let floorCells: { x: number; y: number }[] = [];
let sceneObjects: THREE.Object3D[] = [];
let galleryLights: THREE.Light[] = [];
let interactableArt: THREE.Mesh[] = [];
let hoveredArtMesh: THREE.Mesh | null = null;

interface ArtSpot {
    standX: number;
    standZ: number;
    viewX: number;
    viewZ: number;
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
const walkSpeed = 1.0;
const clock = new THREE.Clock();

// Proximity Light Culling State
const lastLightUpdatePos = new THREE.Vector3(Infinity, Infinity, Infinity);
const LIGHT_ACTIVE_RADIUS_SQ = 11 * 11;

function updateNearbyLights() {
    if (camera.position.distanceToSquared(lastLightUpdatePos) < 0.56) return;
    lastLightUpdatePos.copy(camera.position);

    for (let i = 0; i < galleryLights.length; i++) {
        const l = galleryLights[i];
        const dx = l.position.x - camera.position.x;
        const dz = l.position.z - camera.position.z;
        l.visible = dx * dx + dz * dz <= LIGHT_ACTIVE_RADIUS_SQ;
    }
}

// 3. UI Elements & Offscreen Static Minimap Cache
const startScreen = document.getElementById('start-screen');
const appContainer = document.getElementById('app');
const minimapCanvas = document.getElementById('minimap') as HTMLCanvasElement;
const minimapCtx = minimapCanvas?.getContext('2d');
const uiLayer = document.getElementById('ui-layer');
const artInfoPopup = document.getElementById('art-info');
const greetingToast = document.getElementById('greeting-toast');
const galleryLoader = document.getElementById('gallery-loader');
const loaderGalleryName = document.getElementById('loader-gallery-name');
const hoverPromptEl = document.getElementById('hover-prompt');
const crosshairEl = document.getElementById('crosshair');
const exitReceptionBtn = document.getElementById('btn-exit-reception');
const mobileInspectBtn = document.getElementById('btn-mobile-inspect');

const staticMinimapCanvas = document.createElement('canvas');
staticMinimapCanvas.width = 160;
staticMinimapCanvas.height = 160;
const staticMinimapCtx = staticMinimapCanvas.getContext('2d');

function bakeStaticMinimap(grid: { x: number; y: number; type: string }[][]) {
    if (!staticMinimapCtx) return;
    staticMinimapCtx.clearRect(0, 0, 160, 160);
    const cellSize = 160 / GRID_SIZE;

    staticMinimapCtx.fillStyle = '#666';
    grid.forEach((row) => {
        row.forEach((cell) => {
            if (cell.type === 'wall') {
                staticMinimapCtx.fillRect(cell.x * cellSize, cell.y * cellSize, cellSize, cellSize);
            }
        });
    });

    staticMinimapCtx.fillStyle = '#c5a46d';
    allArtPositions.forEach((spot) => {
        staticMinimapCtx.fillRect(
            spot.artX * cellSize + cellSize * 0.25,
            spot.artZ * cellSize + cellSize * 0.25,
            cellSize * 0.5,
            cellSize * 0.5
        );
    });
}

let isPopupOpen = false;
let greetingTimeout: ReturnType<typeof setTimeout>;

const textureLoader = new THREE.TextureLoader();
textureLoader.crossOrigin = 'anonymous';

function enterReception() {
    appMode = 'reception';
    isTransitioningGallery = false;
    renderer.shadowMap.enabled = true;

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

// Preload character model and artwork database
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
                                const frameGeo = new THREE.PlaneGeometry(w + 0.12, h + 0.12);
                                const frameMat = new THREE.MeshStandardMaterial({
                                    color: 0x3b2a25,
                                    emissive: 0x000000,
                                    emissiveIntensity: 0,
                                    roughness: 0.25,
                                    metalness: 0.3,
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
                                    frameMesh,
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
exitReceptionBtn?.addEventListener('click', () => resetToMenu());

const GALLERY_LABELS: Record<GalleryType, string> = {
    classical: 'Entering Classical Wing...',
    modern: 'Entering Modern Wing...',
    maze: 'Entering Labyrinth Maze...',
};

// Seamless Reception-to-Gallery Doorways + Loader Transition
function initMuseum(layoutType: GalleryType) {
    if (isTransitioningGallery) return;
    isTransitioningGallery = true;

    if (startScreen) startScreen.style.display = 'none';

    const finalizeEntry = () => {
        if (loaderGalleryName) {
            loaderGalleryName.innerText = GALLERY_LABELS[layoutType] || 'Entering Gallery...';
        }
        if (galleryLoader) {
            galleryLoader.classList.remove('hidden');
            galleryLoader.style.display = 'flex';
        }

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                if (receptionHandle) {
                    receptionHandle.cleanup();
                    receptionHandle = null;
                }

                // Disable shadow maps inside gallery so standard materials compile lighter shaders
                renderer.shadowMap.enabled = false;

                appMode = 'museum';
                if (appContainer) appContainer.style.display = 'block';
                if (minimapCanvas) minimapCanvas.style.display = 'block';
                if (uiLayer) uiLayer.style.display = 'block';

                buildMuseumLayout(layoutType);

                setTimeout(() => {
                    if (galleryLoader) {
                        galleryLoader.classList.add('hidden');
                        galleryLoader.style.display = 'none';
                    }
                    isTransitioningGallery = false;
                }, 400);
            });
        });
    };

    if (receptionHandle) {
        receptionHandle.playDoorTransition(finalizeEntry);
    } else {
        finalizeEntry();
    }
}

function resetToMenu() {
    if (appMode === 'reception') return;

    clearHoveredArt();

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
    galleryLights = [];
    interactableArt = [];
    floorCells = [];
    allArtPositions = [];
    activeNPCs = [];

    enterReception();
}

// Shared Geometries for Furniture
const benchSeatGeo = new THREE.BoxGeometry(1.35, 0.08, 0.48);
const benchTrimGeo = new THREE.BoxGeometry(1.38, 0.02, 0.5);
const benchLegGeo = new THREE.BoxGeometry(0.05, 0.4, 0.05);
const stanchionBaseGeo = new THREE.CylinderGeometry(0.11, 0.13, 0.03, 16);
const stanchionPostGeo = new THREE.CylinderGeometry(0.018, 0.022, 0.72, 12);
const stanchionFinialGeo = new THREE.SphereGeometry(0.036, 12, 12);
const ropeCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.55, 0.68, 0),
    new THREE.Vector3(0, 0.56, 0),
    new THREE.Vector3(0.55, 0.68, 0),
]);
const stanchionRopeGeo = new THREE.TubeGeometry(ropeCurve, 14, 0.016, 6, false);

function createMuseumBench(woodMat: THREE.Material, goldMat: THREE.Material): THREE.Group {
    const bench = new THREE.Group();

    const seat = new THREE.Mesh(benchSeatGeo, woodMat);
    seat.position.y = 0.44;
    bench.add(seat);

    const trim = new THREE.Mesh(benchTrimGeo, goldMat);
    trim.position.y = 0.41;
    bench.add(trim);

    [
        [-0.55, -0.18],
        [0.55, -0.18],
        [-0.55, 0.18],
        [0.55, 0.18],
    ].forEach(([lx, lz]) => {
        const leg = new THREE.Mesh(benchLegGeo, goldMat);
        leg.position.set(lx, 0.2, lz);
        bench.add(leg);
    });

    return bench;
}

function createBrassStanchions(goldMat: THREE.Material, velvetMat: THREE.Material): THREE.Group {
    const group = new THREE.Group();

    [-0.55, 0.55].forEach((sx) => {
        const base = new THREE.Mesh(stanchionBaseGeo, goldMat);
        base.position.set(sx, 0.015, 0);
        group.add(base);

        const post = new THREE.Mesh(stanchionPostGeo, goldMat);
        post.position.set(sx, 0.37, 0);
        group.add(post);

        const finial = new THREE.Mesh(stanchionFinialGeo, goldMat);
        finial.position.set(sx, 0.75, 0);
        group.add(finial);
    });

    const rope = new THREE.Mesh(stanchionRopeGeo, velvetMat);
    group.add(rope);

    return group;
}

// 4. Build Museum Layout (Instanced Floors, Ceilings, Walls, Trim, & Fixtures)
function buildMuseumLayout(layoutType: GalleryType) {
    pfGrid = new PF.Grid(GRID_SIZE, GRID_SIZE);
    const { grid, start: entrance } = loadMuseumGrid(layoutType);

    const floorGeo = new THREE.PlaneGeometry(1, 1);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6 });

    const ceilingGeo = new THREE.PlaneGeometry(1, 1);
    const ceilingMat = new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.9 });

    const trimDarkMat = new THREE.MeshStandardMaterial({
        color: 0x2d211d,
        roughness: 0.45,
        metalness: 0.1,
    });
    const trimGoldMat = new THREE.MeshStandardMaterial({
        color: 0xc5a46d,
        roughness: 0.28,
        metalness: 0.82,
    });
    const velvetRopeMat = new THREE.MeshStandardMaterial({
        color: 0x6b222e,
        roughness: 0.75,
    });

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

    const outerWallMat = new THREE.MeshStandardMaterial({
        color: outerWallColor,
        roughness: 0.85,
        metalness: 0.05,
    });
    const innerWallMat = new THREE.MeshStandardMaterial({
        color: innerWallColor,
        roughness: 0.85,
        metalness: 0.05,
    });

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
    const trimTransforms: { x: number; z: number; rotY: number }[] = [];
    const outerWallCoords: { x: number; z: number }[] = [];
    const innerWallCoords: { x: number; z: number }[] = [];

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

    const totalCells = GRID_SIZE * GRID_SIZE;
    const floorInstanced = new THREE.InstancedMesh(floorGeo, floorMat, totalCells);
    const ceilingInstanced = new THREE.InstancedMesh(ceilingGeo, ceilingMat, totalCells);
    const dummy = new THREE.Object3D();
    let tileIdx = 0;

    grid.forEach((row) => {
        row.forEach((cell) => {
            dummy.position.set(cell.x, 0, cell.y);
            dummy.rotation.set(-Math.PI / 2, 0, 0);
            dummy.updateMatrix();
            floorInstanced.setMatrixAt(tileIdx, dummy.matrix);

            dummy.position.set(cell.x, wallHeight, cell.y);
            dummy.rotation.set(Math.PI / 2, 0, 0);
            dummy.updateMatrix();
            ceilingInstanced.setMatrixAt(tileIdx, dummy.matrix);
            tileIdx++;

            if (cell.type === 'wall') {
                const isOuterWall =
                    cell.x === minX || cell.x === maxX || cell.y === minZ || cell.y === maxZ;

                if (isOuterWall) {
                    outerWallCoords.push({ x: cell.x, z: cell.y });
                } else {
                    innerWallCoords.push({ x: cell.x, z: cell.y });
                }
                pfGrid.setWalkableAt(cell.x, cell.y, false);

                const checkAndCollectFace = (offsetX: number, offsetZ: number, rotationY: number) => {
                    const nx = cell.x + offsetX;
                    const nz = cell.y + offsetZ;
                    const neighbor = grid[nz]?.[nx];

                    if (!neighbor || (neighbor.type !== 'floor' && neighbor.type !== 'art')) return;

                    trimTransforms.push({
                        x: cell.x + offsetX * 0.512,
                        z: cell.y + offsetZ * 0.512,
                        rotY: rotationY,
                    });

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

    floorInstanced.instanceMatrix.needsUpdate = true;
    ceilingInstanced.instanceMatrix.needsUpdate = true;
    scene.add(floorInstanced);
    scene.add(ceilingInstanced);
    sceneObjects.push(floorInstanced, ceilingInstanced);

    // Batch Outer & Inner Walls into 2 InstancedMeshes (2 draw calls instead of 250+)
    if (outerWallCoords.length > 0) {
        const outerWallInstanced = new THREE.InstancedMesh(
            wallGeo,
            outerWallMat,
            outerWallCoords.length
        );
        outerWallCoords.forEach((wc, idx) => {
            dummy.position.set(wc.x, wallHeight / 2, wc.z);
            dummy.rotation.set(0, 0, 0);
            dummy.updateMatrix();
            outerWallInstanced.setMatrixAt(idx, dummy.matrix);
        });
        outerWallInstanced.instanceMatrix.needsUpdate = true;
        scene.add(outerWallInstanced);
        sceneObjects.push(outerWallInstanced);
    }

    if (innerWallCoords.length > 0) {
        const innerWallInstanced = new THREE.InstancedMesh(
            wallGeo,
            innerWallMat,
            innerWallCoords.length
        );
        innerWallCoords.forEach((wc, idx) => {
            dummy.position.set(wc.x, wallHeight / 2, wc.z);
            dummy.rotation.set(0, 0, 0);
            dummy.updateMatrix();
            innerWallInstanced.setMatrixAt(idx, dummy.matrix);
        });
        innerWallInstanced.instanceMatrix.needsUpdate = true;
        scene.add(innerWallInstanced);
        sceneObjects.push(innerWallInstanced);
    }

    if (trimTransforms.length > 0) {
        const baseboardGeo = new THREE.BoxGeometry(1.0, 0.14, 0.03);
        const crownGeo = new THREE.BoxGeometry(1.0, 0.08, 0.03);

        const baseboardInstanced = new THREE.InstancedMesh(
            baseboardGeo,
            trimDarkMat,
            trimTransforms.length
        );
        const crownInstanced = new THREE.InstancedMesh(
            crownGeo,
            trimGoldMat,
            trimTransforms.length
        );

        trimTransforms.forEach((t, idx) => {
            dummy.position.set(t.x, 0.07, t.z);
            dummy.rotation.set(0, t.rotY, 0);
            dummy.updateMatrix();
            baseboardInstanced.setMatrixAt(idx, dummy.matrix);

            dummy.position.set(t.x, wallHeight - 0.04, t.z);
            dummy.rotation.set(0, t.rotY, 0);
            dummy.updateMatrix();
            crownInstanced.setMatrixAt(idx, dummy.matrix);
        });

        baseboardInstanced.instanceMatrix.needsUpdate = true;
        crownInstanced.instanceMatrix.needsUpdate = true;
        scene.add(baseboardInstanced);
        scene.add(crownInstanced);
        sceneObjects.push(baseboardInstanced, crownInstanced);
    }

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

    const fixtureGeo = new THREE.CylinderGeometry(0.08, 0.12, 0.2, 8);
    const fixtureMat = new THREE.MeshStandardMaterial({
        color: 0x111111,
        metalness: 0.8,
        roughness: 0.2,
    });
    const fixturePositions: { x: number; z: number }[] = [];

    let artworkCounter = 0;

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
                            color: 0x3b2a25,
                            emissive: 0x000000,
                            emissiveIntensity: 0,
                            roughness: 0.25,
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
                            frameMesh,
                        };
                        interactableArt.push(blankMesh);
                        framedGroup.add(frameMesh);
                        framedGroup.add(blankMesh);
                    }

                    framedGroup.position.set(posX, 1.6, posZ);
                    framedGroup.rotation.y = rotY;

                    scene.add(framedGroup);
                    sceneObjects.push(framedGroup);

                    // Original Gallery Artwork SpotLight + Track Fixture
                    fixturePositions.push({ x: posX + dirX * 0.4, z: posZ + dirZ * 0.4 });

                    const artSpotlight = new THREE.SpotLight(0xfff0d1, 4.0, 8, Math.PI / 3, 0.5, 1);
                    artSpotlight.position.set(posX + dirX * 0.4, 3.45, posZ + dirZ * 0.4);
                    scene.add(artSpotlight);
                    scene.add(artSpotlight.target);
                    artSpotlight.target.position.set(posX, 1.6, posZ);
                    sceneObjects.push(artSpotlight, artSpotlight.target);
                    galleryLights.push(artSpotlight);

                    const nearX = Math.round(posX + dirX * 0.5);
                    const nearZ = Math.round(posZ + dirZ * 0.5);
                    const farX = nearX + dirX;
                    const farZ = nearZ + dirZ;

                    const hasOpenFront =
                        farX >= 0 &&
                        farX < GRID_SIZE &&
                        farZ >= 0 &&
                        farZ < GRID_SIZE &&
                        pfGrid.isWalkableAt(nearX, nearZ) &&
                        pfGrid.isWalkableAt(farX, farZ);

                    if (artworkCounter % 3 === 0 && hasOpenFront) {
                        const stanchions = createBrassStanchions(trimGoldMat, velvetRopeMat);
                        stanchions.position.set(posX + dirX * 0.28, 0, posZ + dirZ * 0.28);
                        stanchions.rotation.y = rotY;
                        scene.add(stanchions);
                        sceneObjects.push(stanchions);
                    }
                    artworkCounter++;

                    let standX = nearX;
                    let standZ = nearZ;
                    let viewX = nearX;
                    let viewZ = nearZ;

                    if (!pfGrid.isWalkableAt(standX, standZ)) {
                        const fallbackCell = floorCells.reduce((closest, cell) => {
                            const d1 = Math.hypot(
                                cell.x - (posX + dirX * 0.5),
                                cell.y - (posZ + dirZ * 0.5)
                            );
                            const d2 = Math.hypot(
                                closest.x - (posX + dirX * 0.5),
                                closest.y - (posZ + dirZ * 0.5)
                            );
                            return d1 < d2 ? cell : closest;
                        }, floorCells[0]);
                        standX = fallbackCell.x;
                        standZ = fallbackCell.y;
                        viewX = standX;
                        viewZ = standZ;
                    }

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

    if (fixturePositions.length > 0) {
        const fixturesInstanced = new THREE.InstancedMesh(
            fixtureGeo,
            fixtureMat,
            fixturePositions.length
        );
        fixturePositions.forEach((fp, idx) => {
            dummy.position.set(fp.x, 3.45, fp.z);
            dummy.rotation.set(0, 0, 0);
            dummy.updateMatrix();
            fixturesInstanced.setMatrixAt(idx, dummy.matrix);
        });
        fixturesInstanced.instanceMatrix.needsUpdate = true;
        scene.add(fixturesInstanced);
        sceneObjects.push(fixturesInstanced);
    }

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

    // Place Dark-Wood Museum Benches in Wide Open Rooms
    const placedBenches: { x: number; z: number }[] = [];
    floorCells.forEach((fc) => {
        if (Math.hypot(fc.x - entrance.x, fc.y - entrance.y) < 3.0) return;

        let isWideRoomCenter = true;
        for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
                const nx = fc.x + dx;
                const nz = fc.y + dz;
                if (
                    nx < 0 ||
                    nx >= GRID_SIZE ||
                    nz < 0 ||
                    nz >= GRID_SIZE ||
                    !pfGrid.isWalkableAt(nx, nz)
                ) {
                    isWideRoomCenter = false;
                }
            }
        }

        if (!isWideRoomCenter) return;

        const nearArt = allArtPositions.some((a) => Math.hypot(a.standX - fc.x, a.standZ - fc.y) < 2.2);
        const nearOtherBench = placedBenches.some((b) => Math.hypot(b.x - fc.x, b.z - fc.y) < 4.5);

        if (!nearArt && !nearOtherBench) {
            const bench = createMuseumBench(trimDarkMat, trimGoldMat);
            bench.position.set(fc.x, 0, fc.y);
            scene.add(bench);
            sceneObjects.push(bench);
            placedBenches.push({ x: fc.x, z: fc.y });
        }
    });

    // Original Gallery Overhead PointLights (Proximity-Culled at Runtime)
    floorCells.forEach((fc, idx) => {
        if (idx % 3 === 0) {
            const overheadLight = new THREE.PointLight(0xfff4e0, 1.0, 6, 2);
            overheadLight.position.set(fc.x, 3.4, fc.y);
            scene.add(overheadLight);
            sceneObjects.push(overheadLight);
            galleryLights.push(overheadLight);
        }
    });

    bakeStaticMinimap(grid);

    camera.rotation.order = 'YXZ';
    camera.position.set(entrance.x, 1.5, entrance.y);
    camera.lookAt(entrance.x, 1.5, entrance.y - 1);

    lastLightUpdatePos.set(Infinity, Infinity, Infinity);
    updateNearbyLights();

    // Spawn NPC on a walkable floor tile away from entrance
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

// 6. Hover Highlight, Artwork Inspection Modal & Zoom/Pan
function clearHoveredArt() {
    if (hoveredArtMesh) {
        const frameMesh = hoveredArtMesh.userData.frameMesh as THREE.Mesh | undefined;
        if (frameMesh && frameMesh.material instanceof THREE.MeshStandardMaterial) {
            frameMesh.material.emissive.setHex(0x000000);
            frameMesh.material.emissiveIntensity = 0;
        }
        hoveredArtMesh = null;
    }
    hoverPromptEl?.classList.add('hidden');
    crosshairEl?.classList.remove('is-hovering');
    mobileInspectBtn?.classList.add('hidden');
}

function openArtModal(artMesh: THREE.Object3D) {
    if (!artInfoPopup) return;

    const titleEl = document.getElementById('art-title');
    const artistEl = document.getElementById('art-artist');
    const descEl = document.getElementById('art-desc');
    const imgEl = document.getElementById('art-detail-image') as HTMLImageElement | null;

    if (titleEl) titleEl.innerText = artMesh.userData.title;
    if (artistEl) artistEl.innerText = artMesh.userData.artist;
    if (descEl) descEl.innerText = artMesh.userData.desc;

    if (imgEl) {
        currentZoom = 1;
        baseImgWidth = 0;
        baseImgHeight = 0;
        imgEl.classList.remove('is-zoomed');
        imgEl.style.width = '';
        imgEl.style.height = '';
        imgEl.src = artMesh.userData.imageSrc;
    }

    artInfoPopup.style.display = 'block';
    isPopupOpen = true;
}

function closeArtModal() {
    if (artInfoPopup) artInfoPopup.style.display = 'none';
    isPopupOpen = false;
}

document.getElementById('btn-close-art')?.addEventListener('click', (e) => {
    e.stopPropagation();
    closeArtModal();
});

// 7. Controls: Keyboard & Mobile Touch Joystick
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
    if (e.key === 'Escape') {
        if (isPopupOpen) {
            closeArtModal();
            return;
        }
        resetToMenu();
        return;
    }

    const k = e.key.toLowerCase();
    if (k in keys) {
        keys[k] = true;
    }
});

window.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    if (k in keys) keys[k] = false;
});

// Touch Controls State (Mobile & Tablet)
const maxPitch = Math.PI / 2.4;
let touchMoveX = 0;
let touchMoveZ = 0;

const joystickZone = document.getElementById('touch-joystick-zone');
const joystickKnob = document.getElementById('touch-joystick-knob');
const touchLookZone = document.getElementById('touch-look-zone');

if (joystickZone && joystickKnob) {
    let joyTouchId: number | null = null;
    const maxRadius = 38;

    const updateJoystick = (clientX: number, clientY: number) => {
        const rect = joystickZone.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        let dx = clientX - centerX;
        let dy = clientY - centerY;
        const dist = Math.hypot(dx, dy);

        if (dist > maxRadius) {
            dx = (dx / dist) * maxRadius;
            dy = (dy / dist) * maxRadius;
        }

        joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
        touchMoveX = dx / maxRadius;
        touchMoveZ = -dy / maxRadius;
    };

    joystickZone.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const t = e.changedTouches[0];
        joyTouchId = t.identifier;
        updateJoystick(t.clientX, t.clientY);
    });

    joystickZone.addEventListener('touchmove', (e) => {
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
            const t = e.changedTouches[i];
            if (t.identifier === joyTouchId) {
                updateJoystick(t.clientX, t.clientY);
            }
        }
    });

    const resetJoystick = (e: TouchEvent) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === joyTouchId) {
                joyTouchId = null;
                touchMoveX = 0;
                touchMoveZ = 0;
                joystickKnob.style.transform = 'translate(0px, 0px)';
            }
        }
    };

    joystickZone.addEventListener('touchend', resetJoystick);
    joystickZone.addEventListener('touchcancel', resetJoystick);
}

if (touchLookZone) {
    let lookTouchId: number | null = null;
    let lastTouchX = 0;
    let lastTouchY = 0;
    let touchMoved = false;

    touchLookZone.addEventListener('touchstart', (e) => {
        if (isPopupOpen) return;
        const t = e.changedTouches[0];
        lookTouchId = t.identifier;
        lastTouchX = t.clientX;
        lastTouchY = t.clientY;
        touchMoved = false;
    });

    touchLookZone.addEventListener('touchmove', (e) => {
        if (isPopupOpen) return;
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
            const t = e.changedTouches[i];
            if (t.identifier === lookTouchId) {
                const dx = t.clientX - lastTouchX;
                const dy = t.clientY - lastTouchY;
                if (Math.hypot(dx, dy) > 4) {
                    touchMoved = true;
                }
                const touchSensitivity = 0.0072;
                camera.rotation.y -= dx * touchSensitivity;
                camera.rotation.x = Math.max(
                    -maxPitch,
                    Math.min(maxPitch, camera.rotation.x - dy * touchSensitivity)
                );
                lastTouchX = t.clientX;
                lastTouchY = t.clientY;
            }
        }
    });

    touchLookZone.addEventListener('touchend', (e) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === lookTouchId) {
                lookTouchId = null;
                if (!touchMoved && hoveredArtMesh) {
                    openArtModal(hoveredArtMesh);
                }
            }
        }
    });
}

mobileInspectBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (hoveredArtMesh) {
        openArtModal(hoveredArtMesh);
    }
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

    const targetEl = e.target as HTMLElement;
    if (
        targetEl.closest('#gallery-toolbar') ||
        targetEl.closest('#mobile-controls') ||
        targetEl.closest('#minimap')
    ) {
        return;
    }

    if (isPopupOpen) {
        const popup = document.getElementById('art-info');
        if (popup && popup.contains(e.target as Node)) {
            return;
        }

        closeArtModal();
        return;
    }

    // Check either crosshair aim OR direct click position on a painting within 3.5 units
    interactionRaycaster.setFromCamera(screenCenter, camera);
    let intersects = interactionRaycaster.intersectObjects(interactableArt);

    if (intersects.length === 0 || intersects[0].distance >= 3.5) {
        const pointerNdc = new THREE.Vector2(
            (e.clientX / window.innerWidth) * 2 - 1,
            -(e.clientY / window.innerHeight) * 2 + 1
        );
        interactionRaycaster.setFromCamera(pointerNdc, camera);
        intersects = interactionRaycaster.intersectObjects(interactableArt);
    }

    if (intersects.length > 0 && intersects[0].distance < 3.5) {
        openArtModal(intersects[0].object);
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
        },
        { passive: false }
    );

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

// Frame-rate independent speeds (units per second / radians per second)
const playerMoveSpeedPerSec = 5.2;
const playerTurnSpeedPerSec = 2.6;

const forwardVector = new THREE.Vector3();
const rightVector = new THREE.Vector3();
const npcCollisionRadius = 0.75;
const npcWallClearance = 0.38;

// O(1) Grid-Based Wall Collision Check (replaces heavy per-frame raycasting)
function isPositionWalkable(x: number, z: number, radius = 0.36): boolean {
    const minGx = Math.floor(x - radius + 0.5);
    const maxGx = Math.floor(x + radius + 0.5);
    const minGz = Math.floor(z - radius + 0.5);
    const maxGz = Math.floor(z + radius + 0.5);

    for (let gx = minGx; gx <= maxGx; gx++) {
        for (let gz = minGz; gz <= maxGz; gz++) {
            if (gx < 0 || gx >= GRID_SIZE || gz < 0 || gz >= GRID_SIZE) return false;
            if (!pfGrid.isWalkableAt(gx, gz)) return false;
        }
    }
    return true;
}

function isBlockedByNPC(nextX: number, nextZ: number): boolean {
    for (let i = 0; i < activeNPCs.length; i++) {
        const npcPos = activeNPCs[i].group.position;
        const currentDist = Math.hypot(camera.position.x - npcPos.x, camera.position.z - npcPos.z);
        const nextDist = Math.hypot(nextX - npcPos.x, nextZ - npcPos.z);
        if (nextDist < npcCollisionRadius && nextDist < currentDist) {
            return true;
        }
    }
    return false;
}

// Moves player with smooth wall-sliding on X/Z axes
function tryMovePlayer(dx: number, dz: number): boolean {
    let moved = false;

    const targetX = camera.position.x + dx;
    if (dx !== 0 && isPositionWalkable(targetX, camera.position.z) && !isBlockedByNPC(targetX, camera.position.z)) {
        camera.position.x = targetX;
        moved = true;
    }

    const targetZ = camera.position.z + dz;
    if (dz !== 0 && isPositionWalkable(camera.position.x, targetZ) && !isBlockedByNPC(camera.position.x, targetZ)) {
        camera.position.z = targetZ;
        moved = true;
    }

    return moved;
}

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

function hasGridLineOfSight(x0: number, z0: number, x1: number, z1: number): boolean {
    const steps = Math.ceil(Math.hypot(x1 - x0, z1 - z0) * 3);
    for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const gx = Math.round(x0 + (x1 - x0) * t);
        const gz = Math.round(z0 + (z1 - z0) * t);
        if (gx < 0 || gx >= GRID_SIZE || gz < 0 || gz >= GRID_SIZE) return false;
        if (!pfGrid.isWalkableAt(gx, gz)) return false;
    }
    return true;
}

function drawMinimap() {
    if (!minimapCtx || !minimapCanvas || minimapCanvas.style.display === 'none') return;

    minimapCtx.clearRect(0, 0, minimapCanvas.width, minimapCanvas.height);
    minimapCtx.drawImage(staticMinimapCanvas, 0, 0, minimapCanvas.width, minimapCanvas.height);

    const cellSize = minimapCanvas.width / GRID_SIZE;

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

// 8. Animation Loop (Reusable Scratch Vectors & Throttled Hover Raycast)
const npcForwardVec = new THREE.Vector3();
const toPlayerVec = new THREE.Vector3();
const npcTargetPos = new THREE.Vector3();
const npcMoveDir = new THREE.Vector3();
const npcNextPos = new THREE.Vector3();

let walkBobTimer = 0;
const baseEyeHeight = 1.5;
let frameCount = 0;

function animate() {
    requestAnimationFrame(animate);
    frameCount++;
    const now = Date.now();
    const delta = Math.min(clock.getDelta(), 0.1);

    if (appMode === 'reception') {
        receptionHandle?.update(delta);
        renderer.render(scene, camera);
        return;
    }

    camera.getWorldDirection(forwardVector);
    forwardVector.y = 0;
    forwardVector.normalize();
    rightVector.crossVectors(forwardVector, camera.up).normalize();

    // Update Hover Highlight & Floating "Click to Inspect" Prompt (every 3rd frame)
    if (!isPopupOpen && interactableArt.length > 0) {
        if (frameCount % 3 === 0) {
            interactionRaycaster.setFromCamera(screenCenter, camera);
            const hits = interactionRaycaster.intersectObjects(interactableArt);
            if (hits.length > 0 && hits[0].distance < 3.0) {
                const hitMesh = hits[0].object as THREE.Mesh;
                if (hoveredArtMesh !== hitMesh) {
                    clearHoveredArt();
                    hoveredArtMesh = hitMesh;
                    const frameMesh = hitMesh.userData.frameMesh as THREE.Mesh | undefined;
                    if (frameMesh && frameMesh.material instanceof THREE.MeshStandardMaterial) {
                        frameMesh.material.emissive.setHex(0xc5a46d);
                        frameMesh.material.emissiveIntensity = 0.55;
                    }
                }
                if (hoverPromptEl) {
                    hoverPromptEl.innerText = `Click to Inspect: "${hitMesh.userData.title}"`;
                    hoverPromptEl.classList.remove('hidden');
                }
                crosshairEl?.classList.add('is-hovering');
                mobileInspectBtn?.classList.remove('hidden');
            } else if (hoveredArtMesh) {
                clearHoveredArt();
            }
        }
    } else if (hoveredArtMesh) {
        clearHoveredArt();
    }

    // Manual Walk + Head-Bob
    if (!isPopupOpen) {
        const frameTurn = playerTurnSpeedPerSec * delta;
        const frameMove = playerMoveSpeedPerSec * delta;

        if (keys.arrowleft) camera.rotation.y += frameTurn;
        if (keys.arrowright) camera.rotation.y -= frameTurn;

        let forwardInput = 0;
        let rightInput = 0;

        if (keys.w || keys.arrowup) forwardInput += 1;
        if (keys.s || keys.arrowdown) forwardInput -= 1;
        if (keys.d) rightInput += 1;
        if (keys.a) rightInput -= 1;

        if (Math.abs(touchMoveZ) > 0.12) forwardInput += touchMoveZ;
        if (Math.abs(touchMoveX) > 0.12) rightInput += touchMoveX;

        const inputMag = Math.hypot(forwardInput, rightInput);
        let isWalking = false;

        if (inputMag > 0.01) {
            const scale = inputMag > 1 ? 1 / inputMag : 1;
            const moveForwardAmt = forwardInput * scale * frameMove;
            const moveRightAmt = rightInput * scale * frameMove;

            const dx = forwardVector.x * moveForwardAmt + rightVector.x * moveRightAmt;
            const dz = forwardVector.z * moveForwardAmt + rightVector.z * moveRightAmt;

            isWalking = tryMovePlayer(dx, dz);
        }

        // Subtle First-Person Head-Bob while Walking
        if (isWalking) {
            walkBobTimer += delta * 11.0;
            camera.position.y = baseEyeHeight + Math.sin(walkBobTimer) * 0.032;
        } else {
            walkBobTimer = 0;
            camera.position.y += (baseEyeHeight - camera.position.y) * 0.18;
        }
    }

    updateNearbyLights();

    // NPC Update Loop
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

        const hasLineOfSight =
            distToPlayer < 1.8 &&
            isPlayerInFrontOrSide &&
            hasGridLineOfSight(
                npc.group.position.x,
                npc.group.position.z,
                camera.position.x,
                camera.position.z
            );

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
                npcTargetPos.set(rawTargetX, 0, rawTargetZ);
                enforceWallClearance(npcTargetPos);

                npcMoveDir.subVectors(npcTargetPos, currentPos);
                npcMoveDir.y = 0;

                const dist = npcMoveDir.length();
                const step = walkSpeed * delta;

                if (dist > step && dist > 0.06) {
                    npcMoveDir.normalize();

                    npcNextPos.set(
                        currentPos.x + npcMoveDir.x * step,
                        0,
                        currentPos.z + npcMoveDir.z * step
                    );
                    enforceWallClearance(npcNextPos);

                    const actualMoved = Math.hypot(
                        npcNextPos.x - currentPos.x,
                        npcNextPos.z - currentPos.z
                    );

                    if (actualMoved < step * 0.15) {
                        npc.pathIndex++;
                        return;
                    }

                    const nextDistToUser = Math.hypot(
                        npcNextPos.x - camera.position.x,
                        npcNextPos.z - camera.position.z
                    );

                    if (!isPositionWalkable(npcNextPos.x, npcNextPos.z, npcWallClearance)) {
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

                    currentPos.copy(npcNextPos);
                    npc.group.lookAt(npcTargetPos.x, 0, npcTargetPos.z);
                    currentPos.y = 0;
                } else {
                    currentPos.copy(npcTargetPos);
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
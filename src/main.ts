import './style.css';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as PF from 'pathfinding';
import { loadMuseumGrid, GRID_SIZE } from './grid'; 
import type { GalleryType } from './grid';

// ==========================================
// 🎨 AUTOMATED FOLDER SCANNING
// ==========================================
const artModules = import.meta.glob<{ default: string }>('./textures/*.{jpg,jpeg,png,webp}', { eager: true });

// 1. Scene, Camera, & Renderer Setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a1a); 
scene.fog = new THREE.Fog(0x1a1a1a, 10, 50);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('app')?.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
directionalLight.position.set(10, 20, 10);
scene.add(directionalLight);

// 2. Global Variables for Layout, Animation, & State
let pfGrid = new PF.Grid(GRID_SIZE, GRID_SIZE); 
let floorCells: { x: number; y: number }[] = [];
let wallObjects: THREE.Mesh[] = []; 
let sceneObjects: THREE.Object3D[] = []; 
let interactableArt: THREE.Mesh[] = []; 
let allArtPositions: { x: number; y: number }[] = [];

const loadedArtObjects: { groupCreator: (index: number) => THREE.Group }[] = [];

interface NPCData {
    group: THREE.Group | THREE.Mesh;
    mixer?: THREE.AnimationMixer;
    idleAction?: THREE.AnimationAction;
    walkAction?: THREE.AnimationAction;
    currentPath: number[][];
    pathIndex: number;
    pauseUntil: number; 
    lastGreeted: number; 
    isLookingAtArt: boolean;
    hasAnimations: boolean;
}
let activeNPCs: NPCData[] = [];
const speed = 0.005; 
const clock = new THREE.Clock();

// 3. UI Elements
const startScreen = document.getElementById('start-screen');
const appContainer = document.getElementById('app');
const minimapCanvas = document.getElementById('minimap') as HTMLCanvasElement;
const minimapCtx = minimapCanvas?.getContext('2d');
const buttonGroup = document.querySelector('.button-group') as HTMLElement;
const uiLayer = document.getElementById('ui-layer');
const artInfoPopup = document.getElementById('art-info');
const greetingToast = document.getElementById('greeting-toast');
let isPopupOpen = false;
let greetingTimeout: ReturnType<typeof setTimeout>;

if (buttonGroup) buttonGroup.style.display = 'none';
const loadingText = document.createElement('h3');
loadingText.innerText = "Scanning Folder & Loading Artwork...";
startScreen?.appendChild(loadingText);

const textureLoader = new THREE.TextureLoader();
const imagePaths = Object.values(artModules).map(mod => mod.default);

if (imagePaths.length === 0) {
    loadingText.innerText = "No images found in src/textures/! Please add some pictures.";
} else {
    Promise.all(imagePaths.map((path, idx) => {
        return new Promise<void>((resolve) => {
            textureLoader.load(path, (texture) => {
                const aspect = texture.image.width / texture.image.height;
                let w = 0.8;
                let h = w / aspect;
                if (h > 1.2) { h = 1.2; w = h * aspect; }

                const geo = new THREE.PlaneGeometry(w, h);
                const mat = new THREE.MeshStandardMaterial({ map: texture }); 

                const groupCreator = (index: number) => {
                    const group = new THREE.Group();
                    const frameGeo = new THREE.PlaneGeometry(w + 0.1, h + 0.1);
                    const frameMat = new THREE.MeshStandardMaterial({ color: 0x2c2c2c, roughness: 0.2 });
                    const frameMesh = new THREE.Mesh(frameGeo, frameMat);
                    frameMesh.position.z = -0.002; 

                    const artMesh = new THREE.Mesh(geo, mat);
                    artMesh.position.z = 0.002; 
                    
                    artMesh.userData = { 
                        title: `Exhibition Piece #${index + 1}`,
                        imageSrc: path
                    };
                    
                    interactableArt.push(artMesh);

                    group.add(frameMesh);
                    group.add(artMesh);
                    return group;
                };

                loadedArtObjects.push({ groupCreator });
                resolve();
            }, undefined, () => resolve());
        });
    })).then(() => {
        loadingText.style.display = 'none';
        if (buttonGroup) buttonGroup.style.display = 'flex';
    });
}

document.getElementById('btn-classical')?.addEventListener('click', () => initMuseum('classical'));
document.getElementById('btn-modern')?.addEventListener('click', () => initMuseum('modern'));
document.getElementById('btn-maze')?.addEventListener('click', () => initMuseum('maze'));

function initMuseum(layoutType: GalleryType) {
    if (startScreen && appContainer && minimapCanvas && uiLayer) {
        startScreen.style.display = 'none';
        appContainer.style.display = 'block';
        minimapCanvas.style.display = 'block';
        uiLayer.style.display = 'block';
    }
    buildMuseumLayout(layoutType);
}

function resetToMenu() {
    if (appContainer) appContainer.style.display = 'none';
    if (minimapCanvas) minimapCanvas.style.display = 'none';
    if (uiLayer) uiLayer.style.display = 'none';
    if (startScreen) startScreen.style.display = 'flex';
    if (artInfoPopup) artInfoPopup.style.display = 'none';
    if (greetingToast) greetingToast.style.display = 'none';
    isPopupOpen = false;

    sceneObjects.forEach(obj => scene.remove(obj));
    activeNPCs.forEach(npc => scene.remove(npc.group));
    sceneObjects = [];
    wallObjects = [];
    interactableArt = [];
    floorCells = [];
    allArtPositions = [];
    activeNPCs = [];
}

// 4. Build the Museum
function buildMuseumLayout(layoutType: GalleryType) {
    pfGrid = new PF.Grid(GRID_SIZE, GRID_SIZE);
    const { grid, start: entrance } = loadMuseumGrid(layoutType);
    
    const floorGeo = new THREE.PlaneGeometry(1, 1);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x222222 }); 
    const wallGeo = new THREE.BoxGeometry(1, 2, 1); 

    const centerX = GRID_SIZE / 2;
    const centerY = GRID_SIZE / 2;
    let artCounter = 0;

    interface WallFace { x: number; z: number; dirX: number; dirZ: number; rotY: number; }
    const potentialFaces: WallFace[] = [];

    grid.forEach(row => {
        row.forEach(cell => {
            const floor = new THREE.Mesh(floorGeo, floorMat);
            floor.rotation.x = -Math.PI / 2;
            floor.position.set(cell.x, 0, cell.y); 
            scene.add(floor);
            sceneObjects.push(floor);

            if (cell.type === 'wall') {
                const dx = cell.x - centerX;
                const dy = cell.y - centerY;
                let wallColor = (Math.abs(dx) > Math.abs(dy)) ? (dx > 0 ? 0x2980b9 : 0xc0392b) : (dy > 0 ? 0x27ae60 : 0xf39c12); 

                const wall = new THREE.Mesh(wallGeo, new THREE.MeshStandardMaterial({ color: wallColor }));
                wall.position.set(cell.x, 1, cell.y); 
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
                    
                    potentialFaces.push({ x: cell.x, z: cell.y, dirX: offsetX, dirZ: offsetZ, rotY: rotationY });
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

    potentialFaces.forEach(face => {
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
        facesMap.forEach(faces => {
            faces.sort((a, b) => isHorizontal ? a.x - b.x : a.z - b.z);

            let currentSegment: WallFace[] = [faces[0]];
            const allSegments: WallFace[][] = [];

            for (let i = 1; i < faces.length; i++) {
                const prev = faces[i-1];
                const curr = faces[i];
                const isContinuous = isHorizontal ? (curr.x === prev.x + 1) : (curr.z === prev.z + 1);

                if (isContinuous) {
                    currentSegment.push(curr);
                } else {
                    allSegments.push(currentSegment);
                    currentSegment = [curr];
                }
            }
            allSegments.push(currentSegment);

            allSegments.forEach(seg => {
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

                    const posX = isHorizontal ? centerPos : fixedPos + (dirX * 0.501);
                    const posZ = isHorizontal ? fixedPos + (dirZ * 0.501) : centerPos;

                    if (loadedArtObjects.length > 0) {
                        const randomArt = loadedArtObjects[Math.floor(Math.random() * loadedArtObjects.length)];
                        
                        const framedGroup = randomArt.groupCreator(artCounter++);
                        framedGroup.position.set(posX, 1.2, posZ);
                        framedGroup.rotation.y = rotY;
                        
                        scene.add(framedGroup);
                        sceneObjects.push(framedGroup);
                        
                        const floorX = Math.round(posX + dirX * 0.5);
                        const floorZ = Math.round(posZ + dirZ * 0.5);
                        allArtPositions.push({ x: floorX, y: floorZ }); 
                    }
                }
            });
        });
    };

    processSegments(nsSegments, true);  
    processSegments(ewSegments, false); 

    camera.position.set(entrance.x, 1.5, entrance.y); 
    camera.lookAt(entrance.x, 1.5, entrance.y - 1); 

    const spawnLoc1 = floorCells[Math.floor(Math.random() * floorCells.length)] || entrance;
    const spawnLoc2 = floorCells[Math.floor(Math.random() * floorCells.length)] || entrance;
    
    spawnNPC(spawnLoc1.x, spawnLoc1.y);
    spawnNPC(spawnLoc2.x, spawnLoc2.y);
}

// 5. Clean Load Original human.glb
function spawnNPC(startX: number, startY: number) {
    const loader = new GLTFLoader();
    
    loader.load('/models/human.glb', (gltf) => {
        const npcGroup = gltf.scene;
        npcGroup.scale.set(1.0, 1.0, 1.0); 
        npcGroup.position.set(startX, -0.15, startY);

        npcGroup.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                child.frustumCulled = false;
            }
        });

        scene.add(npcGroup);
        
        let npcMixer: THREE.AnimationMixer | undefined;
        let idleAction: THREE.AnimationAction | undefined;
        let walkAction: THREE.AnimationAction | undefined;
        let hasAnimations = false;

        if (gltf.animations && gltf.animations.length > 0) {
            npcMixer = new THREE.AnimationMixer(npcGroup);
            hasAnimations = true;
            
            idleAction = npcMixer.clipAction(gltf.animations[0]);
            
            if (gltf.animations.length > 1) {
                walkAction = npcMixer.clipAction(gltf.animations[1]);
            } else {
                walkAction = idleAction; 
            }
            
            idleAction.play(); 
        }

        const newNPC: NPCData = {
            group: npcGroup, 
            mixer: npcMixer,
            idleAction: idleAction,
            walkAction: walkAction,
            currentPath: [],
            pathIndex: 0,
            pauseUntil: 0,
            lastGreeted: 0,
            isLookingAtArt: false,
            hasAnimations: hasAnimations
        };
        activeNPCs.push(newNPC);
        assignNewPath(newNPC);

    }, undefined, () => {
        const fallbackGeo = new THREE.CapsuleGeometry(0.3, 1.0, 4, 8);
        const fallbackMat = new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x002222 });
        const mesh = new THREE.Mesh(fallbackGeo, fallbackMat);
        const group = new THREE.Group();
        group.add(mesh);
        
        group.position.set(startX, 0.85, startY);
        scene.add(group);
        
        const newNPC: NPCData = {
            group: group,
            currentPath: [],
            pathIndex: 0,
            pauseUntil: 0,
            lastGreeted: 0,
            isLookingAtArt: false,
            hasAnimations: false
        };
        activeNPCs.push(newNPC);
        assignNewPath(newNPC);
    });
}

function assignNewPath(npcData: NPCData) {
    if (allArtPositions.length === 0 && floorCells.length === 0) return;
    const dests = allArtPositions.length > 0 ? allArtPositions : floorCells;
    const randDest = dests[Math.floor(Math.random() * dests.length)];
    
    const finder = new PF.AStarFinder();
    const gridClone = pfGrid.clone(); 
    
    const startGridX = Math.round(npcData.group.position.x);
    const startGridZ = Math.round(npcData.group.position.z);

    npcData.currentPath = finder.findPath(
        startGridX, 
        startGridZ, 
        randDest.x, 
        randDest.y, 
        gridClone
    );
    npcData.pathIndex = 0;
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

// 6. Controls, Collisions & Interactions
const keys: Record<string, boolean> = { 
    w: false, a: false, s: false, d: false,
    arrowup: false, arrowdown: false, arrowleft: false, arrowright: false 
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

window.addEventListener('pointerdown', (e) => {
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
            const imgEl = document.getElementById('art-detail-image') as HTMLImageElement;
            
            if (titleEl) titleEl.innerText = hitArt.userData.title;
            if (artistEl) artistEl.innerText = "Unknown Artist, 2026";
            if (descEl) descEl.innerText = "Information about this specific painting will be loaded here.";
            
            if (imgEl) {
                imgEl.src = hitArt.userData.imageSrc;
                currentZoom = 1;
                imgEl.style.height = `100%`;
            }
            
            artInfoPopup.style.display = 'block';
            isPopupOpen = true;
        }
    }
});

// IMAGE ZOOM & PAN LOGIC
const imgContainer = document.getElementById('art-image-container');
if (imgContainer) {
    imgContainer.addEventListener('wheel', (e) => {
        if (e.shiftKey || e.ctrlKey || e.metaKey) {
            e.preventDefault(); 
            
            const zoomSpeed = 0.25;
            if (e.deltaY < 0) {
                currentZoom += zoomSpeed; 
            } else {
                currentZoom -= zoomSpeed; 
            }
            
            currentZoom = Math.max(1, Math.min(currentZoom, 4));
            
            const imgEl = document.getElementById('art-detail-image');
            if (imgEl) {
                imgEl.style.height = `${currentZoom * 100}%`;
            }
        }
    }, { passive: false });
}

const playerSpeed = 0.08;
const forwardVector = new THREE.Vector3();
const rightVector = new THREE.Vector3();
const moveRaycaster = new THREE.Raycaster();
const collisionDistance = 0.8; 

function drawMinimap() {
    if (!minimapCtx || !minimapCanvas || minimapCanvas.style.display === 'none') return;
    
    minimapCtx.clearRect(0, 0, minimapCanvas.width, minimapCanvas.height);
    const cellSize = minimapCanvas.width / GRID_SIZE;

    wallObjects.forEach(wall => {
        minimapCtx.fillStyle = '#666';
        minimapCtx.fillRect(wall.position.x * cellSize, wall.position.z * cellSize, cellSize, cellSize);
    });

    activeNPCs.forEach(npc => {
        minimapCtx.fillStyle = '#00ffff';
        minimapCtx.beginPath();
        minimapCtx.arc(npc.group.position.x * cellSize + cellSize/2, npc.group.position.z * cellSize + cellSize/2, cellSize/3, 0, Math.PI * 2);
        minimapCtx.fill();
    });

    minimapCtx.fillStyle = '#ff4444';
    minimapCtx.beginPath();
    const px = camera.position.x * cellSize + cellSize/2;
    const pz = camera.position.z * cellSize + cellSize/2;
    minimapCtx.arc(px, pz, cellSize/3, 0, Math.PI * 2);
    minimapCtx.fill();
    
    minimapCtx.strokeStyle = '#ff4444';
    minimapCtx.lineWidth = 2;
    minimapCtx.beginPath();
    minimapCtx.moveTo(px, pz);
    minimapCtx.lineTo(px + (forwardVector.x * cellSize), pz + (forwardVector.z * cellSize));
    minimapCtx.stroke();
}

// 7. Animation Loop 
const npcRaycaster = new THREE.Raycaster();

function animate() {
    requestAnimationFrame(animate);
    const now = Date.now();
    const delta = clock.getDelta();
    
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
            return hits.length === 0 || hits[0].distance > collisionDistance;
        }

        const moveForward = keys.w || keys.arrowup;
        const moveBackward = keys.s || keys.arrowdown;

        if (moveForward && canMove(forwardVector)) camera.position.addScaledVector(forwardVector, playerSpeed); 
        if (moveBackward && canMove(forwardVector.clone().negate())) camera.position.addScaledVector(forwardVector, -playerSpeed); 
        if (keys.a && canMove(rightVector.clone().negate())) camera.position.addScaledVector(rightVector, -playerSpeed); 
        if (keys.d && canMove(rightVector)) camera.position.addScaledVector(rightVector, playerSpeed); 
    }

    activeNPCs.forEach((npc) => {
        if (npc.mixer) npc.mixer.update(delta);

        const distToPlayer = npc.group.position.distanceTo(camera.position);
        
        if (distToPlayer < 2.5 && now > npc.lastGreeted + 10000) {
            displayGreeting("Hello! Beautiful day for art, isn't it?");
            npc.pauseUntil = now + 3000;
            npc.lastGreeted = now;
            npc.group.lookAt(camera.position.x, npc.group.position.y, camera.position.z);
        }

        const isBlockedByPlayer = distToPlayer < 0.8;
        const isPaused = now < npc.pauseUntil || isBlockedByPlayer;

        if (isPaused) {
            if (npc.idleAction && !npc.idleAction.isRunning()) {
                npc.walkAction?.fadeOut(0.2);
                npc.idleAction.reset().fadeIn(0.2).play();
            }
        } else {
            if (npc.walkAction && !npc.walkAction.isRunning()) {
                npc.idleAction?.fadeOut(0.2);
                npc.walkAction.reset().fadeIn(0.2).play();
            }
        }

        if (!isPaused) {
            if (npc.currentPath.length > 0 && npc.pathIndex < npc.currentPath.length) {
                const targetX = npc.currentPath[npc.pathIndex][0];
                const targetZ = npc.currentPath[npc.pathIndex][1];
                
                const currentPos = npc.group.position;
                const targetPos = new THREE.Vector3(targetX, -0.15, targetZ);
                const moveDir = new THREE.Vector3().subVectors(targetPos, currentPos).normalize();

                npcRaycaster.set(new THREE.Vector3(currentPos.x, 1.0, currentPos.z), moveDir);
                const wallHits = npcRaycaster.intersectObjects(wallObjects);

                if (wallHits.length > 0 && wallHits[0].distance < 0.5) {
                    assignNewPath(npc);
                    return;
                }

                const dist = currentPos.distanceTo(targetPos);

                if (dist > 0.05) {
                    currentPos.x += moveDir.x * speed;
                    currentPos.z += moveDir.z * speed;
                    npc.group.lookAt(targetX, npc.group.position.y, targetZ);
                    currentPos.y = -0.15; 
                    
                    if (!npc.hasAnimations) npc.group.rotation.z = Math.sin(Date.now() * 0.01) * 0.05; 
                } else {
                    currentPos.y = -0.15; 
                    npc.group.rotation.z = 0;
                    npc.pathIndex++; 
                }
            } else if (npc.pathIndex >= npc.currentPath.length) {
                if (!npc.isLookingAtArt) {
                    npc.pauseUntil = now + (Math.random() * 3000 + 4000); 
                    npc.isLookingAtArt = true;
                } else {
                    assignNewPath(npc);
                    npc.isLookingAtArt = false;
                }
            }
        } else if (isBlockedByPlayer) {
            npc.group.lookAt(camera.position.x, npc.group.position.y, camera.position.z);
            npc.group.rotation.z = 0;
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
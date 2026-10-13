import './style.css';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as PF from 'pathfinding';
import { loadMuseumGrid, GRID_SIZE } from './grid'; 
import type { GalleryType } from './grid';

// ==========================================
// 🎨 AUTOMATED FOLDER SCANNING (Vite Glob Import)
// Automatically finds every image in src/textures/
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

let allArtPositions: { x: number; y: number }[] = [];
const loadedArtObjects: { geo: THREE.PlaneGeometry, mat: THREE.MeshStandardMaterial }[] = [];

let npc: THREE.Group | THREE.Mesh | undefined; 
let currentPath: number[][] = [];
let pathIndex = 0;
let pathLine: THREE.Line | undefined;
const speed = 0.025; 

// Animation Mixer variables for rigged models
let mixer: THREE.AnimationMixer | undefined;
const clock = new THREE.Clock();

// 3. UI Logic for Entry Screen & Minimap
const startScreen = document.getElementById('start-screen');
const appContainer = document.getElementById('app');
const minimapCanvas = document.getElementById('minimap') as HTMLCanvasElement;
const minimapCtx = minimapCanvas?.getContext('2d');
const buttonGroup = document.querySelector('.button-group') as HTMLElement;

if (buttonGroup) buttonGroup.style.display = 'none';
const loadingText = document.createElement('h3');
loadingText.innerText = "Scanning Folder & Loading Artwork...";
startScreen?.appendChild(loadingText);

// Automatically load all images discovered in the src/textures folder with dynamic sizing
const textureLoader = new THREE.TextureLoader();
const imagePaths = Object.values(artModules).map(mod => mod.default);

if (imagePaths.length === 0) {
    loadingText.innerText = "No images found in src/textures/! Please add some pictures.";
} else {
    Promise.all(imagePaths.map(path => {
        return new Promise<void>((resolve) => {
            textureLoader.load(path, (texture) => {
                const aspect = texture.image.width / texture.image.height;
                let w = 0.8;
                let h = w / aspect;

                if (h > 1.2) {
                    h = 1.2;
                    w = h * aspect;
                }

                const geo = new THREE.PlaneGeometry(w, h);
                const mat = new THREE.MeshStandardMaterial({ map: texture });
                loadedArtObjects.push({ geo, mat });
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
    if (startScreen && appContainer && minimapCanvas) {
        startScreen.style.display = 'none';
        appContainer.style.display = 'block';
        minimapCanvas.style.display = 'block';
    }
    buildMuseumLayout(layoutType);
}

// 4. Build the Museum and Flush Mount Art to Every Wall
function buildMuseumLayout(layoutType: GalleryType) {
    sceneObjects.forEach(obj => scene.remove(obj));
    sceneObjects = [];
    wallObjects = [];
    floorCells = [];
    allArtPositions = [];
    pfGrid = new PF.Grid(GRID_SIZE, GRID_SIZE);

    const { grid, start: entrance } = loadMuseumGrid(layoutType);
    
    const floorGeo = new THREE.PlaneGeometry(1, 1);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x222222 }); 
    const wallGeo = new THREE.BoxGeometry(1, 2, 1); 

    const centerX = GRID_SIZE / 2;
    const centerY = GRID_SIZE / 2;

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

                // Attach paintings flush against every exposed wall face
                const checkAndAddArt = (offsetX: number, offsetZ: number, rotationY: number) => {
                    const nx = cell.x + offsetX;
                    const nz = cell.y + offsetZ;
                    const neighbor = grid[nz]?.[nx];

                    if (neighbor && (neighbor.type === 'floor' || neighbor.type === 'art')) {
                        if (loadedArtObjects.length === 0) return;
                        const randomArt = loadedArtObjects[Math.floor(Math.random() * loadedArtObjects.length)];

                        const artMesh = new THREE.Mesh(randomArt.geo, randomArt.mat);
                        artMesh.position.set(cell.x + (offsetX * 0.501), 1.2, cell.y + (offsetZ * 0.501));
                        artMesh.rotation.y = rotationY;
                        
                        scene.add(artMesh);
                        sceneObjects.push(artMesh);
                        allArtPositions.push({ x: nx, y: nz }); 
                    }
                };

                checkAndAddArt(-1, 0, -Math.PI / 2); // West face
                checkAndAddArt(1, 0, Math.PI / 2);   // East face
                checkAndAddArt(0, -1, Math.PI);      // North face
                checkAndAddArt(0, 1, 0);             // South face
                
            } else if (cell.type === 'floor' || cell.type === 'art') {
                floorCells.push({ x: cell.x, y: cell.y }); 
            }
        });
    });

    camera.position.set(entrance.x, 1.5, entrance.y); 
    camera.lookAt(entrance.x, 1.5, entrance.y - 1); 

    spawnNPC(entrance.x, entrance.y);
}

// 5. Load Human NPC with Rig Animation Mixer Support & Fallback
function spawnNPC(startX: number, startY: number) {
    if (npc) scene.remove(npc);
    mixer = undefined;

    const loader = new GLTFLoader();
    loader.load('/models/human.glb', (gltf) => {
        npc = gltf.scene;
        npc.scale.set(1.0, 1.0, 1.0); 
        npc.position.set(startX, -0.15, startY);
        scene.add(npc);
        sceneObjects.push(npc);
        
        if (gltf.animations && gltf.animations.length > 0) {
            mixer = new THREE.AnimationMixer(npc);
            const action = mixer.clipAction(gltf.animations[0]);
            action.play();
        }

        if (allArtPositions.length > 0) {
            const randDest = allArtPositions[Math.floor(Math.random() * allArtPositions.length)];
            calculateNewPath((npc as THREE.Group).position.x, (npc as THREE.Group).position.z, randDest.x, randDest.y);
        }
    }, undefined, () => {
        console.warn("human.glb not found in public/models/. Using fallback capsule mesh.");
        const fallbackGeo = new THREE.CapsuleGeometry(0.3, 1.0, 4, 8);
        const fallbackMat = new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x002222 });
        const mesh = new THREE.Mesh(fallbackGeo, fallbackMat);
        
        const group = new THREE.Group();
        group.add(mesh);
        group.position.set(startX, 0.8, startY);
        npc = group;
        scene.add(npc);
        sceneObjects.push(npc);

        if (allArtPositions.length > 0) {
            const randDest = allArtPositions[Math.floor(Math.random() * allArtPositions.length)];
            calculateNewPath(group.position.x, group.position.z, randDest.x, randDest.y);
        }
    });
}

function calculateNewPath(startX: number, startY: number, endX: number, endY: number) {
    const finder = new PF.AStarFinder();
    const gridClone = pfGrid.clone(); 
    currentPath = finder.findPath(Math.round(startX), Math.round(startY), endX, endY, gridClone);
    pathIndex = 0;

    if (pathLine) scene.remove(pathLine);
    if (currentPath.length > 0) {
        const pathMaterial = new THREE.LineBasicMaterial({ color: 0x00ffff, linewidth: 2 });
        const pathPoints = currentPath.map(p => new THREE.Vector3(p[0], 0.1, p[1])); 
        const pathGeometry = new THREE.BufferGeometry().setFromPoints(pathPoints);
        pathLine = new THREE.Line(pathGeometry, pathMaterial);
        scene.add(pathLine);
        sceneObjects.push(pathLine);
    }
}

// 6. Controls & Collisions
const keys: Record<string, boolean> = { 
    w: false, a: false, s: false, d: false,
    arrowup: false, arrowdown: false, arrowleft: false, arrowright: false 
};

window.addEventListener('keydown', (e) => { const k = e.key.toLowerCase(); if (k in keys) keys[k] = true; });
window.addEventListener('keyup', (e) => { const k = e.key.toLowerCase(); if (k in keys) keys[k] = false; });

const playerSpeed = 0.08;
const forwardVector = new THREE.Vector3();
const rightVector = new THREE.Vector3();
const raycaster = new THREE.Raycaster();
const collisionDistance = 0.4; 

function drawMinimap() {
    if (!minimapCtx || !minimapCanvas || minimapCanvas.style.display === 'none') return;
    
    minimapCtx.clearRect(0, 0, minimapCanvas.width, minimapCanvas.height);
    const cellSize = minimapCanvas.width / GRID_SIZE;

    wallObjects.forEach(wall => {
        minimapCtx.fillStyle = '#666';
        minimapCtx.fillRect(wall.position.x * cellSize, wall.position.z * cellSize, cellSize, cellSize);
    });

    if (npc) {
        minimapCtx.fillStyle = '#00ffff';
        minimapCtx.beginPath();
        minimapCtx.arc(npc.position.x * cellSize + cellSize/2, npc.position.z * cellSize + cellSize/2, cellSize/3, 0, Math.PI * 2);
        minimapCtx.fill();
    }

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
function animate() {
    requestAnimationFrame(animate);
    
    const delta = clock.getDelta();
    if (mixer) mixer.update(delta);

    const turnSpeed = 0.04;
    if (keys.arrowleft) camera.rotation.y += turnSpeed;
    if (keys.arrowright) camera.rotation.y -= turnSpeed;

    camera.getWorldDirection(forwardVector);
    forwardVector.y = 0; 
    forwardVector.normalize();
    rightVector.crossVectors(forwardVector, camera.up).normalize();

    function canMove(dir: THREE.Vector3): boolean {
        raycaster.set(camera.position, dir);
        const hits = raycaster.intersectObjects(wallObjects);
        return hits.length === 0 || hits[0].distance > collisionDistance;
    }

    const moveForward = keys.w || keys.arrowup;
    const moveBackward = keys.s || keys.arrowdown;

    if (moveForward && canMove(forwardVector)) camera.position.addScaledVector(forwardVector, playerSpeed); 
    if (moveBackward && canMove(forwardVector.clone().negate())) camera.position.addScaledVector(forwardVector, -playerSpeed); 
    if (keys.a && canMove(rightVector.clone().negate())) camera.position.addScaledVector(rightVector, -playerSpeed); 
    if (keys.d && canMove(rightVector)) camera.position.addScaledVector(rightVector, playerSpeed); 

    // Continuous Smooth Human NPC Movement with Procedural Step Bobbing
    // if (npc && currentPath.length > 0 && pathIndex < currentPath.length) {
    //     const targetX = currentPath[pathIndex][0];
    //     const targetZ = currentPath[pathIndex][1];
    //     const dx = targetX - npc.position.x;
    //     const dz = targetZ - npc.position.z;
    //     const dist = Math.sqrt(dx * dx + dz * dz);

    //     if (dist > 0.05) {
    //         npc.position.x += (dx / dist) * speed;
    //         npc.position.z += (dz / dist) * speed;
    //         npc.lookAt(targetX, npc.position.y, targetZ);

    //         // Procedural walking bob effect to simulate natural steps
    //         const stepCycle = Date.now() * 0.015;
    //         npc.position.y = -0.15 + Math.abs(Math.sin(stepCycle)) * 0.08;
    //     } else {
    //         npc.position.y = -0.15; 
    //         pathIndex++; 
    //     }
    // } else if (npc && currentPath.length > 0 && pathIndex >= currentPath.length) {
    //     const randDest = allArtPositions[Math.floor(Math.random() * allArtPositions.length)] || floorCells[0];
    //     calculateNewPath(npc.position.x, npc.position.z, randDest.x, randDest.y);
    // }

    if (npc && currentPath.length > 0 && pathIndex < currentPath.length) {
        const targetX = currentPath[pathIndex][0];
        const targetZ = currentPath[pathIndex][1];
        const dx = targetX - npc.position.x;
        const dz = targetZ - npc.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist > 0.05) {
            npc.position.x += (dx / dist) * speed;
            npc.position.z += (dz / dist) * speed;
            npc.lookAt(targetX, npc.position.y, targetZ);
            
            // Keep her feet firmly planted on the floor with no bouncing/jumping
            npc.position.y = -0.15;
        } else {
            npc.position.y = -0.15; 
            pathIndex++; 
        }
    } else if (npc && currentPath.length > 0 && pathIndex >= currentPath.length) {
        const randDest = allArtPositions[Math.floor(Math.random() * allArtPositions.length)] || floorCells[0];
        calculateNewPath(npc.position.x, npc.position.z, randDest.x, randDest.y);
    }

    drawMinimap();
    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
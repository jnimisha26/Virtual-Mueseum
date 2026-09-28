// import './style.css';
// import * as THREE from 'three';
// import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
// import * as PF from 'pathfinding';
// import { generateMuseumGrid, GRID_SIZE } from './grid'; 

// // 1. Scene & Camera Setup
// const scene = new THREE.Scene();
// scene.background = new THREE.Color(0x1a1a1a); 
// const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

// // 2. Renderer Setup
// const renderer = new THREE.WebGLRenderer({ antialias: true });
// renderer.setSize(window.innerWidth, window.innerHeight);
// document.getElementById('app')?.appendChild(renderer.domElement);

// // 3. Lighting
// const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
// scene.add(ambientLight);
// const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
// directionalLight.position.set(10, 20, 10);
// scene.add(directionalLight);

// // 4. Controls
// const controls = new OrbitControls(camera, renderer.domElement);

// // ==========================================
// // 5. PROCEDURAL GENERATION & PATHFINDING
// // ==========================================

// const museumData = generateMuseumGrid();
// const pfGrid = new PF.Grid(GRID_SIZE, GRID_SIZE); 

// const floorGeo = new THREE.PlaneGeometry(1, 1);
// const floorMat = new THREE.MeshStandardMaterial({ color: 0xe9ecef }); 
// const wallGeo = new THREE.BoxGeometry(1, 2, 1); 
// const wallMat = new THREE.MeshStandardMaterial({ color: 0x343a40 }); 
// const artGeo = new THREE.BoxGeometry(0.6, 1.2, 0.6); 
// const artMat = new THREE.MeshStandardMaterial({ color: 0xffc107 }); 

// let artPos = { x: 0, y: 0 };
// const floorCells: { x: number, y: number }[] = [];
// const wallObjects: THREE.Mesh[] = []; // NEW: Array to hold walls for collision
// museumData.forEach(row => {
//     row.forEach(cell => {
//         const floor = new THREE.Mesh(floorGeo, floorMat);
//         floor.rotation.x = -Math.PI / 2;
//         floor.position.set(cell.x, 0, cell.y); 
//         scene.add(floor);

//         if (cell.type === 'wall') {
//     const wall = new THREE.Mesh(wallGeo, wallMat);
//     wall.position.set(cell.x, 1, cell.y); 
//     scene.add(wall);
//     pfGrid.setWalkableAt(cell.x, cell.y, false); 
    
//     wallObjects.push(wall); // NEW: Save this wall for the Raycaster
// } else if (cell.type === 'art') {
//             const art = new THREE.Mesh(artGeo, artMat);
//             art.position.set(cell.x, 0.6, cell.y);
//             scene.add(art);
//             artPos = { x: cell.x, y: cell.y }; 
//         } else if (cell.type === 'floor') {
//             floorCells.push({ x: cell.x, y: cell.y }); 
//         }
//     });
// });

// const randomStart = floorCells[Math.floor(Math.random() * floorCells.length)];
// const finder = new PF.AStarFinder();
// const path = finder.findPath(randomStart.x, randomStart.y, artPos.x, artPos.y, pfGrid);

// // Draw the path line
// if (path.length > 0) {
//     const pathMaterial = new THREE.LineBasicMaterial({ color: 0x00ffff, linewidth: 3 });
//     const pathPoints = path.map(p => new THREE.Vector3(p[0], 0.1, p[1])); 
//     const pathGeometry = new THREE.BufferGeometry().setFromPoints(pathPoints);
//     const pathLine = new THREE.Line(pathGeometry, pathMaterial);
//     scene.add(pathLine);
// }

// // ==========================================
// // 6. SPAWN AND ANIMATE NPC
// // ==========================================

// // Create the NPC (a simple capsule)
// const npcGeo = new THREE.CapsuleGeometry(0.25, 0.5, 4, 8);
// const npcMat = new THREE.MeshStandardMaterial({ color: 0x0d6efd }); // Blue to stand out
// const npc = new THREE.Mesh(npcGeo, npcMat);
// npc.position.set(randomStart.x, 0.75, randomStart.y); // Spawn at the start node
// scene.add(npc);

// // Animation State Variables
// let pathIndex = 0;
// const speed = 0.015; // How fast the NPC walks

// // Center Camera
// // const centerOffset = GRID_SIZE / 2;
// // controls.target.set(centerOffset, 0, centerOffset); 
// // camera.position.set(centerOffset, 12, centerOffset + 10); 
// // controls.update();
// // First-Person Camera Setup
// // 1. Position the camera at human eye level (1.5) on the starting floor tile
// camera.position.set(randomStart.x, 1.5, randomStart.y); 

// // 2. Set the control target slightly in front of the camera so dragging simulates turning your head
// controls.target.set(randomStart.x, 1.5, randomStart.y - 0.01); 

// // 3. Disable scrolling and panning to lock the visitor in place
// controls.enableZoom = false;
// controls.enablePan = false;

// controls.update();

// // ==========================================
// // WASD KEYBOARD CONTROLS
// // ==========================================

// const keys = { w: false, a: false, s: false, d: false };

// window.addEventListener('keydown', (event) => {
//     const key = event.key.toLowerCase();
//     if (key in keys) keys[key as keyof typeof keys] = true;
// });

// window.addEventListener('keyup', (event) => {
//     const key = event.key.toLowerCase();
//     if (key in keys) keys[key as keyof typeof keys] = false;
// });

// const playerSpeed = 0.08;
// const forwardVector = new THREE.Vector3();
// const rightVector = new THREE.Vector3();

// // NEW: Raycaster setup
// const raycaster = new THREE.Raycaster();
// const collisionDistance = 0.4; // Stop moving if a wall is within 0.4 units

// // 7. Animation Loop
// // function animate() {
// //     requestAnimationFrame(animate);
    
// //     // NPC Movement Logic
// //     if (path.length > 0 && pathIndex < path.length) {
// //         const targetNode = path[pathIndex];
// //         const targetX = targetNode[0];
// //         const targetZ = targetNode[1];

// //         // Calculate distance between current position and target node
// //         const dx = targetX - npc.position.x;
// //         const dz = targetZ - npc.position.z;
// //         const distance = Math.sqrt(dx * dx + dz * dz);

// //         // If far away, keep moving. If close enough, step to the next node.
// //         if (distance > 0.05) {
// //             npc.position.x += (dx / distance) * speed;
// //             npc.position.z += (dz / distance) * speed;
            
// //             // Make the NPC face the direction it's walking
// //             npc.lookAt(targetX, npc.position.y, targetZ);
// //         } else {
// //             pathIndex++; // Node reached, target the next one in the array
// //         }
// //     }

// //     controls.update();
// //     renderer.render(scene, camera);
// // }
// // animate();

// // 7. Animation Loop
// function animate() {
//     requestAnimationFrame(animate);
    
//     // --- WASD Movement Logic ---
//     // 1. Figure out which way the camera is facing
//     // camera.getWorldDirection(forwardVector);
//     // forwardVector.y = 0; // Prevent flying up into the sky
//     // forwardVector.normalize();

//     // // 2. Figure out which way is "right" based on where we are facing
//     // rightVector.crossVectors(forwardVector, camera.up).normalize();

//     // // 3. Move the camera and the control target based on key presses
//     // if (keys.w) {
//     //     camera.position.addScaledVector(forwardVector, playerSpeed);
//     //     controls.target.addScaledVector(forwardVector, playerSpeed);
//     // }
//     // if (keys.s) {
//     //     camera.position.addScaledVector(forwardVector, -playerSpeed);
//     //     controls.target.addScaledVector(forwardVector, -playerSpeed);
//     // }
//     // if (keys.a) {
//     //     camera.position.addScaledVector(rightVector, -playerSpeed);
//     //     controls.target.addScaledVector(rightVector, -playerSpeed);
//     // }
//     // if (keys.d) {
//     //     camera.position.addScaledVector(rightVector, playerSpeed);
//     //     controls.target.addScaledVector(rightVector, playerSpeed);
//     // }
// // --- WASD Movement Logic ---
//     camera.getWorldDirection(forwardVector);
//     forwardVector.y = 0; 
//     forwardVector.normalize();
//     rightVector.crossVectors(forwardVector, camera.up).normalize();

//     // Helper function: Shoots a laser in the chosen direction to check for walls
//     function canMove(directionVector: THREE.Vector3) {
//         raycaster.set(camera.position, directionVector);
//         const intersections = raycaster.intersectObjects(wallObjects);
//         // Return true if we hit nothing, or if the wall is far away
//         return intersections.length === 0 || intersections[0].distance > collisionDistance;
//     }

//     // Only move if canMove() returns true
//     if (keys.w && canMove(forwardVector)) {
//         camera.position.addScaledVector(forwardVector, playerSpeed);
//         controls.target.addScaledVector(forwardVector, playerSpeed);
//     }
//     if (keys.s) {
//         const backVector = forwardVector.clone().negate();
//         if (canMove(backVector)) {
//             camera.position.addScaledVector(forwardVector, -playerSpeed);
//             controls.target.addScaledVector(forwardVector, -playerSpeed);
//         }
//     }
//     if (keys.a) {
//         const leftVector = rightVector.clone().negate();
//         if (canMove(leftVector)) {
//             camera.position.addScaledVector(rightVector, -playerSpeed);
//             controls.target.addScaledVector(rightVector, -playerSpeed);
//         }
//     }
//     if (keys.d && canMove(rightVector)) {
//         camera.position.addScaledVector(rightVector, playerSpeed);
//         controls.target.addScaledVector(rightVector, playerSpeed);
//     }
//     // --- NPC Movement Logic ---
//     if (path.length > 0 && pathIndex < path.length) {
//         const targetNode = path[pathIndex];
//         const targetX = targetNode[0];
//         const targetZ = targetNode[1];

//         const dx = targetX - npc.position.x;
//         const dz = targetZ - npc.position.z;
//         const distance = Math.sqrt(dx * dx + dz * dz);

//         if (distance > 0.05) {
//             npc.position.x += (dx / distance) * speed;
//             npc.position.z += (dz / distance) * speed;
//             npc.lookAt(targetX, npc.position.y, targetZ);
//         } else {
//             pathIndex++; 
//         }
//     }

//     controls.update();
//     renderer.render(scene, camera);
// }
// animate();

// window.addEventListener('resize', () => {
//     camera.aspect = window.innerWidth / window.innerHeight;
//     camera.updateProjectionMatrix();
//     renderer.setSize(window.innerWidth, window.innerHeight);
// });

// import './style.css';
// import * as THREE from 'three';
// import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
// import * as PF from 'pathfinding';
// import { generateMuseumGrid, GRID_SIZE } from './grid'; 

// // 1. Scene & Camera Setup
// const scene = new THREE.Scene();
// scene.background = new THREE.Color(0x1a1a1a); 
// scene.fog = new THREE.Fog(0x1a1a1a, 10, 50);

// const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

// // 2. Renderer Setup
// const renderer = new THREE.WebGLRenderer({ antialias: true });
// renderer.setSize(window.innerWidth, window.innerHeight);
// document.getElementById('app')?.appendChild(renderer.domElement);

// // 3. Lighting
// const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
// scene.add(ambientLight);
// const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
// directionalLight.position.set(10, 20, 10);
// directionalLight.castShadow = true;
// scene.add(directionalLight);

// // 4. Controls
// const controls = new OrbitControls(camera, renderer.domElement);

// // ==========================================
// // 5. PROCEDURAL GENERATION & PATHFINDING
// // ==========================================

// const museumData = generateMuseumGrid();
// const pfGrid = new PF.Grid(GRID_SIZE, GRID_SIZE); 

// const gridHelper = new THREE.GridHelper(GRID_SIZE, GRID_SIZE, 0x00ffff, 0x444444);
// gridHelper.position.y = 0.01;
// scene.add(gridHelper);

// const floorGeo = new THREE.PlaneGeometry(1, 1);
// const floorMat = new THREE.MeshStandardMaterial({ color: 0x222222 }); 
// const wallGeo = new THREE.BoxGeometry(1, 2, 1); 
// const artGeo = new THREE.BoxGeometry(0.6, 1.2, 0.6); 
// const artMat = new THREE.MeshStandardMaterial({ color: 0xffc107 }); 

// let artPos = { x: 0, y: 0 };
// const floorCells = [];
// const wallObjects = []; 

// // Calculate the center of the grid to determine room sides
// const centerX = GRID_SIZE / 2;
// const centerY = GRID_SIZE / 2;

// museumData.forEach(row => {
//     row.forEach(cell => {
//         const floor = new THREE.Mesh(floorGeo, floorMat);
//         floor.rotation.x = -Math.PI / 2;
//         floor.position.set(cell.x, 0, cell.y); 
//         scene.add(floor);

//         if (cell.type === 'wall') {
            
//             // Determine side based on distance from center
//             const dx = cell.x - centerX;
//             const dy = cell.y - centerY;
            
//             let wallColor;
            
//             // Compare absolute distances to see if it's primarily an X-wall or Y-wall
//             if (Math.abs(dx) > Math.abs(dy)) {
//                 // East or West wall
//                 wallColor = dx > 0 ? 0x2980b9 : 0xc0392b; // Blue (East) vs Red (West)
//             } else {
//                 // North or South wall
//                 wallColor = dy > 0 ? 0x27ae60 : 0xf39c12; // Green (South) vs Orange (North)
//             }

//             const uniqueWallMat = new THREE.MeshStandardMaterial({ color: wallColor });
            
//             const wall = new THREE.Mesh(wallGeo, uniqueWallMat);
//             wall.position.set(cell.x, 1, cell.y); 
//             scene.add(wall);
//             pfGrid.setWalkableAt(cell.x, cell.y, false); 
//             wallObjects.push(wall); 
            
//         } else if (cell.type === 'art') {
//             const art = new THREE.Mesh(artGeo, artMat);
//             art.position.set(cell.x, 0.6, cell.y);
//             scene.add(art);
//             artPos = { x: cell.x, y: cell.y }; 
//         } else if (cell.type === 'floor') {
//             floorCells.push({ x: cell.x, y: cell.y }); 
//         }
//     });
// });

// // ==========================================
// // 6. SPAWN AND ANIMATE NPC (CONTINUOUS WANDERING)
// // ==========================================

// const randomStart = floorCells[Math.floor(Math.random() * floorCells.length)];

// const npcGeo = new THREE.CapsuleGeometry(0.25, 0.5, 4, 8);
// const npcMat = new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x004444 }); 
// const npc = new THREE.Mesh(npcGeo, npcMat);
// npc.position.set(randomStart.x, 0.75, randomStart.y); 
// scene.add(npc);

// let currentPath = [];
// let pathIndex = 0;
// const speed = 0.025; 

// let pathLine;

// function calculateNewPath(startX, startY, endX, endY) {
//     const finder = new PF.AStarFinder();
//     const gridClone = pfGrid.clone(); 
//     currentPath = finder.findPath(Math.round(startX), Math.round(startY), endX, endY, gridClone);
//     pathIndex = 0;

//     if (pathLine) scene.remove(pathLine);
//     if (currentPath.length > 0) {
//         const pathMaterial = new THREE.LineBasicMaterial({ color: 0x00ffff, linewidth: 2 });
//         const pathPoints = currentPath.map(p => new THREE.Vector3(p[0], 0.1, p[1])); 
//         const pathGeometry = new THREE.BufferGeometry().setFromPoints(pathPoints);
//         pathLine = new THREE.Line(pathGeometry, pathMaterial);
//         scene.add(pathLine);
//     }
// }

// calculateNewPath(randomStart.x, randomStart.y, artPos.x, artPos.y);

// // First-Person Camera Setup
// camera.position.set(randomStart.x, 1.5, randomStart.y); 
// controls.target.set(randomStart.x, 1.5, randomStart.y - 0.01); 
// controls.enableZoom = false;
// controls.enablePan = false;
// controls.update();

// // ==========================================
// // WASD KEYBOARD CONTROLS
// // ==========================================

// const keys = { w: false, a: false, s: false, d: false };

// window.addEventListener('keydown', (event) => {
//     const key = event.key.toLowerCase();
//     if (key in keys) keys[key] = true;
// });

// window.addEventListener('keyup', (event) => {
//     const key = event.key.toLowerCase();
//     if (key in keys) keys[key] = false;
// });

// const playerSpeed = 0.08;
// const forwardVector = new THREE.Vector3();
// const rightVector = new THREE.Vector3();
// const raycaster = new THREE.Raycaster();
// const collisionDistance = 0.4; 

// // 7. Animation Loop
// function animate() {
//     requestAnimationFrame(animate);
    
//     // --- WASD Movement Logic ---
//     camera.getWorldDirection(forwardVector);
//     forwardVector.y = 0; 
//     forwardVector.normalize();
//     rightVector.crossVectors(forwardVector, camera.up).normalize();

//     function canMove(directionVector) {
//         raycaster.set(camera.position, directionVector);
//         const intersections = raycaster.intersectObjects(wallObjects);
//         return intersections.length === 0 || intersections[0].distance > collisionDistance;
//     }

//     if (keys.w && canMove(forwardVector)) {
//         camera.position.addScaledVector(forwardVector, playerSpeed);
//         controls.target.addScaledVector(forwardVector, playerSpeed);
//     }
//     if (keys.s) {
//         const backVector = forwardVector.clone().negate();
//         if (canMove(backVector)) {
//             camera.position.addScaledVector(forwardVector, -playerSpeed);
//             controls.target.addScaledVector(forwardVector, -playerSpeed);
//         }
//     }
//     if (keys.a) {
//         const leftVector = rightVector.clone().negate();
//         if (canMove(leftVector)) {
//             camera.position.addScaledVector(rightVector, -playerSpeed);
//             controls.target.addScaledVector(rightVector, -playerSpeed);
//         }
//     }
//     if (keys.d && canMove(rightVector)) {
//         camera.position.addScaledVector(rightVector, playerSpeed);
//         controls.target.addScaledVector(rightVector, playerSpeed);
//     }

//     // --- Continuous NPC Movement Logic ---
//     if (currentPath.length > 0 && pathIndex < currentPath.length) {
//         const targetNode = currentPath[pathIndex];
//         const targetX = targetNode[0];
//         const targetZ = targetNode[1];

//         const dx = targetX - npc.position.x;
//         const dz = targetZ - npc.position.z;
//         const distance = Math.sqrt(dx * dx + dz * dz);

//         if (distance > 0.05) {
//             npc.position.x += (dx / distance) * speed;
//             npc.position.z += (dz / distance) * speed;
//             npc.lookAt(targetX, npc.position.y, targetZ);
//         } else {
//             pathIndex++; 
//         }
//     } else if (currentPath.length > 0 && pathIndex >= currentPath.length) {
//         const randomDest = floorCells[Math.floor(Math.random() * floorCells.length)];
//         calculateNewPath(npc.position.x, npc.position.z, randomDest.x, randomDest.y);
//     }

//     controls.update();
//     renderer.render(scene, camera);
// }
// animate();

// window.addEventListener('resize', () => {
//     camera.aspect = window.innerWidth / window.innerHeight;
//     camera.updateProjectionMatrix();
//     renderer.setSize(window.innerWidth, window.innerHeight);
// });
import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as PF from 'pathfinding';
import { generateMuseumGrid, GRID_SIZE } from './grid'; 

// 1. Scene & Camera Setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a1a); 
scene.fog = new THREE.Fog(0x1a1a1a, 10, 50);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

// 2. Renderer Setup
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('app')?.appendChild(renderer.domElement);

// 3. Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(10, 20, 10);
directionalLight.castShadow = true;
scene.add(directionalLight);

// 4. Controls
const controls = new OrbitControls(camera, renderer.domElement);

// ==========================================
// 5. PROCEDURAL GENERATION & PATHFINDING
// ==========================================

const museumData = generateMuseumGrid();
const pfGrid = new PF.Grid(GRID_SIZE, GRID_SIZE); 

const gridHelper = new THREE.GridHelper(GRID_SIZE, GRID_SIZE, 0x00ffff, 0x444444);
gridHelper.position.y = 0.01;
scene.add(gridHelper);

const floorGeo = new THREE.PlaneGeometry(1, 1);
const floorMat = new THREE.MeshStandardMaterial({ color: 0x222222 }); 
const wallGeo = new THREE.BoxGeometry(1, 2, 1); 
const artGeo = new THREE.BoxGeometry(0.6, 1.2, 0.6); 
const artMat = new THREE.MeshStandardMaterial({ color: 0xffc107 }); 

let artPos = { x: 0, y: 0 };
const floorCells: { x: number; y: number }[] = [];
const wallObjects: THREE.Mesh[] = []; 

// Calculate the center of the grid to determine room sides
const centerX = GRID_SIZE / 2;
const centerY = GRID_SIZE / 2;

museumData.forEach(row => {
    row.forEach(cell => {
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(cell.x, 0, cell.y); 
        scene.add(floor);

        if (cell.type === 'wall') {
            const dx = cell.x - centerX;
            const dy = cell.y - centerY;
            
            let wallColor: number;
            
            if (Math.abs(dx) > Math.abs(dy)) {
                wallColor = dx > 0 ? 0x2980b9 : 0xc0392b; 
            } else {
                wallColor = dy > 0 ? 0x27ae60 : 0xf39c12; 
            }

            const uniqueWallMat = new THREE.MeshStandardMaterial({ color: wallColor });
            
            const wall = new THREE.Mesh(wallGeo, uniqueWallMat);
            wall.position.set(cell.x, 1, cell.y); 
            scene.add(wall);
            pfGrid.setWalkableAt(cell.x, cell.y, false); 
            wallObjects.push(wall); 
            
        } else if (cell.type === 'art') {
            const art = new THREE.Mesh(artGeo, artMat);
            art.position.set(cell.x, 0.6, cell.y);
            scene.add(art);
            artPos = { x: cell.x, y: cell.y }; 
        } else if (cell.type === 'floor') {
            floorCells.push({ x: cell.x, y: cell.y }); 
        }
    });
});

// ==========================================
// 6. SPAWN AND ANIMATE NPC (CONTINUOUS WANDERING)
// ==========================================

const randomStart = floorCells[Math.floor(Math.random() * floorCells.length)];

const npcGeo = new THREE.CapsuleGeometry(0.25, 0.5, 4, 8);
const npcMat = new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x004444 }); 
const npc = new THREE.Mesh(npcGeo, npcMat);
npc.position.set(randomStart.x, 0.75, randomStart.y); 
scene.add(npc);

let currentPath: number[][] = [];
let pathIndex = 0;
const speed = 0.025; 

let pathLine: THREE.Line | undefined;

function calculateNewPath(startX: number, startY: number, endX: number, endY: number) {
    const finder = new PF.AStarFinder();
    const gridClone = pfGrid.clone(); 
    currentPath = finder.findPath(Math.round(startX), Math.round(startY), endX, endY, gridClone);
    pathIndex = 0;

    if (pathLine) scene.remove(pathLine);
    if (currentPath.length > 0) {
        const pathMaterial = new THREE.LineBasicMaterial({ color: 0x00ffff });
        const pathPoints = currentPath.map(p => new THREE.Vector3(p[0], 0.1, p[1])); 
        const pathGeometry = new THREE.BufferGeometry().setFromPoints(pathPoints);
        pathLine = new THREE.Line(pathGeometry, pathMaterial);
        scene.add(pathLine);
    }
}

calculateNewPath(randomStart.x, randomStart.y, artPos.x, artPos.y);

// First-Person Camera Setup
camera.position.set(randomStart.x, 1.5, randomStart.y); 
controls.target.set(randomStart.x, 1.5, randomStart.y - 0.01); 
controls.enableZoom = false;
controls.enablePan = false;
controls.update();

// ==========================================
// WASD KEYBOARD CONTROLS
// ==========================================

const keys: Record<string, boolean> = { w: false, a: false, s: false, d: false };

window.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    if (key in keys) keys[key] = true;
});

window.addEventListener('keyup', (event) => {
    const key = event.key.toLowerCase();
    if (key in keys) keys[key] = false;
});

const playerSpeed = 0.08;
const forwardVector = new THREE.Vector3();
const rightVector = new THREE.Vector3();
const raycaster = new THREE.Raycaster();
const collisionDistance = 0.4; 

// 7. Animation Loop
function animate() {
    requestAnimationFrame(animate);
    
    // --- WASD Movement Logic ---
    camera.getWorldDirection(forwardVector);
    forwardVector.y = 0; 
    forwardVector.normalize();
    rightVector.crossVectors(forwardVector, camera.up).normalize();

    function canMove(directionVector: THREE.Vector3): boolean {
        raycaster.set(camera.position, directionVector);
        const intersections = raycaster.intersectObjects(wallObjects);
        return intersections.length === 0 || intersections[0].distance > collisionDistance;
    }

    if (keys.w && canMove(forwardVector)) {
        camera.position.addScaledVector(forwardVector, playerSpeed);
        controls.target.addScaledVector(forwardVector, playerSpeed);
    }
    if (keys.s) {
        const backVector = forwardVector.clone().negate();
        if (canMove(backVector)) {
            camera.position.addScaledVector(forwardVector, -playerSpeed);
            controls.target.addScaledVector(forwardVector, -playerSpeed);
        }
    }
    if (keys.a) {
        const leftVector = rightVector.clone().negate();
        if (canMove(leftVector)) {
            camera.position.addScaledVector(rightVector, -playerSpeed);
            controls.target.addScaledVector(rightVector, -playerSpeed);
        }
    }
    if (keys.d && canMove(rightVector)) {
        camera.position.addScaledVector(rightVector, playerSpeed);
        controls.target.addScaledVector(rightVector, playerSpeed);
    }

    // --- Continuous NPC Movement Logic ---
    if (currentPath.length > 0 && pathIndex < currentPath.length) {
        const targetNode = currentPath[pathIndex];
        const targetX = targetNode[0];
        const targetZ = targetNode[1];

        const dx = targetX - npc.position.x;
        const dz = targetZ - npc.position.z;
        const distance = Math.sqrt(dx * dx + dz * dz);

        if (distance > 0.05) {
            npc.position.x += (dx / distance) * speed;
            npc.position.z += (dz / distance) * speed;
            npc.lookAt(targetX, npc.position.y, targetZ);
        } else {
            pathIndex++; 
        }
    } else if (currentPath.length > 0 && pathIndex >= currentPath.length) {
        const randomDest = floorCells[Math.floor(Math.random() * floorCells.length)];
        calculateNewPath(npc.position.x, npc.position.z, randomDest.x, randomDest.y);
    }

    controls.update();
    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
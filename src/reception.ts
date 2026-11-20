import * as THREE from 'three';
import * as SkeletonUtils  from 'three/addons/utils/SkeletonUtils.js';
import { AvatarController } from './avatarController';


// Load images from src/gallery1, src/gallery2, src/gallery3 (or src/assets/gallery1..3)
const localGalleryModules = import.meta.glob(
  [
    './gallery1/*.{png,jpg,jpeg,webp,avif,PNG,JPG,JPEG}',
    './gallery2/*.{png,jpg,jpeg,webp,avif,PNG,JPG,JPEG}',
    './gallery3/*.{png,jpg,jpeg,webp,avif,PNG,JPG,JPEG}',
    './assets/gallery1/*.{png,jpg,jpeg,webp,avif,PNG,JPG,JPEG}',
    './assets/gallery2/*.{png,jpg,jpeg,webp,avif,PNG,JPG,JPEG}',
    './assets/gallery3/*.{png,jpg,jpeg,webp,avif,PNG,JPG,JPEG}',
  ],
  { eager: true, import: 'default' }
) as Record<string, string>;

function getLocalFolderImages(folderName: string): string[] {
  return Object.keys(localGalleryModules)
    .filter((p) => p.toLowerCase().includes(`/${folderName.toLowerCase()}/`))
    .sort()
    .map((p) => localGalleryModules[p]);
}

export interface ReceptionHandle {
  update: (delta: number) => void;
  cleanup: () => void;
  triggerGreeting: () => void;
}

// Light Cream (#E5D6C5) stone tile floor texture
function createCreamFloorTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#E5D6C5';
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 4500; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const alpha = Math.random() * 0.04;
    ctx.fillStyle = Math.random() > 0.5 ? `rgba(255,255,255,${alpha})` : `rgba(73,53,47,${alpha})`;
    ctx.fillRect(x, y, 2, 2);
  }

  ctx.strokeStyle = 'rgba(197, 164, 109, 0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, 254, 254);
  ctx.strokeRect(257, 1, 254, 254);
  ctx.strokeRect(1, 257, 254, 254);
  ctx.strokeRect(257, 257, 254, 254);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Solid Deep Plum (#57364F) wall texture
function createPlumPlasterTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#57364F';
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 3000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.018)' : 'rgba(0,0,0,0.025)';
    ctx.fillRect(x, y, 2, 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 2);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Dark Chocolate (#49352F) architectural slatted wood texture
function createDarkChocolateTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#49352F';
  ctx.fillRect(0, 0, 512, 512);

  for (let x = 0; x < 512; x += 2) {
    const tone = Math.sin(x * 0.15) * 6 + (Math.random() - 0.5) * 8;
    ctx.fillStyle = tone > 0 ? `rgba(242,211,201,0.035)` : `rgba(20,12,10,0.08)`;
    ctx.fillRect(x, 0, 2, 512);
  }
  for (let x = 16; x < 512; x += 16) {
    ctx.fillStyle = 'rgba(22, 14, 12, 0.42)';
    ctx.fillRect(x, 0, 2, 512);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 1);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Wall-mounted Reception Board Texture
function createReceptionBoardTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#49352F';
  ctx.fillRect(0, 0, 2048, 512);

  ctx.strokeStyle = '#C5A46D';
  ctx.lineWidth = 4;
  ctx.strokeRect(24, 24, 2048 - 48, 512 - 48);

  ctx.fillStyle = '#C5A46D';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '500 26px "Helvetica Neue", Arial, sans-serif';
  ctx.fillText('R E C E P T I O N   •   I N F O R M A T I O N', 1024, 118);

  ctx.fillStyle = '#F2D3C9';
  ctx.font = '600 84px Georgia, "Times New Roman", serif';
  ctx.fillText('THE VIRTUAL MUSEUM', 1024, 232);

  ctx.beginPath();
  ctx.moveTo(680, 315);
  ctx.lineTo(1004, 315);
  ctx.moveTo(1044, 315);
  ctx.lineTo(1368, 315);
  ctx.strokeStyle = '#C5A46D';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#C5A46D';
  ctx.beginPath();
  ctx.moveTo(1024, 307);
  ctx.lineTo(1032, 315);
  ctx.lineTo(1024, 323);
  ctx.lineTo(1016, 315);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#E5D6C5';
  ctx.font = '400 30px "Helvetica Neue", Arial, sans-serif';
  ctx.fillText('CURATED FINE ART EXHIBITIONS  &  GALLERY TOURS', 1024, 385);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function createHangingPendant(
  ceilingY: number,
  dropLength: number,
  goldMat: THREE.Material,
  darkMetalMat: THREE.Material,
  globeMat: THREE.Material
): THREE.Group {
  const pendant = new THREE.Group();

  const canopy = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.03, 24), darkMetalMat);
  canopy.position.y = ceilingY - 0.015;
  pendant.add(canopy);

  const canopyRing = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 24), goldMat);
  canopyRing.position.y = ceilingY - 0.035;
  pendant.add(canopyRing);

  const rod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.008, 0.008, dropLength, 12),
    goldMat
  );
  rod.position.y = ceilingY - dropLength / 2;
  pendant.add(rod);

  const shadeY = ceilingY - dropLength;

  const bellCap = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.11, 0.08, 28), goldMat);
  bellCap.position.y = shadeY - 0.02;
  pendant.add(bellCap);

  const globe = new THREE.Mesh(new THREE.SphereGeometry(0.115, 28, 24), globeMat);
  globe.position.y = shadeY - 0.11;
  pendant.add(globe);

  const haloRing = new THREE.Mesh(new THREE.TorusGeometry(0.122, 0.006, 12, 36), goldMat);
  haloRing.rotation.x = Math.PI / 2;
  haloRing.position.y = shadeY - 0.11;
  pendant.add(haloRing);

  return pendant;
}

function createSofaChair(
  upholsteryMat: THREE.Material,
  frameMat: THREE.Material,
  goldMat: THREE.Material
): THREE.Group {
  const chair = new THREE.Group();

  const base = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.1, 0.88), frameMat);
  base.position.set(0, 0.17, 0);
  base.castShadow = true;
  base.receiveShadow = true;
  chair.add(base);

  const legGeo = new THREE.CylinderGeometry(0.018, 0.014, 0.14, 12);
  [
    [-0.4, -0.36],
    [0.4, -0.36],
    [-0.4, 0.36],
    [0.4, 0.36],
  ].forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(legGeo, goldMat);
    leg.position.set(lx, 0.07, lz);
    leg.castShadow = true;
    chair.add(leg);
  });

  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.16, 0.76), upholsteryMat);
  seat.position.set(0, 0.3, 0.04);
  seat.castShadow = true;
  seat.receiveShadow = true;
  chair.add(seat);

  const backrest = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.46, 0.16), upholsteryMat);
  backrest.position.set(0, 0.56, -0.3);
  backrest.rotation.x = -0.14;
  backrest.castShadow = true;
  backrest.receiveShadow = true;
  chair.add(backrest);

  [-0.43, 0.43].forEach((ax) => {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.34, 0.84), upholsteryMat);
    arm.position.set(ax, 0.39, 0);
    arm.castShadow = true;
    arm.receiveShadow = true;
    chair.add(arm);
  });

  return chair;
}

function createAccentTable(topMat: THREE.Material, goldMat: THREE.Material): THREE.Group {
  const table = new THREE.Group();

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.025, 24), goldMat);
  base.position.y = 0.0125;
  base.castShadow = true;
  table.add(base);

  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.48, 16), goldMat);
  stem.position.y = 0.25;
  stem.castShadow = true;
  table.add(stem);

  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.03, 28), topMat);
  top.position.y = 0.5;
  top.castShadow = true;
  top.receiveShadow = true;
  table.add(top);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.008, 12, 32), goldMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.5;
  table.add(rim);

  return table;
}

function createFloorLamp(
  goldMat: THREE.Material,
  baseMat: THREE.Material,
  shadeMat: THREE.Material
): THREE.Group {
  const lamp = new THREE.Group();

  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.035, 24), baseMat);
  foot.position.y = 0.0175;
  foot.castShadow = true;
  lamp.add(foot);

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.018, 1.58, 16), goldMat);
  pole.position.y = 0.81;
  pole.castShadow = true;
  lamp.add(pole);

  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.28, 28, 1, true), shadeMat);
  shade.position.y = 1.62;
  lamp.add(shade);

  const topCap = new THREE.Mesh(new THREE.RingGeometry(0.02, 0.16, 24), goldMat);
  topCap.rotation.x = -Math.PI / 2;
  topCap.position.y = 1.76;
  lamp.add(topCap);

  return lamp;
}

export function buildReceptionScene(
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  gltfScene: THREE.Group,
  animations: THREE.AnimationClip[]
): ReceptionHandle {
  const receptionObjects: THREE.Object3D[] = [];
  const previousFog = scene.fog;
  const previousBackground = scene.background;
  let slideshowTimer: ReturnType<typeof setInterval> | null = null;

  scene.background = new THREE.Color(0x57364f);
  scene.fog = new THREE.Fog(0x57364f, 14, 30);

  const addObj = (obj: THREE.Object3D, castShadow = false, receiveShadow = false) => {
    if ((obj as THREE.Mesh).isMesh) {
      obj.castShadow = castShadow;
      obj.receiveShadow = receiveShadow;
    }
    scene.add(obj);
    receptionObjects.push(obj);
  };

  // Materials
  const floorMat = new THREE.MeshStandardMaterial({
    map: createCreamFloorTexture(), // Light cream #E5D6C5
    roughness: 0.42,
    metalness: 0.05,
  });

  const darkCeilingMat = new THREE.MeshStandardMaterial({
    color: 0x24191e,
    roughness: 0.82,
    metalness: 0.08,
  });

  const ceilingBeamMat = new THREE.MeshStandardMaterial({
    color: 0x1a1115,
    roughness: 0.7,
    metalness: 0.12,
  });

  // Clean #57364F Walls (No paintings on walls)
  const wallMat = new THREE.MeshStandardMaterial({
    map: createPlumPlasterTexture(),
    roughness: 0.72,
    metalness: 0.05,
  });

  const deskSlattedMat = new THREE.MeshStandardMaterial({
    map: createDarkChocolateTexture(), // Dark chocolate #49352F
    roughness: 0.38,
    metalness: 0.08,
  });

  const deskSolidMat = new THREE.MeshStandardMaterial({
    color: 0x49352f, // Dark chocolate #49352F
    roughness: 0.35,
    metalness: 0.1,
  });

  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xc5a46d,
    roughness: 0.25,
    metalness: 0.85,
  });

  const chairUpholsteryMat = new THREE.MeshStandardMaterial({
    color: 0xf2d3c9,
    roughness: 0.78,
  });

  const pendantGlobeMat = new THREE.MeshStandardMaterial({
    color: 0xfff5e4,
    emissive: 0xffcfa0,
    emissiveIntensity: 1.35,
    roughness: 0.25,
  });

  const lampShadeMat = new THREE.MeshStandardMaterial({
    color: 0xe5d6c5,
    emissive: 0xffd7ba,
    emissiveIntensity: 0.65,
    roughness: 0.6,
    side: THREE.DoubleSide,
  });

  // 1. Lobby Architecture
  const roomWidth = 11;
  const roomDepth = 11;
  const wallHeight = 3.85;

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(roomWidth, roomDepth), floorMat);
  floor.rotation.x = -Math.PI / 2;
  addObj(floor, false, true);

  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(roomWidth, roomDepth), darkCeilingMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = wallHeight;
  addObj(ceiling);

  [-2.6, 0, 2.6].forEach((xPos) => {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, roomDepth), ceilingBeamMat);
    beam.position.set(xPos, wallHeight - 0.06, 0);
    addObj(beam);
  });

  [-3.2, -1.0, 1.2].forEach((zPos) => {
    const crossBeam = new THREE.Mesh(new THREE.BoxGeometry(roomWidth, 0.1, 0.14), ceilingBeamMat);
    crossBeam.position.set(0, wallHeight - 0.05, zPos);
    addObj(crossBeam);
  });

  const backCrown = new THREE.Mesh(new THREE.BoxGeometry(roomWidth, 0.06, 0.06), goldMat);
  backCrown.position.set(0, wallHeight - 0.03, -4.43);
  addObj(backCrown);

  // Clean #57364F Walls
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(roomWidth, wallHeight, 0.3), wallMat);
  backWall.position.set(0, wallHeight / 2, -4.6);
  addObj(backWall, false, true);

  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.3, wallHeight, roomDepth), wallMat);
  leftWall.position.set(-roomWidth / 2, wallHeight / 2, 0);
  addObj(leftWall, false, true);

  const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.3, wallHeight, roomDepth), wallMat);
  rightWall.position.set(roomWidth / 2, wallHeight / 2, 0);
  addObj(rightWall, false, true);

  const backBaseboard = new THREE.Mesh(new THREE.BoxGeometry(roomWidth, 0.12, 0.05), goldMat);
  backBaseboard.position.set(0, 0.06, -4.43);
  addObj(backBaseboard);

  // 2. Central Reception Board Plaque
  const boardBacking = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.88, 0.05), goldMat);
  boardBacking.position.set(0, 2.82, -4.42);
  addObj(boardBacking, true, false);

  const boardFace = new THREE.Mesh(
    new THREE.PlaneGeometry(3.32, 0.8),
    new THREE.MeshStandardMaterial({
      map: createReceptionBoardTexture(),
      roughness: 0.45,
      metalness: 0.15,
    })
  );
  boardFace.position.set(0, 2.82, -4.39);
  addObj(boardFace);

  // 3. Aesthetic Hanging Pendant Lights
  const deskPendantConfigs = [
    { x: -1.05, z: -2.05, drop: 0.95 },
    { x: 0, z: -2.05, drop: 0.72 },
    { x: 1.05, z: -2.05, drop: 0.95 },
  ];

  deskPendantConfigs.forEach(({ x, z, drop }) => {
    const pendant = createHangingPendant(
      wallHeight,
      drop,
      goldMat,
      ceilingBeamMat,
      pendantGlobeMat
    );
    pendant.position.set(x, 0, z);
    addObj(pendant);

    const bulbLight = new THREE.PointLight(0xffdcb0, 3.0, 5.5, 1.6);
    bulbLight.position.set(x, wallHeight - drop - 0.14, z);
    addObj(bulbLight);
  });

  [-3.15, 3.15].forEach((xPos) => {
    const loungePendant = createHangingPendant(
      wallHeight,
      1.18,
      goldMat,
      ceilingBeamMat,
      pendantGlobeMat
    );
    loungePendant.position.set(xPos, 0, -0.85);
    addObj(loungePendant);
  });

  // 4. Dark Chocolate (#49352F) Reception Desk
  const deskGroup = new THREE.Group();
  deskGroup.position.set(0, 0, -2.05);

  const plinth = new THREE.Mesh(new THREE.BoxGeometry(3.05, 0.1, 0.72), goldMat);
  plinth.position.set(0, 0.05, 0);
  plinth.castShadow = true;
  deskGroup.add(plinth);

  const deskBody = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.92, 0.82), deskSlattedMat);
  deskBody.position.set(0, 0.56, 0);
  deskBody.castShadow = true;
  deskBody.receiveShadow = true;
  deskGroup.add(deskBody);

  const counterTop = new THREE.Mesh(new THREE.BoxGeometry(3.38, 0.07, 0.98), deskSolidMat);
  counterTop.position.set(0, 1.055, 0.02);
  counterTop.castShadow = true;
  counterTop.receiveShadow = true;
  deskGroup.add(counterTop);

  const goldReveal = new THREE.Mesh(new THREE.BoxGeometry(3.24, 0.025, 0.85), goldMat);
  goldReveal.position.set(0, 1.01, 0);
  deskGroup.add(goldReveal);

  const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.025, 24), goldMat);
  lampBase.position.set(1.18, 1.1, 0.12);
  deskGroup.add(lampBase);

  const lampStem = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.34, 12), goldMat);
  lampStem.position.set(1.18, 1.27, 0.12);
  deskGroup.add(lampStem);

  const lampShade = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.14, 0.12, 24), goldMat);
  lampShade.position.set(1.18, 1.44, 0.12);
  deskGroup.add(lampShade);

  const vaseMat = new THREE.MeshStandardMaterial({ color: 0xf2d3c9, roughness: 0.3 });
  const vase = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 0.24, 24), vaseMat);
  vase.position.set(-1.2, 1.21, 0.1);
  vase.castShadow = true;
  deskGroup.add(vase);

  addObj(deskGroup);

  // 5. Visitor Lounge Seating Areas
  const leftChair = createSofaChair(chairUpholsteryMat, deskSolidMat, goldMat);
  leftChair.position.set(-3.15, 0, -0.75);
  leftChair.rotation.y = Math.PI / 2.4;
  addObj(leftChair);

  const leftSideTable = createAccentTable(deskSolidMat, goldMat);
  leftSideTable.position.set(-3.2, 0, -1.55);
  addObj(leftSideTable);

  const leftFloorLamp = createFloorLamp(goldMat, deskSolidMat, lampShadeMat);
  leftFloorLamp.position.set(-4.05, 0, -1.45);
  addObj(leftFloorLamp);

  const leftLampLight = new THREE.PointLight(0xffdfb8, 3.0, 5.5, 1.6);
  leftLampLight.position.set(-4.05, 1.62, -1.45);
  addObj(leftLampLight);

  const rightChair = createSofaChair(chairUpholsteryMat, deskSolidMat, goldMat);
  rightChair.position.set(3.15, 0, -0.75);
  rightChair.rotation.y = -Math.PI / 2.4;
  addObj(rightChair);

  const rightSideTable = createAccentTable(deskSolidMat, goldMat);
  rightSideTable.position.set(3.2, 0, -1.55);
  addObj(rightSideTable);

  const rightFloorLamp = createFloorLamp(goldMat, deskSolidMat, lampShadeMat);
  rightFloorLamp.position.set(4.05, 0, -1.45);
  addObj(rightFloorLamp);

  const rightLampLight = new THREE.PointLight(0xffdfb8, 3.0, 5.5, 1.6);
  rightLampLight.position.set(4.05, 1.62, -1.45);
  addObj(rightLampLight);

  // 6. Layered Warm Architectural Lighting
  const lobbyAmbient = new THREE.HemisphereLight(0xffe9dc, 0xe5d6c5, 0.85);
  addObj(lobbyAmbient);

  const boardSpot = new THREE.SpotLight(0xffe9dc, 10.5, 10, Math.PI / 4, 0.65, 1);
  boardSpot.position.set(0, 3.65, -2.5);
  boardSpot.target.position.set(0, 2.6, -4.35);
  addObj(boardSpot);
  addObj(boardSpot.target);

  const curatorSpot = new THREE.SpotLight(0xfff0e6, 11.5, 12, Math.PI / 3.2, 0.55, 1);
  curatorSpot.position.set(1.1, 3.55, -0.2);
  curatorSpot.target.position.set(0, 1.25, -2.95);
  curatorSpot.castShadow = true;
  curatorSpot.shadow.mapSize.set(1024, 1024);
  curatorSpot.shadow.bias = -0.0005;
  addObj(curatorSpot);
  addObj(curatorSpot.target);

  // 7. Spawn Receptionist Behind Desk — Strictly Idle
  const receptionist = SkeletonUtils.clone(gltfScene) as THREE.Group;
  receptionist.position.set(0, 0, -2.95);
  receptionist.lookAt(0, 0, 1.8);
  receptionist.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  addObj(receptionist);

  const avatar = animations.length > 0 ? new AvatarController(receptionist, animations) : null;
  avatar?.play('standing_idle');

  camera.position.set(0, 1.66, 2.15);
  camera.lookAt(0, 1.44, -2.35);

  // 8. Coverflow Carousel + Gallery 1 / 2 / 3 Slideshow Logic
  const welcomeSplash = document.getElementById('welcome-splash');
  const gallerySelector = document.getElementById('gallery-selector');
  const enterBtn = document.getElementById('btn-enter-experience');
  const prevBtn = document.getElementById('btn-prev-gallery');
  const nextBtn = document.getElementById('btn-next-gallery');
  const activeTitleEl = document.getElementById('active-gallery-title');
  const activeSubEl = document.getElementById('active-gallery-sub');

  const cards = Array.from(document.querySelectorAll('.coverflow-card')) as HTMLElement[];
  const slideImgs = [
    document.getElementById('slide-img-0') as HTMLImageElement | null,
    document.getElementById('slide-img-1') as HTMLImageElement | null,
    document.getElementById('slide-img-2') as HTMLImageElement | null,
  ];

  const galleryMeta = [
    { title: 'Classical Wing', sub: 'Gallery 1 • Renaissance & Baroque' },
    { title: 'Modern Wing', sub: 'Gallery 2 • Contemporary & Abstract' },
    { title: 'Labyrinth Maze', sub: 'Gallery 3 • Curated Highlights' },
  ];

  // Collect images from src/gallery1..3 first, and merge with public/artworks.json (/gallery1..3)
  const slidePools: string[][] = [
    getLocalFolderImages('gallery1'),
    getLocalFolderImages('gallery2'),
    getLocalFolderImages('gallery3'),
  ];
  const slideCursors = [0, 0, 0];

  const applySlideFrame = (poolIndex: number) => {
    const pool = slidePools[poolIndex];
    const imgEl = slideImgs[poolIndex];
    if (!imgEl || pool.length === 0) return;

    const nextUrl = pool[slideCursors[poolIndex] % pool.length];
    if (imgEl.src !== nextUrl) {
      imgEl.style.opacity = '0.35';
      setTimeout(() => {
        imgEl.src = nextUrl;
        imgEl.style.opacity = '1';
      }, 180);
    }
  };

  // Initialize immediately if local src/gallery1..3 folders exist
  [0, 1, 2].forEach((idx) => {
    if (slidePools[idx].length > 0 && slideImgs[idx]) {
      slideImgs[idx]!.src = slidePools[idx][0];
    }
  });

  // Also load image URLs from /artworks.json (for public/gallery1, public/gallery2, public/gallery3)
  fetch('/artworks.json')
    .then((res) => res.json())
    .then((artworks: { gallery_id: string; image_url: string }[]) => {
      const idMap: Record<string, number> = {
        'Gallery 1': 0,
        'Gallery 2': 1,
        'Gallery 3': 2,
      };
      artworks.forEach((art) => {
        const idx = idMap[art.gallery_id];
        if (idx !== undefined && art.image_url && !slidePools[idx].includes(art.image_url)) {
          slidePools[idx].push(art.image_url);
        }
      });
      [0, 1, 2].forEach((idx) => {
        if (slidePools[idx].length > 0 && slideImgs[idx] && !slideImgs[idx]!.getAttribute('src')) {
          slideImgs[idx]!.src = slidePools[idx][0];
        }
      });
    })
    .catch(() => {});

  // Cycle slideshow images every 3.2 seconds
  slideshowTimer = setInterval(() => {
    [0, 1, 2].forEach((idx) => {
      if (slidePools[idx].length > 1) {
        slideCursors[idx] = (slideCursors[idx] + 1) % slidePools[idx].length;
        applySlideFrame(idx);
      }
    });
  }, 3200);

  let activeIndex = 1; // Center card starts on Modern Wing

  const updateCoverflowPositions = () => {
    cards.forEach((card, idx) => {
      card.classList.remove('is-center', 'is-left', 'is-right');
      if (idx === activeIndex) {
        card.classList.add('is-center');
      } else if (idx === (activeIndex + 2) % 3) {
        card.classList.add('is-left');
      } else {
        card.classList.add('is-right');
      }
    });

    if (activeTitleEl) activeTitleEl.innerText = galleryMeta[activeIndex].title;
    if (activeSubEl) activeSubEl.innerText = galleryMeta[activeIndex].sub;
  };

  cards.forEach((card, idx) => {
    card.onclick = (e) => {
      // Allow clicking side cards to bring them into center focus
      if (idx !== activeIndex && !(e.target as HTMLElement).closest('.explore-btn')) {
        activeIndex = idx;
        updateCoverflowPositions();
      }
    };
  });

  if (prevBtn) {
    prevBtn.onclick = () => {
      activeIndex = (activeIndex + 2) % 3;
      updateCoverflowPositions();
    };
  }

  if (nextBtn) {
    nextBtn.onclick = () => {
      activeIndex = (activeIndex + 1) % 3;
      updateCoverflowPositions();
    };
  }

  if (welcomeSplash) welcomeSplash.classList.remove('hidden');
  if (gallerySelector) gallerySelector.classList.add('hidden');
  updateCoverflowPositions();

  if (enterBtn) {
    enterBtn.onclick = () => {
      welcomeSplash?.classList.add('hidden');
      gallerySelector?.classList.remove('hidden');
      updateCoverflowPositions();
    };
  }

  const triggerGreeting = () => {
    avatar?.play('standing_idle');
  };

  return {
    update: (delta: number) => {
      avatar?.update(delta);
    },
    cleanup: () => {
      if (slideshowTimer) {
        clearInterval(slideshowTimer);
        slideshowTimer = null;
      }
      receptionObjects.forEach((obj) => scene.remove(obj));
      receptionObjects.length = 0;
      scene.fog = previousFog;
      scene.background = previousBackground;
    },
    triggerGreeting,
  };
}
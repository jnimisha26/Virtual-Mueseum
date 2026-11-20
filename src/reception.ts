import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { AvatarController } from './AvatarController';

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
  playDoorTransition: (onComplete: () => void) => void;
}

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

  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, dropLength, 12), goldMat);
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

function createGalleryDoubleDoors(
  woodMat: THREE.Material,
  goldMat: THREE.Material
): {
  portalGroup: THREE.Group;
  leftDoorPivot: THREE.Group;
  rightDoorPivot: THREE.Group;
} {
  const portalGroup = new THREE.Group();
  const doorWidth = 0.82;
  const doorHeight = 2.65;
  const totalWidth = doorWidth * 2;

  const topHeader = new THREE.Mesh(new THREE.BoxGeometry(totalWidth + 0.34, 0.18, 0.18), goldMat);
  topHeader.position.set(0, doorHeight + 0.09, 0);
  portalGroup.add(topHeader);

  [-totalWidth / 2 - 0.09, totalWidth / 2 + 0.09].forEach((px) => {
    const pilaster = new THREE.Mesh(new THREE.BoxGeometry(0.16, doorHeight, 0.16), goldMat);
    pilaster.position.set(px, doorHeight / 2, 0);
    portalGroup.add(pilaster);
  });

  const glowBackdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(totalWidth, doorHeight),
    new THREE.MeshBasicMaterial({ color: 0xffe8c2 })
  );
  glowBackdrop.position.set(0, doorHeight / 2, -0.02);
  portalGroup.add(glowBackdrop);

  const buildDoorLeaf = (isLeft: boolean) => {
    const pivot = new THREE.Group();
    pivot.position.set(isLeft ? -totalWidth / 2 : totalWidth / 2, 0, 0.04);

    const leafOffset = isLeft ? doorWidth / 2 : -doorWidth / 2;

    const leaf = new THREE.Mesh(new THREE.BoxGeometry(doorWidth - 0.02, doorHeight, 0.07), woodMat);
    leaf.position.set(leafOffset, doorHeight / 2, 0);
    leaf.castShadow = true;
    pivot.add(leaf);

    const panelTrim = new THREE.Mesh(
      new THREE.BoxGeometry(doorWidth - 0.24, doorHeight - 0.38, 0.082),
      goldMat
    );
    panelTrim.position.set(leafOffset, doorHeight / 2, 0);
    pivot.add(panelTrim);

    const innerPanel = new THREE.Mesh(
      new THREE.BoxGeometry(doorWidth - 0.3, doorHeight - 0.44, 0.088),
      woodMat
    );
    innerPanel.position.set(leafOffset, doorHeight / 2, 0);
    pivot.add(innerPanel);

    const handleX = isLeft ? doorWidth - 0.14 : -doorWidth + 0.14;
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.36, 12), goldMat);
    handle.position.set(handleX, 1.15, 0.06);
    pivot.add(handle);

    return pivot;
  };

  const leftDoorPivot = buildDoorLeaf(true);
  const rightDoorPivot = buildDoorLeaf(false);
  portalGroup.add(leftDoorPivot);
  portalGroup.add(rightDoorPivot);

  return { portalGroup, leftDoorPivot, rightDoorPivot };
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
  let doorAnimFrame: number | null = null;

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

  const floorMat = new THREE.MeshStandardMaterial({
    map: createCreamFloorTexture(),
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

  const wallMat = new THREE.MeshStandardMaterial({
    map: createPlumPlasterTexture(),
    roughness: 0.72,
    metalness: 0.05,
  });

  const deskSlattedMat = new THREE.MeshStandardMaterial({
    map: createDarkChocolateTexture(),
    roughness: 0.38,
    metalness: 0.08,
  });

  const deskSolidMat = new THREE.MeshStandardMaterial({
    color: 0x49352f,
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
    emissiveIntensity: 1.45,
    roughness: 0.25,
  });

  const lampShadeMat = new THREE.MeshStandardMaterial({
    color: 0xe5d6c5,
    emissive: 0xffd7ba,
    emissiveIntensity: 0.75,
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

  // 2. Central Reception Board Plaque & Double Gallery Doors
  const boardBacking = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.82, 0.05), goldMat);
  boardBacking.position.set(-1.35, 2.82, -4.42);
  addObj(boardBacking, true, false);

  const boardFace = new THREE.Mesh(
    new THREE.PlaneGeometry(3.02, 0.74),
    new THREE.MeshStandardMaterial({
      map: createReceptionBoardTexture(),
      roughness: 0.45,
      metalness: 0.15,
    })
  );
  boardFace.position.set(-1.35, 2.82, -4.39);
  addObj(boardFace);

  const doorX = 2.45;
  const doorZ = -4.42;
  const { portalGroup, leftDoorPivot, rightDoorPivot } = createGalleryDoubleDoors(
    deskSolidMat,
    goldMat
  );
  portalGroup.position.set(doorX, 0, doorZ);
  addObj(portalGroup);

  // 3. Aesthetic Hanging Pendant Fixtures (Emissive globes — zero extra dynamic PointLights)
  const deskPendantConfigs = [
    { x: -1.4, z: -2.05, drop: 0.95 },
    { x: -0.45, z: -2.05, drop: 0.72 },
    { x: 0.5, z: -2.05, drop: 0.95 },
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
  });

  [-3.45, 3.75].forEach((xPos) => {
    const loungePendant = createHangingPendant(
      wallHeight,
      1.18,
      goldMat,
      ceilingBeamMat,
      pendantGlobeMat
    );
    loungePendant.position.set(xPos, 0, -0.75);
    addObj(loungePendant);
  });

  // 4. Dark Chocolate Reception Desk
  const deskGroup = new THREE.Group();
  deskGroup.position.set(-0.45, 0, -2.05);

  const plinth = new THREE.Mesh(new THREE.BoxGeometry(2.85, 0.1, 0.72), goldMat);
  plinth.position.set(0, 0.05, 0);
  plinth.castShadow = true;
  deskGroup.add(plinth);

  const deskBody = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.92, 0.82), deskSlattedMat);
  deskBody.position.set(0, 0.56, 0);
  deskBody.castShadow = true;
  deskBody.receiveShadow = true;
  deskGroup.add(deskBody);

  const counterTop = new THREE.Mesh(new THREE.BoxGeometry(3.18, 0.07, 0.98), deskSolidMat);
  counterTop.position.set(0, 1.055, 0.02);
  counterTop.castShadow = true;
  counterTop.receiveShadow = true;
  deskGroup.add(counterTop);

  const goldReveal = new THREE.Mesh(new THREE.BoxGeometry(3.04, 0.025, 0.85), goldMat);
  goldReveal.position.set(0, 1.01, 0);
  deskGroup.add(goldReveal);

  const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.025, 24), goldMat);
  lampBase.position.set(1.1, 1.1, 0.12);
  deskGroup.add(lampBase);

  const lampStem = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.34, 12), goldMat);
  lampStem.position.set(1.1, 1.27, 0.12);
  deskGroup.add(lampStem);

  const lampShade = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.14, 0.12, 24), goldMat);
  lampShade.position.set(1.1, 1.44, 0.12);
  deskGroup.add(lampShade);

  const vaseMat = new THREE.MeshStandardMaterial({ color: 0xf2d3c9, roughness: 0.3 });
  const vase = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 0.24, 24), vaseMat);
  vase.position.set(-1.12, 1.21, 0.1);
  vase.castShadow = true;
  deskGroup.add(vase);

  addObj(deskGroup);

  // 5. Visitor Lounge Seating Areas
  const leftChair = createSofaChair(chairUpholsteryMat, deskSolidMat, goldMat);
  leftChair.position.set(-3.45, 0, -0.65);
  leftChair.rotation.y = Math.PI / 2.4;
  addObj(leftChair);

  const leftSideTable = createAccentTable(deskSolidMat, goldMat);
  leftSideTable.position.set(-3.5, 0, -1.45);
  addObj(leftSideTable);

  const leftFloorLamp = createFloorLamp(goldMat, deskSolidMat, lampShadeMat);
  leftFloorLamp.position.set(-4.25, 0, -1.35);
  addObj(leftFloorLamp);

  const rightChair = createSofaChair(chairUpholsteryMat, deskSolidMat, goldMat);
  rightChair.position.set(3.85, 0, -0.65);
  rightChair.rotation.y = -Math.PI / 2.4;
  addObj(rightChair);

  const rightSideTable = createAccentTable(deskSolidMat, goldMat);
  rightSideTable.position.set(3.9, 0, -1.45);
  addObj(rightSideTable);

  const rightFloorLamp = createFloorLamp(goldMat, deskSolidMat, lampShadeMat);
  rightFloorLamp.position.set(4.45, 0, -1.35);
  addObj(rightFloorLamp);

  // 6. Streamlined 3-Light Reception Rig (Clean & Fast)
  const lobbyAmbient = new THREE.HemisphereLight(0xffe9dc, 0xe5d6c5, 1.45);
  addObj(lobbyAmbient);

  const boardSpot = new THREE.SpotLight(0xffe9dc, 9.0, 10, Math.PI / 4, 0.65, 1);
  boardSpot.position.set(-1.35, 3.65, -2.5);
  boardSpot.target.position.set(-1.35, 2.6, -4.35);
  addObj(boardSpot);
  addObj(boardSpot.target);

  const curatorSpot = new THREE.SpotLight(0xfff0e6, 10.5, 12, Math.PI / 3.2, 0.55, 1);
  curatorSpot.position.set(0.6, 3.55, -0.2);
  curatorSpot.target.position.set(-0.45, 1.25, -2.95);
  curatorSpot.castShadow = true;
  curatorSpot.shadow.mapSize.set(1024, 1024);
  curatorSpot.shadow.bias = -0.0005;
  addObj(curatorSpot);
  addObj(curatorSpot.target);

  // 7. Spawn Receptionist Behind Desk — Strictly Idle
  const receptionist = SkeletonUtils.clone(gltfScene) as THREE.Group;
  receptionist.position.set(-0.45, 0, -2.95);
  receptionist.lookAt(-0.45, 0, 1.8);
  receptionist.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  addObj(receptionist);

  const avatar = animations.length > 0 ? new AvatarController(receptionist, animations) : null;
  avatar?.play('standing_idle');

  camera.rotation.order = 'YXZ';
  camera.position.set(0, 1.66, 2.15);
  camera.lookAt(0.25, 1.44, -2.35);

  // 8. Coverflow Carousel + Gallery Slideshow Logic
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

  [0, 1, 2].forEach((idx) => {
    if (slidePools[idx].length > 0 && slideImgs[idx]) {
      slideImgs[idx]!.src = slidePools[idx][0];
    }
  });

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

  slideshowTimer = setInterval(() => {
    [0, 1, 2].forEach((idx) => {
      if (slidePools[idx].length > 1) {
        slideCursors[idx] = (slideCursors[idx] + 1) % slidePools[idx].length;
        applySlideFrame(idx);
      }
    });
  }, 3200);

  let activeIndex = 1;

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

  const playDoorTransition = (onComplete: () => void) => {
    const startPos = camera.position.clone();
    const endPos = new THREE.Vector3(doorX, 1.62, doorZ + 0.55);
    const startQuat = camera.quaternion.clone();

    const targetLookMatrix = new THREE.Matrix4().lookAt(
      endPos,
      new THREE.Vector3(doorX, 1.55, doorZ - 1.5),
      new THREE.Vector3(0, 1, 0)
    );
    const endQuat = new THREE.Quaternion().setFromRotationMatrix(targetLookMatrix);

    const durationMs = 1150;
    const startTime = performance.now();

    const stepTransition = (now: number) => {
      const rawT = Math.min(1, (now - startTime) / durationMs);
      const ease = rawT < 0.5 ? 4 * rawT * rawT * rawT : 1 - Math.pow(-2 * rawT + 2, 3) / 2;

      camera.position.lerpVectors(startPos, endPos, ease);
      camera.quaternion.slerpQuaternions(startQuat, endQuat, Math.min(1, ease * 1.25));

      const doorAngle = ease * (Math.PI * 0.52);
      leftDoorPivot.rotation.y = doorAngle;
      rightDoorPivot.rotation.y = -doorAngle;

      if (rawT < 1) {
        doorAnimFrame = requestAnimationFrame(stepTransition);
      } else {
        doorAnimFrame = null;
        onComplete();
      }
    };

    doorAnimFrame = requestAnimationFrame(stepTransition);
  };

  return {
    update: (delta: number) => {
      avatar?.update(delta);
    },
    cleanup: () => {
      if (doorAnimFrame !== null) {
        cancelAnimationFrame(doorAnimFrame);
        doorAnimFrame = null;
      }
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
    playDoorTransition,
  };
}
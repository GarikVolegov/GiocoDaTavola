import * as THREE from 'three';

export type NexusVariant = 'host' | 'player' | 'landing' | 'dashboard';

export interface NexusState {
  variant: NexusVariant;
  phase: string;
  lean: number; // 0 (100% B) .. 50 (neutral) .. 100 (100% A)
  votedCount?: number;
  timerRemaining?: number | null;
  isRibaltone?: boolean;
  celebrate?: boolean;
}

export function isWebGLAvailable(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')),
    );
  } catch {
    return false;
  }
}

export class NexusScene {
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private disposed = false;
  private animationFrameId: number | null = null;
  private lastTime = 0;
  private startTime = 0;

  // Scene objects
  private starPoints: THREE.Points | null = null;
  private pathA: THREE.Mesh | null = null;
  private pathAFloor: THREE.Mesh | null = null;
  private pathB: THREE.Mesh | null = null;
  private pathBFloor: THREE.Mesh | null = null;
  private centralMonolith: THREE.Mesh | null = null;
  private innerMonolith: THREE.Mesh | null = null;
  private orbitalRing1: THREE.Mesh | null = null;
  private orbitalRing2: THREE.Mesh | null = null;
  private spireA: THREE.Mesh | null = null;
  private spireB: THREE.Mesh | null = null;
  private lightA: THREE.PointLight | null = null;
  private lightB: THREE.PointLight | null = null;
  private goldLight: THREE.PointLight | null = null;
  private shockwaveRing: THREE.Mesh | null = null;
  private celebratoryVortex: THREE.Points | null = null;

  // Camera targets for smooth cinematic lerp
  private targetCamPos = new THREE.Vector3(0, 1.2, 9);
  private targetCamRot = new THREE.Euler(0, 0, 0);
  private currentLean = 50;
  private targetLean = 50;
  private shockwaveScale = 0;
  private shockwaveActive = false;

  private state: NexusState = {
    variant: 'host',
    phase: 'LOBBY',
    lean: 50,
  };

  constructor(canvas: HTMLCanvasElement, initialState: Partial<NexusState> = {}) {
    this.canvas = canvas;
    this.state = { ...this.state, ...initialState };
    this.currentLean = this.state.lean;
    this.targetLean = this.state.lean;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x070a14, 0.03);

    const aspect = canvas.clientWidth / (canvas.clientHeight || 1);
    this.camera = new THREE.PerspectiveCamera(54, aspect, 0.1, 220);
    this.camera.position.set(0, 1.2, 9.2);

    if (!isWebGLAvailable()) {
      return;
    }

    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
      });
      const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 2);
      this.renderer.setPixelRatio(dpr);
      this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
      this.renderer.setClearColor(0x070a14, 0);

      this.buildCosmos();
      this.buildPathways();
      this.buildMonoliths();
      this.buildLights();
      this.buildShockwave();
      this.buildCelebration();

      this.onResize = this.onResize.bind(this);
      window.addEventListener('resize', this.onResize);

      this.applyPhase(this.state.phase);
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      this.startTime = now;
      this.lastTime = now;
      this.renderLoop();
    } catch (e) {
      console.warn('[Nexus3D] WebGL init fallback:', e);
    }
  }

  public updateState(next: Partial<NexusState>): void {
    const prevPhase = this.state.phase;
    this.state = { ...this.state, ...next };

    if (next.lean !== undefined) {
      this.targetLean = Math.max(0, Math.min(100, next.lean));
    }

    if (next.phase && next.phase !== prevPhase) {
      this.applyPhase(next.phase);
    }

    if (next.isRibaltone) {
      this.triggerShockwave();
    }
  }

  private applyPhase(phase: string): void {
    const isPlayer = this.state.variant === 'player';
    const intensity = isPlayer ? 0.5 : 1.0;

    switch (phase) {
      case 'LOBBY':
        if (this.state.variant === 'landing') {
          this.targetCamPos.set(0, 0.9, 10.2);
          this.targetCamRot.set(0.04, 0, 0);
        } else if (this.state.variant === 'dashboard') {
          this.targetCamPos.set(0, 1.3, 9.6);
          this.targetCamRot.set(0.05, 0, 0);
        } else {
          this.targetCamPos.set(0, 1.4, 9.5);
          this.targetCamRot.set(-0.04, 0, 0);
        }
        break;

      case 'DILEMMA_REVEAL':
        this.targetCamPos.set(0, 0.65, 7.2);
        this.targetCamRot.set(0.06, 0, 0);
        break;

      case 'VOTE_1':
      case 'VOTE_2':
        this.targetCamPos.set(0, 0.35, 6.0);
        this.targetCamRot.set(0.09, 0, 0);
        break;

      case 'SPLIT_REVEAL':
      case 'UNANIMOUS_REVEAL': {
        const leanFactor = (this.targetLean - 50) / 50; // -1 (B) .. +1 (A)
        this.targetCamPos.set(-leanFactor * 2.8 * intensity, 0.9, 6.8);
        this.targetCamRot.set(0.06, leanFactor * 0.32 * intensity, -leanFactor * 0.12 * intensity);
        break;
      }

      case 'DEFENSE':
      case 'INTERVENTI':
      case 'DUO_ARGUE':
        this.targetCamPos.set(0, 0.15, 5.5);
        this.targetCamRot.set(0.14, 0, 0);
        break;

      case 'PHASE_RESULTS':
        this.targetCamPos.set(0, 1.1, 7.8);
        this.targetCamRot.set(0, 0, 0);
        break;

      case 'FINAL_AWARDS':
      case 'DUO_PORTRAIT':
        this.targetCamPos.set(0, 2.6, 10.8);
        this.targetCamRot.set(-0.16, 0, 0);
        break;

      default:
        this.targetCamPos.set(0, 1.0, 8.5);
        this.targetCamRot.set(0, 0, 0);
        break;
    }
  }

  public triggerShockwave(): void {
    this.shockwaveActive = true;
    this.shockwaveScale = 0.1;
  }

  private buildCosmos(): void {
    const starCount = this.state.variant === 'host' ? 1100 : 450;
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);

    const colSapphire = new THREE.Color(0x3e82fc);
    const colAmber = new THREE.Color(0xf56c38);
    const colGold = new THREE.Color(0xe5c158);
    const colWhite = new THREE.Color(0xffffff);

    for (let i = 0; i < starCount; i++) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * 65;
      positions[i3 + 1] = (Math.random() - 0.25) * 45;
      positions[i3 + 2] = -Math.random() * 55;

      const pick = Math.random();
      const col =
        pick < 0.35
          ? colSapphire
          : pick < 0.65
            ? colAmber
            : pick < 0.88
              ? colGold
              : colWhite;
      colors[i3] = col.r;
      colors[i3 + 1] = col.g;
      colors[i3 + 2] = col.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.22,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
    });

    this.starPoints = new THREE.Points(geo, mat);
    this.scene.add(this.starPoints);
  }

  private buildPathways(): void {
    // Path A: angled left into infinity — subtle ethereal perspective guides
    const pathGeoA = new THREE.PlaneGeometry(3.8, 50, 1, 26);
    const pathMatA = new THREE.MeshBasicMaterial({
      color: 0x3e82fc,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      wireframe: true,
    });
    this.pathA = new THREE.Mesh(pathGeoA, pathMatA);
    this.pathA.rotation.x = -Math.PI / 2 + 0.08;
    this.pathA.rotation.z = 0.28;
    this.pathA.position.set(-7.0, -2.1, -14);
    this.scene.add(this.pathA);

    // Glowing translucent floor plane under Path A
    const floorMatA = new THREE.MeshBasicMaterial({
      color: 0x2566ea,
      transparent: true,
      opacity: 0.12,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    this.pathAFloor = new THREE.Mesh(pathGeoA, floorMatA);
    this.pathAFloor.rotation.copy(this.pathA.rotation);
    this.pathAFloor.position.copy(this.pathA.position);
    this.pathAFloor.position.y -= 0.02;
    this.scene.add(this.pathAFloor);

    // Path B: angled right into infinity — subtle ethereal perspective guides
    const pathGeoB = new THREE.PlaneGeometry(3.8, 50, 1, 26);
    const pathMatB = new THREE.MeshBasicMaterial({
      color: 0xf56c38,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      wireframe: true,
    });
    this.pathB = new THREE.Mesh(pathGeoB, pathMatB);
    this.pathB.rotation.x = -Math.PI / 2 + 0.08;
    this.pathB.rotation.z = -0.28;
    this.pathB.position.set(7.0, -2.1, -14);
    this.scene.add(this.pathB);

    // Glowing translucent floor plane under Path B
    const floorMatB = new THREE.MeshBasicMaterial({
      color: 0xd84518,
      transparent: true,
      opacity: 0.12,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    this.pathBFloor = new THREE.Mesh(pathGeoB, floorMatB);
    this.pathBFloor.rotation.copy(this.pathB.rotation);
    this.pathBFloor.position.copy(this.pathB.position);
    this.pathBFloor.position.y -= 0.02;
    this.scene.add(this.pathBFloor);
  }

  private buildMonoliths(): void {
    // Central Obelisk at the Crossroads (Outer wireframe crystal)
    const monoGeo = new THREE.OctahedronGeometry(1.8, 0);
    const monoMat = new THREE.MeshBasicMaterial({
      color: 0xe5c158,
      wireframe: true,
      transparent: true,
      opacity: 0.6,
    });
    this.centralMonolith = new THREE.Mesh(monoGeo, monoMat);
    this.centralMonolith.position.set(0, 1.2, -18);
    this.centralMonolith.scale.set(0.9, 2.4, 0.9);
    this.scene.add(this.centralMonolith);

    // Inner glowing crystal core
    const innerGeo = new THREE.OctahedronGeometry(1.2, 0);
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0xffd970,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
    });
    this.innerMonolith = new THREE.Mesh(innerGeo, innerMat);
    this.innerMonolith.position.copy(this.centralMonolith.position);
    this.innerMonolith.scale.set(0.7, 2.0, 0.7);
    this.scene.add(this.innerMonolith);

    // Primary orbital energy ring
    const ringGeo1 = new THREE.TorusGeometry(3.5, 0.045, 8, 48);
    const ringMat1 = new THREE.MeshBasicMaterial({
      color: 0xe5c158,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
    });
    this.orbitalRing1 = new THREE.Mesh(ringGeo1, ringMat1);
    this.orbitalRing1.position.copy(this.centralMonolith.position);
    this.orbitalRing1.rotation.x = Math.PI / 3;
    this.scene.add(this.orbitalRing1);

    // Secondary counter-rotating energy ring
    const ringGeo2 = new THREE.TorusGeometry(2.4, 0.035, 8, 40);
    const ringMat2 = new THREE.MeshBasicMaterial({
      color: 0x3e82fc,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
    });
    this.orbitalRing2 = new THREE.Mesh(ringGeo2, ringMat2);
    this.orbitalRing2.position.copy(this.centralMonolith.position);
    this.orbitalRing2.rotation.x = -Math.PI / 4;
    this.orbitalRing2.rotation.y = Math.PI / 6;
    this.scene.add(this.orbitalRing2);

    // Distant side spires
    const spireGeo = new THREE.ConeGeometry(0.8, 6, 4);
    const spireMatA = new THREE.MeshBasicMaterial({
      color: 0x3e82fc,
      wireframe: true,
      transparent: true,
      opacity: 0.35,
    });
    this.spireA = new THREE.Mesh(spireGeo, spireMatA);
    this.spireA.position.set(-11, 0, -28);
    this.scene.add(this.spireA);

    const spireMatB = new THREE.MeshBasicMaterial({
      color: 0xf56c38,
      wireframe: true,
      transparent: true,
      opacity: 0.35,
    });
    this.spireB = new THREE.Mesh(spireGeo, spireMatB);
    this.spireB.position.set(11, 0, -28);
    this.scene.add(this.spireB);
  }

  private buildLights(): void {
    const ambient = new THREE.AmbientLight(0x070a14, 1.8);
    this.scene.add(ambient);

    this.lightA = new THREE.PointLight(0x3e82fc, 2.8, 35);
    this.lightA.position.set(-9, 2.5, -6);
    this.scene.add(this.lightA);

    this.lightB = new THREE.PointLight(0xf56c38, 2.8, 35);
    this.lightB.position.set(9, 2.5, -6);
    this.scene.add(this.lightB);

    this.goldLight = new THREE.PointLight(0xe5c158, 2.4, 40);
    this.goldLight.position.set(0, 3.5, -17);
    this.scene.add(this.goldLight);
  }

  private buildShockwave(): void {
    const shockGeo = new THREE.RingGeometry(0.8, 1.4, 36);
    const shockMat = new THREE.MeshBasicMaterial({
      color: 0xe5c158,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    this.shockwaveRing = new THREE.Mesh(shockGeo, shockMat);
    this.shockwaveRing.rotation.x = -Math.PI / 2;
    this.shockwaveRing.position.set(0, -1.75, -12);
    this.scene.add(this.shockwaveRing);
  }

  private buildCelebration(): void {
    const count = 160;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const angle = (i / count) * Math.PI * 8;
      const radius = 0.4 + (i / count) * 5.2;
      positions[i3] = Math.cos(angle) * radius;
      positions[i3 + 1] = (i / count) * 14 - 2;
      positions[i3 + 2] = -16 + Math.sin(angle) * radius;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xe5c158,
      size: 0.4,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
    });
    this.celebratoryVortex = new THREE.Points(geo, mat);
    this.scene.add(this.celebratoryVortex);
  }

  private onResize(): void {
    if (!this.renderer || this.disposed) return;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight || 1;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  private renderLoop(): void {
    if (this.disposed || !this.renderer) return;

    this.animationFrameId = requestAnimationFrame(() => this.renderLoop());

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const delta = Math.min((now - this.lastTime) / 1000, 0.1);
    const elapsed = (now - this.startTime) / 1000;
    this.lastTime = now;

    // Smooth lean interpolation
    this.currentLean += (this.targetLean - this.currentLean) * 0.055;
    const leanFraction = this.currentLean / 100; // 0 (full B) .. 1 (full A)

    // Smooth camera lerp
    this.camera.position.lerp(this.targetCamPos, 0.045);
    this.camera.rotation.x += (this.targetCamRot.x - this.camera.rotation.x) * 0.045;
    this.camera.rotation.y += (this.targetCamRot.y - this.camera.rotation.y) * 0.045;
    this.camera.rotation.z += (this.targetCamRot.z - this.camera.rotation.z) * 0.045;

    // Subtle ambient breathing motion
    const breathY = Math.sin(elapsed * 0.75) * 0.07;
    const breathRot = Math.cos(elapsed * 0.45) * 0.007;
    this.camera.position.y += breathY * 0.1;
    this.camera.rotation.y += breathRot * 0.1;

    // React path opacities to lean
    if (this.pathA && this.pathB && this.pathAFloor && this.pathBFloor) {
      const matA = this.pathA.material as THREE.MeshBasicMaterial;
      const matB = this.pathB.material as THREE.MeshBasicMaterial;
      const floorA = this.pathAFloor.material as THREE.MeshBasicMaterial;
      const floorB = this.pathBFloor.material as THREE.MeshBasicMaterial;

      const baseOpacity = this.state.variant === 'host' ? 0.42 : 0.22;
      matA.opacity = baseOpacity * (0.35 + leanFraction * 1.3);
      matB.opacity = baseOpacity * (0.35 + (1 - leanFraction) * 1.3);
      floorA.opacity = baseOpacity * 0.6 * (0.35 + leanFraction * 1.3);
      floorB.opacity = baseOpacity * 0.6 * (0.35 + (1 - leanFraction) * 1.3);

      // Subtle wave floating
      this.pathA.position.y = -1.8 + Math.sin(elapsed * 1.4) * 0.03;
      this.pathB.position.y = -1.8 + Math.cos(elapsed * 1.4) * 0.03;
      this.pathAFloor.position.y = this.pathA.position.y - 0.02;
      this.pathBFloor.position.y = this.pathB.position.y - 0.02;
    }

    // Light intensities responding to lean and tension
    if (this.lightA && this.lightB) {
      this.lightA.intensity = 1.4 + leanFraction * 2.8;
      this.lightB.intensity = 1.4 + (1 - leanFraction) * 2.8;
    }

    // Monoliths rotation
    if (this.centralMonolith && this.innerMonolith) {
      this.centralMonolith.rotation.y = elapsed * 0.32;
      this.centralMonolith.rotation.z = Math.sin(elapsed * 0.45) * 0.06;
      this.innerMonolith.rotation.y = -elapsed * 0.45;
    }
    if (this.orbitalRing1) {
      this.orbitalRing1.rotation.z = -elapsed * 0.28;
      this.orbitalRing1.rotation.x = Math.PI / 3 + Math.cos(elapsed * 0.35) * 0.08;
    }
    if (this.orbitalRing2) {
      this.orbitalRing2.rotation.z = elapsed * 0.4;
      this.orbitalRing2.rotation.y = Math.sin(elapsed * 0.3) * 0.2;
    }
    if (this.spireA && this.spireB) {
      this.spireA.rotation.y = elapsed * 0.2;
      this.spireB.rotation.y = -elapsed * 0.2;
    }

    // Star rotation
    if (this.starPoints) {
      this.starPoints.rotation.y = elapsed * 0.012;
      this.starPoints.rotation.x = Math.sin(elapsed * 0.008) * 0.02;
    }

    // Shockwave animation
    if (this.shockwaveActive && this.shockwaveRing) {
      this.shockwaveScale += delta * 18;
      this.shockwaveRing.scale.set(this.shockwaveScale, this.shockwaveScale, 1);
      const shockMat = this.shockwaveRing.material as THREE.MeshBasicMaterial;
      shockMat.opacity = Math.max(0, 1 - this.shockwaveScale / 20);
      if (this.shockwaveScale >= 20) {
        this.shockwaveActive = false;
        shockMat.opacity = 0;
      }
    }

    // Celebration vortex
    if (this.celebratoryVortex) {
      const isCelebrationPhase =
        this.state.phase === 'FINAL_AWARDS' ||
        this.state.phase === 'UNANIMOUS_REVEAL' ||
        this.state.celebrate === true;
      const vortexMat = this.celebratoryVortex.material as THREE.PointsMaterial;
      const targetOpacity = isCelebrationPhase ? (this.state.variant === 'host' ? 0.85 : 0.45) : 0;
      vortexMat.opacity += (targetOpacity - vortexMat.opacity) * 0.05;
      this.celebratoryVortex.rotation.y = elapsed * 0.85;
    }

    this.renderer.render(this.scene, this.camera);
  }

  public destroy(): void {
    this.disposed = true;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this.onResize);
    }
    this.scene.clear();
    this.renderer?.dispose();
    this.renderer = null;
  }
}

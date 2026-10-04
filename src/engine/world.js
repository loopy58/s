// 렌더러·카메라·조명·하늘을 관리합니다.
import * as THREE from 'three';

export const IS_TOUCH = typeof window !== 'undefined' && (('ontouchstart' in window) || navigator.maxTouchPoints > 0) && matchMedia('(pointer: coarse)').matches;

export class World {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, IS_TOUCH ? 1.5 : 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.5, 900);
    this.camera.position.set(0, 14, 30);

    this.hemi = new THREE.HemisphereLight('#dbeaff', '#8aa07a', 1.6);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff4e0', 2.2);
    this.sun.castShadow = true;
    const sh = this.sun.shadow;
    sh.mapSize.set(IS_TOUCH ? 1024 : 2048, IS_TOUCH ? 1024 : 2048);
    sh.camera.left = -30;
    sh.camera.right = 30;
    sh.camera.top = 30;
    sh.camera.bottom = -30;
    sh.camera.near = 1;
    sh.camera.far = 120;
    sh.bias = -0.0006;
    sh.normalBias = 0.03;
    this.scene.add(this.sun, this.sun.target);
    this.sunOffset = new THREE.Vector3(-22, 40, 18);

    this.skyUniforms = { top: { value: new THREE.Color('#8ec5ff') }, bottom: { value: new THREE.Color('#e6f4ff') } };
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(700, 32, 16),
      new THREE.ShaderMaterial({
        uniforms: this.skyUniforms,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: `uniform vec3 top;
uniform vec3 bottom;
varying vec3 vP;
void main() {
  float h = clamp(vP.y * 1.6 + 0.15, 0.0, 1.0);
  gl_FragColor = vec4(mix(bottom, top, pow(h, 0.8)), 1.0);
  #include <colorspace_fragment>
}`,
      }),
    );
    sky.renderOrder = -1;
    sky.frustumCulled = false;
    this.sky = sky;
    this.scene.add(sky);
    this.scene.fog = new THREE.Fog('#e6f4ff', 70, 320);

    this.camTarget = new THREE.Vector3();
    this.camOffset = new THREE.Vector3(0, 10.5, 13.5);
    this.zoom = 1;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  setTheme(t) {
    this.skyUniforms.top.value.set(t.sky[0]);
    this.skyUniforms.bottom.value.set(t.sky[1]);
    this.scene.fog.color.set(t.fog);
    this.hemi.color.set(t.hemiSky);
    this.hemi.groundColor.set(t.hemiGround);
    this.sun.color.set(t.sun);
    this.sun.intensity = 2.0 * (t.sunI || 1);
    this.hemi.intensity = 1.5;
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // 세로 화면에서는 시야를 넓히고 카메라를 조금 더 뒤로 뺍니다.
    this.camera.fov = w < h ? 50 : 38;
    this.portraitScale = w < h ? 1.32 : 1;
    this.camera.updateProjectionMatrix();
  }

  follow(target, dt, snap = false) {
    this.camTarget.lerp(target, snap ? 1 : 1 - Math.pow(0.0008, dt));
    const off = this.camOffset.clone().multiplyScalar(this.zoom * (this.portraitScale || 1));
    const desired = this.camTarget.clone().add(off);
    if (snap) this.camera.position.copy(desired);
    else this.camera.position.lerp(desired, 1 - Math.pow(0.002, dt));
    this.camera.lookAt(this.camTarget.x, this.camTarget.y + 1.1, this.camTarget.z);
    this.sun.position.copy(this.camTarget).add(this.sunOffset);
    this.sun.target.position.copy(this.camTarget);
    this.sky.position.copy(this.camera.position);
  }

  render(scene = this.scene, camera = this.camera) {
    this.renderer.render(scene, camera);
  }
}

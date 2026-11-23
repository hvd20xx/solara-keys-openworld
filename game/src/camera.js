// Smooth spring-damped 3rd-person follow camera (on-foot, high-speed driving, panorama) with dynamic FOV & shake.

const THREE = window.THREE;

export class FollowCamera {
  constructor(camera) {
    this.camera = camera;
    this.pos = new THREE.Vector3(180, 14, 34);
    this.lookTarget = new THREE.Vector3(180, 2, 0);
    this.orbitYaw = 0;
    this.locked = false;
    this.panoramaAngle = 0.65;
  }

  snapTo(pos, lookAt, fov = 62) {
    this.pos.set(pos.x, pos.y, pos.z);
    this.lookTarget.set(lookAt.x, lookAt.y, lookAt.z);
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.lookTarget);
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
  }

  updatePanorama(dt) {
    this.panoramaAngle += dt * 0.14;
    const cx = 112;
    const cz = 18;
    const r = 108;
    const px = cx + Math.cos(this.panoramaAngle) * r;
    const pz = cz + Math.sin(this.panoramaAngle) * r;
    this.snapTo({ x: px, y: 42, z: pz }, { x: 54, y: 14, z: -12 }, 58);
  }

  updateFollow(dt, target, shake = 0) {
    if (this.locked) return;

    const inCar = Boolean(target.inVehicle);
    const speed = target.speed || 0;
    const heading = target.heading + this.orbitYaw;
    const dist = inCar ? 10.8 + Math.min(3.5, speed * 0.08) : 7.6;
    const height = inCar ? 4.6 + Math.min(1.4, speed * 0.03) : 3.9;

    const desiredX = target.x - Math.sin(heading) * dist;
    const desiredZ = target.z - Math.cos(heading) * dist;
    const desiredY = height;

    const smooth = 1 - Math.exp(-(inCar ? 6.8 : 9.2) * dt);
    this.pos.x += (desiredX - this.pos.x) * smooth;
    this.pos.y += (desiredY - this.pos.y) * smooth;
    this.pos.z += (desiredZ - this.pos.z) * smooth;

    const ahead = inCar ? 5.2 + speed * 0.12 : 2.6;
    const lookX = target.x + Math.sin(target.heading) * ahead;
    const lookY = inCar ? 1.5 : 1.7;
    const lookZ = target.z + Math.cos(target.heading) * ahead;

    this.lookTarget.x += (lookX - this.lookTarget.x) * smooth;
    this.lookTarget.y += (lookY - this.lookTarget.y) * smooth;
    this.lookTarget.z += (lookZ - this.lookTarget.z) * smooth;

    const targetFov = inCar ? 60 + Math.min(16, speed * 0.36) : 58;
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 6);
    this.camera.updateProjectionMatrix();

    const sx = shake > 0.01 ? (Math.random() - 0.5) * shake * 1.1 : 0;
    const sy = shake > 0.01 ? (Math.random() - 0.5) * shake * 0.8 : 0;
    this.camera.position.set(this.pos.x + sx, this.pos.y + sy, this.pos.z);
    this.camera.lookAt(this.lookTarget);

    // Gently re-center manual yaw offset while driving
    if (inCar && Math.abs(this.orbitYaw) > 0.001) {
      this.orbitYaw *= Math.max(0, 1 - dt * 2.4);
    }
  }
}

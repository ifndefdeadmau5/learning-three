"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import GUI from "lil-gui";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

function QuasarSimulation() {
  const el = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!el.current) {
      return;
    }

    el.current.innerHTML = "";

    // Canvas & Renderer
    const canvas = el.current;
    const renderer = new THREE.WebGLRenderer({ canvas });
    const scene = new THREE.Scene();

    // GUI for debugging
    const gui = new GUI({ width: 300, title: "Quasar Simulation" });

    // Sizes
    const sizes = { width: window.innerWidth, height: window.innerHeight };
    renderer.setSize(sizes.width, sizes.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Camera
    const camera = new THREE.PerspectiveCamera(
      75,
      sizes.width / sizes.height,
      0.1,
      100
    );
    camera.position.set(0, 5, 15);
    scene.add(camera);

    // Controls
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;

    // Resize handler
    window.addEventListener("resize", () => {
      sizes.width = window.innerWidth;
      sizes.height = window.innerHeight;

      camera.aspect = sizes.width / sizes.height;
      camera.updateProjectionMatrix();

      renderer.setSize(sizes.width, sizes.height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    });

    // Quasar Core
    const coreMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const coreGeometry = new THREE.SphereGeometry(1, 32, 32);
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    scene.add(core);

    // Core Glow
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0x99ccff,
      transparent: true,
      opacity: 0.5,
    });
    const glowGeometry = new THREE.SphereGeometry(1.5, 32, 32);
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    scene.add(glow);

    // Accretion Disk
    const diskParameters = {
      count: 10000,
      innerRadius: 2,
      outerRadius: 6,
      heightVariation: 0.1,
    };

    let diskGeometry: THREE.BufferGeometry | null = null;
    let diskMaterial: THREE.PointsMaterial | null = null;
    let disk: THREE.Points | null = null;

    const createAccretionDisk = () => {
      // Cleanup previous disk
      if (disk !== null) {
        diskGeometry?.dispose();
        diskMaterial?.dispose();
        scene.remove(disk);
      }

      // Create new geometry
      diskGeometry = new THREE.BufferGeometry();
      const positions = new Float32Array(diskParameters.count * 3);
      for (let i = 0; i < diskParameters.count; i++) {
        const angle = Math.random() * Math.PI * 2; // Random angle
        const radius =
          diskParameters.innerRadius +
          Math.random() *
            (diskParameters.outerRadius - diskParameters.innerRadius);
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const y = (Math.random() - 0.5) * diskParameters.heightVariation; // Slight vertical variation

        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;
      }

      diskGeometry.setAttribute(
        "position",
        new THREE.BufferAttribute(positions, 3)
      );

      // Create material
      diskMaterial = new THREE.PointsMaterial({
        size: 0.05,
        color: 0xffcc00,
        blending: THREE.AdditiveBlending,
        transparent: true,
      });

      // Create Points
      disk = new THREE.Points(diskGeometry, diskMaterial);
      scene.add(disk);
    };

    createAccretionDisk();

    gui
      .add(diskParameters, "count", 1000, 50000, 100)
      .onFinishChange(createAccretionDisk);
    gui
      .add(diskParameters, "innerRadius", 0.1, 10, 0.1)
      .onFinishChange(createAccretionDisk);
    gui
      .add(diskParameters, "outerRadius", 0.1, 20, 0.1)
      .onFinishChange(createAccretionDisk);
    gui
      .add(diskParameters, "heightVariation", 0, 1, 0.01)
      .onFinishChange(createAccretionDisk);

    // Animation Loop
    const clock = new THREE.Clock();
    const tick = () => {
      const elapsedTime = clock.getElapsedTime();

      // Rotate accretion disk
      if (disk) {
        disk.rotation.y = elapsedTime * 0.5; // Disk spins around Y-axis
      }

      // Rotate the core and glow
      core.rotation.y = elapsedTime * 0.5;
      glow.rotation.y = elapsedTime * 0.5;

      // Update controls
      controls.update();

      // Render
      renderer.render(scene, camera);

      // Next frame
      window.requestAnimationFrame(tick);
    };

    tick();

    return () => {
      gui.destroy();
    };
  }, []);

  return <canvas ref={el}></canvas>;
}

export default QuasarSimulation;

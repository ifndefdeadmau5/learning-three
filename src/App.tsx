"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import GUI from "lil-gui";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

function QuasarSimulation() {
  const el = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!el.current) return;

    el.current.innerHTML = "";

    const canvas = el.current;
    const renderer = new THREE.WebGLRenderer({ canvas });
    const scene = new THREE.Scene();
    const gui = new GUI({ width: 300, title: "Quasar Simulation" });

    const sizes = { width: window.innerWidth, height: window.innerHeight };
    renderer.setSize(sizes.width, sizes.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const camera = new THREE.PerspectiveCamera(
      75,
      sizes.width / sizes.height,
      0.1,
      100
    );
    camera.position.set(0, 5, 15);
    scene.add(camera);

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;

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

    const createAccretionDisk = () => {
      const diskGeometry = new THREE.BufferGeometry();
      const positions = new Float32Array(diskParameters.count * 3);
      for (let i = 0; i < diskParameters.count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius =
          diskParameters.innerRadius +
          Math.random() *
            (diskParameters.outerRadius - diskParameters.innerRadius);
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const y = (Math.random() - 0.5) * diskParameters.heightVariation;

        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;
      }
      diskGeometry.setAttribute(
        "position",
        new THREE.BufferAttribute(positions, 3)
      );

      const diskMaterial = new THREE.PointsMaterial({
        size: 0.05,
        color: 0xffcc00,
        blending: THREE.AdditiveBlending,
        transparent: true,
      });

      const disk = new THREE.Points(diskGeometry, diskMaterial);
      scene.add(disk);
      return disk;
    };

    createAccretionDisk();

    // Jet Streams
    const jetParameters = {
      count: 5000,
      radius: 1,
      height: 10,
      speed: 2,
    };

    let jetGeometry: THREE.BufferGeometry | null = null;
    let jetMaterial: THREE.PointsMaterial | null = null;
    let jets: THREE.Points | null = null;

    const createJetStreams = () => {
      if (jets !== null) {
        jetGeometry?.dispose();
        jetMaterial?.dispose();
        scene.remove(jets);
      }

      jetGeometry = new THREE.BufferGeometry();
      const positions = new Float32Array(jetParameters.count * 3);
      const velocities = new Float32Array(jetParameters.count); // Store velocities for animation

      for (let i = 0; i < jetParameters.count; i++) {
        const angle = Math.random() * Math.PI * 2; // Random angle for circular spread
        const radius = Math.random() * jetParameters.radius; // Spread around the core
        const heightDirection = Math.random() < 0.5 ? 1 : -1; // Decide upward or downward jet
        const height = heightDirection * Math.random() * jetParameters.height; // Height along Y-axis

        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const y = height; // Vertical position (up or down)

        positions[i * 3] = x; // X-coordinate
        positions[i * 3 + 1] = y; // Y-coordinate
        positions[i * 3 + 2] = z; // Z-coordinate

        velocities[i] =
          heightDirection * (Math.random() * jetParameters.speed + 0.5); // Random speed in the correct direction
      }

      jetGeometry.setAttribute(
        "position",
        new THREE.BufferAttribute(positions, 3)
      );
      jetGeometry.setAttribute(
        "velocity",
        new THREE.BufferAttribute(velocities, 1)
      );

      jetMaterial = new THREE.PointsMaterial({
        size: 0.05,
        color: 0x00ccff,
        blending: THREE.AdditiveBlending,
        transparent: true,
      });

      jets = new THREE.Points(jetGeometry, jetMaterial);
      scene.add(jets);
    };
    createJetStreams();

    gui
      .add(jetParameters, "count", 100, 10000, 100)
      .onFinishChange(createJetStreams);
    gui
      .add(jetParameters, "radius", 0.1, 5, 0.1)
      .onFinishChange(createJetStreams);
    gui
      .add(jetParameters, "height", 1, 20, 0.1)
      .onFinishChange(createJetStreams);
    gui.add(jetParameters, "speed", 0.1, 5, 0.1);

    // Animation Loop
    const clock = new THREE.Clock();
    const tick = () => {
      const elapsedTime = clock.getElapsedTime();

      // Animate Jets
      if (jets) {
        const positions = jetGeometry!.attributes.position
          .array as Float32Array;
        const velocities = jetGeometry!.attributes.velocity
          .array as Float32Array;

        for (let i = 0; i < positions.length; i += 3) {
          positions[i + 1] += velocities[i / 3] * 0.1; // Move particles along the y-axis

          // Reset particle position when it moves out of bounds
          if (positions[i + 1] > jetParameters.height) positions[i + 1] = 0;
          if (positions[i + 1] < -jetParameters.height) positions[i + 1] = 0;
        }
        jetGeometry!.attributes.position.needsUpdate = true;
      }

      // Rotate core and disk
      core.rotation.y = elapsedTime * 0.5;
      glow.rotation.y = elapsedTime * 0.5;

      controls.update();
      renderer.render(scene, camera);
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

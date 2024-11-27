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

    // Clear existing canvas
    el.current.innerHTML = "";

    // Canvas & Renderer
    const canvas = el.current;
    const renderer = new THREE.WebGLRenderer({
      canvas: canvas,
    });

    // Scene
    const scene = new THREE.Scene();

    // GUI for debugging and parameters
    const gui = new GUI({ width: 300, title: "Quasar Simulation" });

    // Sizes
    const sizes = {
      width: window.innerWidth,
      height: window.innerHeight,
    };

    renderer.setSize(sizes.width, sizes.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Resize listener
    window.addEventListener("resize", () => {
      sizes.width = window.innerWidth;
      sizes.height = window.innerHeight;

      camera.aspect = sizes.width / sizes.height;
      camera.updateProjectionMatrix();

      renderer.setSize(sizes.width, sizes.height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    });

    // Camera
    const camera = new THREE.PerspectiveCamera(
      75,
      sizes.width / sizes.height,
      0.1,
      100
    );
    camera.position.set(0, 3, 10);
    scene.add(camera);

    // Controls
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;

    // Quasar Core - Glowing Sphere
    const coreMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff, // Bright white core
    });

    const coreGeometry = new THREE.SphereGeometry(1, 32, 32);
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    scene.add(core);

    // Core Glow Effect (halo-like effect using a second sphere)
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0x99ccff, // Blueish glow
      transparent: true,
      opacity: 0.5,
    });
    const glowGeometry = new THREE.SphereGeometry(1.5, 32, 32);
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    scene.add(glow);

    // Axes Helper (optional, for debugging)
    const axesHelper = new THREE.AxesHelper(5);
    scene.add(axesHelper);

    // Animation Loop
    const clock = new THREE.Clock();
    const tick = () => {
      const elapsedTime = clock.getElapsedTime();

      // Rotate the core and glow for visual effect
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

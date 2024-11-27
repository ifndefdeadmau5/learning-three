"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import GUI from "lil-gui";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

function Page() {
  const el = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!el.current) {
      return;
    }

    el.current.innerHTML = "";

    const canvas = el.current;

    const gui = new GUI({
      width: 300,
      title: "Nice debug UI",
      closeFolders: false,
    });

    const renderer = new THREE.WebGLRenderer({
      canvas: canvas,
    });

    // Scene
    const scene = new THREE.Scene();

    // Create an empty BufferGeometry

    const cube = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial()
    );
    // scene.add(cube);

    /**
     * Sizes
     */
    const sizes = {
      width: window.innerWidth,
      height: window.innerHeight,
    };

    renderer.setSize(sizes.width, sizes.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    window.addEventListener("resize", () => {
      sizes.width = window.innerWidth;
      sizes.height = window.innerHeight;

      // Update camera
      camera.aspect = sizes.width / sizes.height;
      camera.updateProjectionMatrix();

      // Update renderer
      renderer.setSize(sizes.width, sizes.height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    });

    const camera = new THREE.PerspectiveCamera(
      75,
      sizes.width / sizes.height,
      0.1,
      100
    );
    camera.position.x = 3;
    camera.position.y = 3;
    camera.position.z = 3;
    scene.add(camera);

    // Controls
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;

    // Animate
    const clock = new THREE.Clock();

    const parameters = {
      count: 30000,
      size: 0.01,
      radius: 5,
      branches: 3,
      randomness: 2,
      insideColor: "#259825",
      outsideColor: "#9530a6",
    };

    // add axis helper
    const axesHelper = new THREE.AxesHelper(5);
    // scene.add(axesHelper);

    let geometry: any = null;
    let material: any = null;
    let points: any = null;

    const generateGalaxy = () => {
      if (points !== null) {
        geometry.dispose();
        material.dispose();
        scene.remove(points);
      }
      /**
       * Geometry
       */
      geometry = new THREE.BufferGeometry();

      material = new THREE.PointsMaterial({
        size: parameters.size,
        sizeAttenuation: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexColors: true,
      });
      geometry = new THREE.BufferGeometry();

      // @ts-ignore
      const positions = new Float32Array(parameters?.count * 3);

      const colors = new Float32Array(parameters.count * 3);

      const colorInside = new THREE.Color(parameters.insideColor);
      const colorOutside = new THREE.Color(parameters.outsideColor);

      // @ts-ignore
      for (let i = 0; i < parameters.count; i++) {
        const i3 = i * 3;

        const radius = Math.random() * parameters.radius;
        colors[i3] = 1;
        colors[i3 + 1] = 0;
        colors[i3 + 2] = 0;
        const branchAngle =
          (((i % parameters.branches) + radius) / parameters.branches) *
          Math.PI *
          2;

        const x =
          (Math.cos(branchAngle) +
            (Math.random() - 0.5) / parameters.randomness) *
          radius;
        const y = (Math.random() - 0.5) * (radius / 10);
        const z =
          (Math.sin(branchAngle) +
            (Math.random() - 0.5) / parameters.randomness) *
          radius;

        positions[i3] = x;
        positions[i3 + 1] = y;
        positions[i3 + 2] = z;
        const mixedColor = colorInside.clone();
        mixedColor.lerp(colorOutside, radius / parameters.radius);

        colors[i3] = mixedColor.r;
        colors[i3 + 1] = mixedColor.g;
        colors[i3 + 2] = mixedColor.b;
      }

      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

      geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(positions, 3)
      );

      points = new THREE.Points(geometry, material);
      scene.add(points);

      /*       parameters.count = 100000;
      parameters.size = 0.01;
      parameters.radius = 5; */
    };

    gui
      .add(parameters, "count")
      .min(100)
      .max(1000000)
      .step(100)
      .onFinishChange(generateGalaxy);
    gui
      .add(parameters, "size")
      .min(0.001)
      .max(0.1)
      .step(0.001)
      .onFinishChange(generateGalaxy);
    gui.add(parameters, "radius").min(0.01).max(20).step(0.01);
    gui
      .add(parameters, "branches")
      .min(1)
      .max(20)
      .step(1)
      .onFinishChange(generateGalaxy);
    gui
      .add(parameters, "randomness")
      .min(0)
      .max(5)
      .step(0.1)
      .onFinishChange(generateGalaxy);
    generateGalaxy();

    // enter full screen when double clicking on the canvas
    canvas.addEventListener("dblclick", () => {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        canvas.requestFullscreen();
      }
    });

    const tick = () => {
      const elapsedTime = clock.getElapsedTime();

      // Animate the galaxy points waving up and down
      const positions = geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < positions.length; i += 3) {
        const x = positions[i];
        const z = positions[i + 2];

        const distanceFromCenter = Math.sqrt(x * x + z * z);

        // Apply a sinusoidal wave effect only on the y-coordinate
        const wave = Math.sin(distanceFromCenter * 10 - elapsedTime * 6) * 1;

        positions[i + 1] = wave; // Modify y-coordinate only
      }

      geometry.attributes.position.needsUpdate = true;

      // Update controls
      controls.update();

      // Render
      renderer.render(scene, camera);

      // Call tick again on the next frame
      window.requestAnimationFrame(tick);
    };

    tick();
  }, []);

  return <canvas ref={el}></canvas>;
}

export default Page;

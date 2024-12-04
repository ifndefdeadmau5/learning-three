/*eslint array-bracket-newline: ["error", { "multiline": true }]*/

"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import GUI from "lil-gui";
import "./style.css";

function Page() {
  const el = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!el.current) {
      return;
    }

    el.current.innerHTML = "";
    // Scene
    const scene = new THREE.Scene();

    const gui = new GUI();

    const parameters = {
      materialColor: "#6ab0d2",
    };

    gui.addColor(parameters, "materialColor");

    /**
     * Sizes
     */
    const sizes = {
      width: window.innerWidth,
      height: window.innerHeight,
    };

    window.addEventListener("resize", () => {
      // Update sizes
      sizes.width = window.innerWidth;
      sizes.height = window.innerHeight;

      // Update camera
      camera.aspect = sizes.width / sizes.height;
      camera.updateProjectionMatrix();

      // Update renderer
      renderer.setSize(sizes.width, sizes.height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    });

    /**
     * Camera
     */
    // Base camera
    const camera = new THREE.PerspectiveCamera(
      35,
      sizes.width / sizes.height,
      0.1,
      100
    );
    camera.position.z = 6;
    scene.add(camera);

    /**
     * Renderer
     */
    const renderer = new THREE.WebGLRenderer({
      canvas: el.current,
      alpha: true,
    });
    renderer.setSize(sizes.width, sizes.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Texture
    const textureLoader = new THREE.TextureLoader();
    const gradientTexture = textureLoader.load("textures/gradients/3.jpg");
    gradientTexture.magFilter = THREE.NearestFilter;

    /**
     * Objects
     */
    // Material
    const material = new THREE.MeshToonMaterial({
      color: parameters.materialColor,
      gradientMap: gradientTexture,
    });

    // Meshes
    const mesh1 = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.4, 16, 60),
      material
    );
    const mesh2 = new THREE.Mesh(new THREE.ConeGeometry(1, 2, 32), material);
    const mesh3 = new THREE.Mesh(
      new THREE.TorusKnotGeometry(0.8, 0.35, 100, 16),
      material
    );

    scene.add(mesh1, mesh2, mesh3);

    const objectsDistance = 4;

    mesh1.position.x = 2;
    mesh2.position.x = -2;
    mesh3.position.x = 2;

    mesh1.position.y = -objectsDistance * 0;
    mesh2.position.y = -objectsDistance * 1;
    mesh3.position.y = -objectsDistance * 2;

    /**
     * Lights
     */
    const directionalLight = new THREE.DirectionalLight("#ffffff", 3);
    directionalLight.position.set(1, 1, 0);
    scene.add(directionalLight);

    gui.addColor(parameters, "materialColor").onChange(() => {
      material.color.set(parameters.materialColor);
    });

    gui.add(directionalLight.position, "x").min(-5).max(5).step(0.01);

    /**
     * Mousemove Event
     */
    const cursor = { x: 0, y: 0 };

    const onMouseMove = (event: any) => {
      // Normalize cursor position to range [-1, 1]
      cursor.x = (event.clientX / window.innerWidth) * 2 - 1;
      cursor.y = -(event.clientY / window.innerHeight) * 2 + 1;

      // Update light position
      directionalLight.position.x = cursor.x * 2; // Adjust multiplier as needed
      directionalLight.position.y = cursor.y * 2; // Adjust multiplier as needed
    };

    window.addEventListener("mousemove", onMouseMove);

    let scrollY = window.scrollY;
    window.addEventListener("scroll", () => {
      scrollY = window.scrollY;
    });
    /**
     * Animate
     */
    const clock = new THREE.Clock();
    let requestId = 0;
    const sectionMeshes = [mesh1, mesh2, mesh3];
    const tick = () => {
      const elapsedTime = clock.getElapsedTime();

      // Animate meshes
      for (const mesh of sectionMeshes) {
        mesh.rotation.x = elapsedTime * 0.1;
        mesh.rotation.y = elapsedTime * 0.12;
      }

      camera.position.y = (-scrollY / sizes.height) * objectsDistance;

      // Render
      renderer.render(scene, camera);

      // constantly change the position of the light to make it seem like the object is glowing
      // directionalLight.position.x = Math.sin(elapsedTime);
      // directionalLight.position.y = Math.cos(elapsedTime);

      // Call tick again on the next frame
      requestId = window.requestAnimationFrame(tick);
    };

    tick();

    return () => {
      cancelAnimationFrame(requestId);
      window.removeEventListener("mousemove", onMouseMove);
    };
  });

  return (
    <>
      <canvas className="webgl" style={{ display: "block" }} ref={el}></canvas>
      <section className="section">
        <h1>My Portfolio</h1>
      </section>
      <section className="section">
        <h2>My projects</h2>
      </section>
      <section className="section">
        <h2>Contact me</h2>
      </section>
    </>
  );
}

export default Page;

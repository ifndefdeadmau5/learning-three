/*eslint array-bracket-newline: ["error", { "multiline": true }]*/

"use client";

import { useEffect, useRef } from "react";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import * as THREE from "three";
import CANNON from "cannon";
import GUI from "lil-gui";
import "./style.css";

function Page() {
  const el = useRef<HTMLCanvasElement>(null);

  /**
   * Physics
   */
  const world = new CANNON.World();

  world.gravity.set(0, -9.82, 0);

  useEffect(() => {
    if (!el.current) {
      return;
    }

    el.current.innerHTML = "";
    // Scene

    const gui = new GUI();

    /**
     * Sizes
     */

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

    // Scene
    const scene = new THREE.Scene();

    /**
     * Textures
     */
    const textureLoader = new THREE.TextureLoader();
    const cubeTextureLoader = new THREE.CubeTextureLoader();

    const environmentMapTexture = cubeTextureLoader.load([
      "/textures/environmentMaps/0/px.png",
      "/textures/environmentMaps/0/nx.png",
      "/textures/environmentMaps/0/py.png",
      "/textures/environmentMaps/0/ny.png",
      "/textures/environmentMaps/0/pz.png",
      "/textures/environmentMaps/0/nz.png",
    ]);

    /**
     * Test sphere
     */
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 32, 32),
      new THREE.MeshStandardMaterial({
        metalness: 0.3,
        roughness: 0.4,
        envMap: environmentMapTexture,
        envMapIntensity: 0.5,
      })
    );
    sphere.castShadow = true;
    sphere.position.y = 0.5;
    scene.add(sphere);

    /**
     * Floor
     */
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 10),
      new THREE.MeshStandardMaterial({
        color: "#777777",
        metalness: 0.3,
        roughness: 0.4,
        envMap: environmentMapTexture,
        envMapIntensity: 0.5,
      })
    );
    floor.receiveShadow = true;
    floor.rotation.x = -Math.PI * 0.5;
    scene.add(floor);

    /**
     * Lights
     */
    const ambientLight = new THREE.AmbientLight(0xffffff, 2.1);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.set(1024, 1024);
    directionalLight.shadow.camera.far = 15;
    directionalLight.shadow.camera.left = -7;
    directionalLight.shadow.camera.top = 7;
    directionalLight.shadow.camera.right = 7;
    directionalLight.shadow.camera.bottom = -7;
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

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

    // add axis helper
    const axesHelper = new THREE.AxesHelper(5);
    scene.add(axesHelper);

    /**
     * Camera
     */
    // Base camera
    const camera = new THREE.PerspectiveCamera(
      75,
      sizes.width / sizes.height,
      0.1,
      1000
    );
    camera.position.set(-3, 3, 3);
    scene.add(camera);

    // Controls
    const controls = new OrbitControls(camera, el.current);
    controls.enableDamping = true;

    /**
     * Renderer
     */
    const renderer = new THREE.WebGLRenderer({
      canvas: el.current,
      alpha: true,
    });
    renderer.setSize(sizes.width, sizes.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    /**
     * Objects
     */

    const sphereShape = new CANNON.Sphere(0.5);

    const concreteMaterial = new CANNON.Material("concrete");
    const plasticMaterial = new CANNON.Material("plastic");
    const concretePlasticContactMaterial = new CANNON.ContactMaterial(
      concreteMaterial,
      plasticMaterial,
      {
        friction: 0.3,
        restitution: 0.5,
      }
    );
    world.addContactMaterial(concretePlasticContactMaterial);
    const sphereBody = new CANNON.Body({
      mass: 0.5,
      position: new CANNON.Vec3(0, 0, 0),
      material: plasticMaterial,
      shape: sphereShape,
    });

    world.addBody(sphereBody);

    const floorShape = new CANNON.Plane();
    const floorBody = new CANNON.Body();
    floorBody.material = concreteMaterial;
    floorBody.mass = 0;
    floorBody.addShape(floorShape);
    world.addBody(floorBody);
    floorBody.quaternion.setFromAxisAngle(
      new CANNON.Vec3(-1, 0, 0),
      Math.PI / 2
    );

    /**
     * Lights
     */
    // const directionalLight = new THREE.DirectionalLight("#ffffff", 3);
    directionalLight.position.set(1, 1, 0);
    scene.add(directionalLight);

    gui.add(directionalLight.position, "x").min(-5).max(5).step(0.01);

    const clock = new THREE.Clock();
    let previousTime = 0;
    let requestId = 0;

    const tick = () => {
      const elapsedTime = clock.getElapsedTime();
      const deltaTime = elapsedTime - previousTime;
      previousTime = elapsedTime;
      // Render
      world.step(1 / 60, deltaTime, 3);
      sphere.position.copy(sphereBody.position);
      renderer.render(scene, camera);
      // Call tick again on the next frame
      requestId = window.requestAnimationFrame(tick);
    };

    tick();

    return () => {
      cancelAnimationFrame(requestId);
    };
  });

  return (
    <canvas className="webgl" style={{ display: "block" }} ref={el}></canvas>
  );
}

export default Page;

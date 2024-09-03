// @ts-nocheck
import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

// import * as THREE from 'three'
// import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import GUI from "lil-gui";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
// import typefaceFont from "three/examples/fonts/helvetiker_regular.typeface.json";
import typefaceFont from "./helvetiker_regular.typeface.json";

// Debug
const gui = new GUI();

const ThreeScene = () => {
  const canvasRef = useRef();

  useEffect(() => {
    // Canvas
    const canvas = canvasRef.current;

    // Scene
    const scene = new THREE.Scene();

    /**
     * Fonts
     */

    // Sizes
    const sizes = {
      width: window.innerWidth,
      height: window.innerHeight,
    };

    /**
     * Camera
     */
    // Base camera
    const camera = new THREE.PerspectiveCamera(
      75,
      sizes.width / sizes.height,
      0.1,
      100
    );
    camera.position.x = 1;
    camera.position.y = 1;
    camera.position.z = 2;
    scene.add(camera);

    // Controls
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;

    /**
     * Renderer
     */
    const renderer = new THREE.WebGLRenderer({
      canvas: canvas,
    });
    renderer.setSize(sizes.width, sizes.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    gui.add(ambientLight, "intensity").min(0).max(3).step(0.001);
    scene.add(ambientLight);

    // Directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(2, 2, -1);
    gui.add(directionalLight, "intensity").min(0).max(3).step(0.001);
    gui.add(directionalLight.position, "x").min(-5).max(5).step(0.001);
    gui.add(directionalLight.position, "y").min(-5).max(5).step(0.001);
    gui.add(directionalLight.position, "z").min(-5).max(5).step(0.001);
    scene.add(directionalLight);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048 * 2;
    directionalLight.shadow.mapSize.height = 2048 * 2;

    // const directionalLightCameraHelper = new THREE.CameraHelper(
    //   directionalLight.shadow.camera
    // );
    // scene.add(directionalLightCameraHelper);

    // optimize near and far planes
    directionalLight.shadow.camera.near = 1;
    directionalLight.shadow.camera.far = 6;

    directionalLight.shadow.camera.top = 2;
    directionalLight.shadow.camera.right = 2;
    directionalLight.shadow.camera.bottom = -2;
    directionalLight.shadow.camera.left = -2;

    directionalLight.radius = 100;

    // Spot light
    const spotLight = new THREE.SpotLight(0xffffff, 3.6, 10, Math.PI * 0.3);
    spotLight.castShadow = true;
    spotLight.position.set(0, 2, 2);
    scene.add(spotLight);
    scene.add(spotLight.target);

    spotLight.shadow.mapSize.width = 1024;
    spotLight.shadow.mapSize.height = 1024;

    const spotLightCameraHelper = new THREE.CameraHelper(
      spotLight.shadow.camera
    );
    scene.add(spotLightCameraHelper);
    spotLight.visible = false;

    // Point light
    const pointLight = new THREE.PointLight(0xffffff, 2.7);
    pointLight.castShadow = true;
    pointLight.position.set(-1, 1, 0);
    scene.add(pointLight);

    const pointLightCameraHelper = new THREE.CameraHelper(
      pointLight.shadow.camera
    );
    scene.add(pointLightCameraHelper);

    /**
     * Materials
     */
    const material = new THREE.MeshStandardMaterial();
    material.roughness = 0.7;
    gui.add(material, "metalness").min(0).max(1).step(0.001);
    gui.add(material, "roughness").min(0).max(1).step(0.001);

    /**
     * Objects
     */
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 32, 32),
      material
    );
    sphere.castShadow = true;

    const plane = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), material);
    plane.rotation.x = -Math.PI * 0.5;
    plane.position.y = -0.5;
    plane.receiveShadow = true;

    scene.add(sphere, plane);

    // Resize event
    const handleResize = () => {
      sizes.width = window.innerWidth;
      sizes.height = window.innerHeight;

      camera.aspect = sizes.width / sizes.height;
      camera.updateProjectionMatrix();

      renderer.setSize(sizes.width, sizes.height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    };
    window.addEventListener("resize", handleResize);

    // Fullscreen event
    const handleDoubleClick = () => {
      const fullscreenElement =
        document.fullscreenElement || document.webkitFullscreenElement;

      if (!fullscreenElement) {
        if (canvas.requestFullscreen) {
          canvas.requestFullscreen();
        } else if (canvas.webkitRequestFullscreen) {
          canvas.webkitRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        }
      }
    };
    window.addEventListener("dblclick", handleDoubleClick);

    // Animation loop
    const clock = new THREE.Clock();

    const tick = () => {
      const elapsedTime = clock.getElapsedTime();

      // Update controls
      controls.update();

      // Render
      renderer.render(scene, camera);

      // Call tick again on the next frame
      window.requestAnimationFrame(tick);
    };

    tick();

    // Cleanup
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("dblclick", handleDoubleClick);
      renderer.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} className="webgl"></canvas>;
};

export default ThreeScene;

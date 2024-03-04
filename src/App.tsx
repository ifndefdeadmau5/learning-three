// @ts-nocheck
import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

const ThreeScene = () => {
  const canvasRef = useRef();

  useEffect(() => {
    // Canvas
    const canvas = canvasRef.current;

    // Scene
    const scene = new THREE.Scene();

    // // Cube
    // const geometry = new THREE.BoxGeometry(1, 1, 1);
    // const material = new THREE.MeshBasicMaterial({ color: 0xadd8e6 });
    // const cube = new THREE.Mesh(geometry, material);
    // scene.add(cube);

    // // Cube Edges
    // const edges = new THREE.EdgesGeometry(geometry);
    // const lineMaterial = new THREE.LineBasicMaterial({
    //   color: 0x4169e1,
    //   linewidth: 2,
    // }); // Use a contrasting color for better visibility
    // const cubeEdges = new THREE.LineSegments(edges, lineMaterial);
    // cube.add(cubeEdges); // Add the edges to the cube to ensure they move together

    /**
     * Object
     */
    const geometry = new THREE.BufferGeometry();
    const count = 15;
    const positionsArray = new Float32Array(count * 3 * 3);
    for (let i = 0; i < count * 3 * 3; i++) {
      positionsArray[i] = (Math.random() - 0.5) * 4;
    }
    const positionsAttribute = new THREE.BufferAttribute(positionsArray, 3);
    geometry.setAttribute("position", positionsAttribute);

    const material = new THREE.MeshBasicMaterial({
      // suggest something winter color
      color: 0xadd8e6,
      wireframe: true,
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);
    // Sizes
    const sizes = {
      width: window.innerWidth,
      height: window.innerHeight,
    };

    // Camera
    const camera = new THREE.PerspectiveCamera(
      75,
      sizes.width / sizes.height,
      0.1,
      100
    );
    camera.position.z = 3;
    scene.add(camera);

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas,
    });
    renderer.setSize(sizes.width, sizes.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Controls
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;

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

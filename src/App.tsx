"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import GUI from "lil-gui";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass";

function QuasarSimulation() {
  const el = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!el.current) return;

    el.current.innerHTML = "";

    const canvas = el.current;
    const renderer = new THREE.WebGLRenderer({ canvas });
    renderer.toneMapping = THREE.ReinhardToneMapping;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);

    const scene = new THREE.Scene();

    // Camera
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000 // Increased far clipping plane
    );
    camera.position.set(0, 5, 15);
    scene.add(camera);

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;

    window.addEventListener("resize", () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    });

    // Postprocessing
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      1.5,
      0.4,
      0.85
    );
    composer.addPass(bloomPass);

    // GUI for bloom adjustments
    const gui = new GUI();
    const bloomParams = { strength: 1.5, radius: 0.4, threshold: 0.85 };
    gui
      .add(bloomParams, "strength", 0, 3)
      .onChange((v: number) => (bloomPass.strength = v));
    gui
      .add(bloomParams, "radius", 0, 1)
      .onChange((v: number) => (bloomPass.radius = v));
    gui
      .add(bloomParams, "threshold", 0, 1)
      .onChange((v: number) => (bloomPass.threshold = v));

    // Quasar Core
    const coreMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const coreGeometry = new THREE.SphereGeometry(1, 32, 32);
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    scene.add(core);

    // Shader Glow for Core
    const glowMaterial = new THREE.ShaderMaterial({
      uniforms: {
        viewVector: { value: camera.position },
        glowColor: { value: new THREE.Color(0x99ccff) },
        coefficient: { value: 0.5 },
        power: { value: 2.0 },
      },
      vertexShader: `
        uniform vec3 viewVector;
        varying float intensity;
        void main() {
          vec3 vNormal = normalize(normalMatrix * normal);
          vec3 vNormView = normalize(viewVector - (modelViewMatrix * vec4(position, 1.0)).xyz);
          intensity = pow(dot(vNormal, vNormView), power);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 glowColor;
        varying float intensity;
        void main() {
          gl_FragColor = vec4(glowColor * intensity, 1.0);
        }
      `,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
    });
    const glowGeometry = new THREE.SphereGeometry(1.2, 32, 32);
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    glow.scale.set(1.5, 1.5, 1.5);
    scene.add(glow);

    // Jets
    const createJetStreams = () => {
      const jetParameters = {
        count: 5000,
        radius: 1,
        height: 100,
        speed: 2,
      };

      const jetGeometry = new THREE.BufferGeometry();
      const positions = new Float32Array(jetParameters.count * 3);

      for (let i = 0; i < jetParameters.count; i++) {
        const angle = Math.random() * Math.PI * 2; // Circular spread
        const radius = Math.random() * jetParameters.radius;
        const height =
          Math.random() * jetParameters.height * (Math.random() < 0.5 ? 1 : -1);

        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius; // Z-axis (vertical)
        const y = height; // Jet height along the Y-axis

        positions[i * 3] = x; // X-coordinate
        positions[i * 3 + 1] = y; // Y-coordinate
        positions[i * 3 + 2] = z; // Z-coordinate
      }

      jetGeometry.setAttribute(
        "position",
        new THREE.BufferAttribute(positions, 3)
      );

      const jetMaterial = new THREE.PointsMaterial({
        size: 0.05,
        color: 0x00ccff,
        blending: THREE.AdditiveBlending,
        transparent: true,
      });

      const jets = new THREE.Points(jetGeometry, jetMaterial);

      // Rotate the jets to align along the Z-axis
      jets.rotation.x = Math.PI / 2;

      scene.add(jets);

      // Animate the jets in the animation loop
      const animateJets = () => {
        const positions = jets.geometry.attributes.position
          .array as Float32Array;
        for (let i = 0; i < positions.length; i += 3) {
          positions[i + 1] += 0.1; // Move particles along the Y-axis

          // Reset particle position when out of bounds
          if (positions[i + 1] > jetParameters.height)
            positions[i + 1] = -jetParameters.height;
          if (positions[i + 1] < -jetParameters.height)
            positions[i + 1] = jetParameters.height;
        }
        jets.geometry.attributes.position.needsUpdate = true;
      };

      return { jets, animateJets };
    };

    // Call this function to create the jets
    const { jets, animateJets } = createJetStreams();

    //
    // const createAccretionDisk = () => {
    //   const diskParameters = {
    //     count: 20000, // Number of particles
    //     innerRadius: 2, // Inner radius of the disk
    //     outerRadius: 6, // Outer radius of the disk
    //     heightVariation: 0.2, // Vertical randomness
    //   };

    //   const diskGeometry = new THREE.BufferGeometry();
    //   const positions = new Float32Array(diskParameters.count * 3);

    //   for (let i = 0; i < diskParameters.count; i++) {
    //     // Randomize angle and radius for circular distribution
    //     const angle = Math.random() * Math.PI * 2;
    //     const radius =
    //       diskParameters.innerRadius +
    //       Math.random() *
    //         (diskParameters.outerRadius - diskParameters.innerRadius);

    //     // Cartesian coordinates
    //     const x = Math.cos(angle) * radius;
    //     const z = Math.sin(angle) * radius;
    //     const y = (Math.random() - 0.5) * diskParameters.heightVariation; // Slight vertical offset

    //     positions[i * 3] = x; // X-coordinate
    //     positions[i * 3 + 1] = y; // Y-coordinate
    //     positions[i * 3 + 2] = z; // Z-coordinate
    //   }

    //   diskGeometry.setAttribute(
    //     "position",
    //     new THREE.BufferAttribute(positions, 3)
    //   );

    //   const diskMaterial = new THREE.PointsMaterial({
    //     size: 0.05, // Particle size
    //     color: 0xffcc00, // Yellowish glow
    //     blending: THREE.AdditiveBlending,
    //     transparent: true,
    //     depthWrite: false,
    //   });

    //   const accretionDisk = new THREE.Points(diskGeometry, diskMaterial);
    //   accretionDisk.rotation.x = Math.PI / 2; // Tilt to align with the XY plane
    //   scene.add(accretionDisk);

    //   // Animate the disk rotation in the animation loop
    //   const animateDisk = () => {
    //     accretionDisk.rotation.z += 0.002; // Smooth rotation
    //   };

    //   return { accretionDisk, animateDisk };
    // };

    // Call this function to create the disk
    // const { accretionDisk, animateDisk } = createAccretionDisk();

    const createGalaxyDisk = () => {
      const diskParameters = {
        count: 20000, // Number of particles
        radius: 6, // Maximum radius of the disk
        branches: 4, // Number of spiral arms
        randomness: 0.3, // Randomness factor for particle positioning
        heightVariation: 0.1, // Vertical randomness
        spin: 1.0, // Spin factor for the spiral arms
      };

      const diskGeometry = new THREE.BufferGeometry();
      const positions = new Float32Array(diskParameters.count * 3);

      for (let i = 0; i < diskParameters.count; i++) {
        const branchAngle =
          ((i % diskParameters.branches) / diskParameters.branches) *
          Math.PI *
          2;

        // Random radius for the particle
        const radius = Math.random() * diskParameters.radius;

        // Spiral effect
        const angle = radius * diskParameters.spin + branchAngle;

        // Random offset to break symmetry
        const randomX =
          (Math.random() - 0.5) * diskParameters.randomness * radius;
        const randomY =
          (Math.random() - 0.5) * diskParameters.heightVariation * radius;
        const randomZ =
          (Math.random() - 0.5) * diskParameters.randomness * radius;

        // Cartesian coordinates
        const x = Math.cos(angle) * radius + randomX;
        const y = randomY;
        const z = Math.sin(angle) * radius + randomZ;

        positions[i * 3] = x; // X-coordinate
        positions[i * 3 + 1] = y; // Y-coordinate
        positions[i * 3 + 2] = z; // Z-coordinate
      }

      diskGeometry.setAttribute(
        "position",
        new THREE.BufferAttribute(positions, 3)
      );

      const diskMaterial = new THREE.PointsMaterial({
        size: 0.05, // Particle size
        color: 0xffcc00, // Yellowish glow
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      });

      const galaxyDisk = new THREE.Points(diskGeometry, diskMaterial);

      // Rotate the disk to align it perpendicular to the jet streams
      galaxyDisk.rotation.x = Math.PI / 2;

      scene.add(galaxyDisk);

      // Animate the disk rotation in the animation loop
      const animateDisk = () => {
        galaxyDisk.rotation.y += 0.002; // Smooth rotation around the z-axis
      };

      return { galaxyDisk, animateDisk };
    };

    // Call this function to create the galaxy disk
    const { galaxyDisk, animateDisk } = createGalaxyDisk();

    const animateDiskParticles = () => {
      const positions = galaxyDisk.geometry.attributes.position
        .array as Float32Array;
      for (let i = 0; i < positions.length; i += 3) {
        const distance = Math.sqrt(positions[i] ** 2 + positions[i + 2] ** 2);
        const drift = 0.001 * Math.sign(distance); // Small outward drift
        positions[i] += positions[i] * drift;
        positions[i + 2] += positions[i + 2] * drift;
      }
      galaxyDisk.geometry.attributes.position.needsUpdate = true;
    };

    // Animation Loop
    const clock = new THREE.Clock();

    const tick = () => {
      const elapsedTime = clock.getElapsedTime();

      // Animate core and glow
      core.rotation.y = elapsedTime * 0.5;
      glow.rotation.y = elapsedTime * 0.5;

      // Animate galaxy disk
      animateDisk();

      // Animate jets
      animateJets();

      // Animate disk particles
      animateDiskParticles();

      // Render scene
      controls.update();
      composer.render();

      requestAnimationFrame(tick);
    };
    tick();

    return () => {
      gui.destroy();
    };
  }, []);

  return <canvas ref={el}></canvas>;
}

export default QuasarSimulation;

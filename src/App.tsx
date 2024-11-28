"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import GUI from "lil-gui";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass";

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
        count: 100000,
        radius: 1,
        height: 100,
        speed: 5,
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
        size: 0.005,
        color: 0x00ccff,
        blending: THREE.AdditiveBlending,
        transparent: true,
      });

      const jets = new THREE.Points(jetGeometry, jetMaterial);

      // Rotate the jets to align along the Z-axis
      jets.rotation.y = Math.PI / 2;

      scene.add(jets);

      // Animate the jets in the animation loop
      const animateJets = () => {
        const positions = jets.geometry.attributes.position
          .array as Float32Array;

        for (let i = 0; i < positions.length; i += 3) {
          // positions[i + 1] += Math.random() * jetParameters.speed; // Move particles along the Y-axis
          positions[i + 1] += jetParameters.speed * 0.1; // Smooth upward/downward motion

          // Reset particle position when out of bounds
          if (positions[i + 1] > jetParameters.height)
            positions[i + 1] = -jetParameters.height;
          if (positions[i + 1] < -jetParameters.height)
            positions[i + 1] = jetParameters.height;

          // jetMaterial.opacity = jetOpacity(positions[i + 1]); // Adjust opacity based on distance
        }
        jets.geometry.attributes.position.needsUpdate = true;
      };

      return { jets, animateJets };
    };

    // Call this function to create the jets
    const { jets, animateJets } = createJetStreams();

    const createStarfield = () => {
      const starCount = 10000;
      const starGeometry = new THREE.BufferGeometry();
      const positions = new Float32Array(starCount * 3);

      for (let i = 0; i < starCount; i++) {
        const x = (Math.random() - 0.5) * 2000;
        const y = (Math.random() - 0.5) * 2000;
        const z = (Math.random() - 0.5) * 2000;
        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;
      }

      starGeometry.setAttribute(
        "position",
        new THREE.BufferAttribute(positions, 3)
      );

      const starMaterial = new THREE.PointsMaterial({
        size: 0.5,
        color: 0xffffff,
        transparent: true,
        blending: THREE.AdditiveBlending,
      });

      const starField = new THREE.Points(starGeometry, starMaterial);
      scene.add(starField);
    };
    createStarfield();
    const diskParameters = {
      count: 20000, // Number of particles
      radius: 10, // Maximum radius of the disk
      branches: 4, // Number of spiral arms
      randomness: 0.3, // Randomness factor for particle positioning
      heightVariation: 0.1, // Vertical randomness
      spin: 1.0, // Spin factor for the spiral arms
    };

    const createGalaxyDisk = () => {
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
        size: 0.005, // Particle size
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

    const volumetricLightShader = {
      uniforms: {
        lightPosition: { value: new THREE.Vector3(0, 0, 0) },
        tDiffuse: { value: null },
      },
      vertexShader: `
        varying vec3 vPosition;
        void main() {
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 lightPosition;
        varying vec3 vPosition;
    
        void main() {
          float intensity = 1.0 / length(vPosition - lightPosition);
          gl_FragColor = vec4(vec3(intensity), 1.0);
        }
      `,
    };

    const createFlare = (position: THREE.Vector3) => {
      const texture = new THREE.TextureLoader().load("./textures/flare.jpg"); // Use your flare texture
      const spriteMaterial = new THREE.SpriteMaterial({
        map: texture,
        color: 0xffaa33,
        blending: THREE.AdditiveBlending,
        transparent: true,
        opacity: 1.0, // Start fully visible
      });

      const sprite = new THREE.Sprite(spriteMaterial);
      sprite.position.set(position.x, position.y, position.z);
      sprite.scale.set(5, 5, 1); // Adjust size
      scene.add(sprite);

      // Fade-out logic
      let fadeInterval: NodeJS.Timeout;
      let currentOpacity = 1.0;

      const fadeOutFlare = () => {
        currentOpacity -= 0.05; // Reduce opacity
        spriteMaterial.opacity = currentOpacity;

        if (currentOpacity <= 0) {
          clearInterval(fadeInterval); // Stop fading when opacity reaches 0
          scene.remove(sprite); // Remove flare from scene
        }
      };

      // Start fading out
      fadeInterval = setInterval(fadeOutFlare, 50); // Decrease opacity every 50ms
    };

    // Randomly generate flares
    const triggerFlares = () => {
      setInterval(() => {
        const randomPosition = new THREE.Vector3(
          (Math.random() - 0.5) * 10,
          (Math.random() - 0.5) * 10,
          (Math.random() - 0.5) * 10
        );
        createFlare(randomPosition); // Creates a flare with fade-out
        triggerCameraShake(0.1); // Optional: Trigger camera shake
      }, 2000); // New flare every 2 seconds
    };
    triggerFlares();

    // Call this function to create the galaxy disk
    const { galaxyDisk, animateDisk } = createGalaxyDisk();

    const animateDiskParticles = () => {
      const positions = galaxyDisk.geometry.attributes.position
        .array as Float32Array;
      for (let i = 0; i < positions.length; i += 3) {
        const distance = Math.sqrt(positions[i] ** 2 + positions[i + 2] ** 2);
        const drift = 0.001 * Math.sign(distance); // Small outward drift

        if (distance < diskParameters.radius) {
          positions[i] += positions[i] * drift;
          positions[i + 2] += positions[i + 2] * drift;
        }
      }
      galaxyDisk.geometry.attributes.position.needsUpdate = true;
    };

    const lensDistortionShader = {
      uniforms: {
        tDiffuse: { value: null },
        strength: { value: 0.5 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float strength;
        varying vec2 vUv;
    
        void main() {
          vec2 uv = vUv;
          uv -= 0.5;
          uv *= 1.0 + strength * dot(uv, uv);
          uv += 0.5;
          gl_FragColor = texture2D(tDiffuse, uv);
        }
      `,
    };

    const distortionPass = new ShaderPass(lensDistortionShader);
    distortionPass.uniforms.strength.value = 0.1; // Adjust distortion strength
    // composer.addPass(distortionPass);

    // add volumetricLightShader to the composer
    const volumetricLightPass = new ShaderPass(volumetricLightShader);
    // composer.addPass(volumetricLightPass);

    let shakeIntensity = 0;
    const originalCameraPosition = camera.position.clone();

    const applyCameraShake = () => {
      if (shakeIntensity > 0) {
        camera.position.x =
          originalCameraPosition.x + (Math.random() - 0.5) * shakeIntensity;
        camera.position.y =
          originalCameraPosition.y + (Math.random() - 0.5) * shakeIntensity;
        camera.position.z =
          originalCameraPosition.z + (Math.random() - 0.5) * shakeIntensity;

        shakeIntensity *= 0.9; // Gradually reduce shake intensity
      }
    };

    // Trigger shake on events
    const triggerCameraShake = (intensity = 0.5) => {
      shakeIntensity = intensity;
    };

    let targetCoefficient = 0.5;
    let targetPower = 2.0;

    canvas.addEventListener("click", () => {
      targetCoefficient = 1.0;
      targetPower = 4.0;
    });

    const updateGlowEffect = (elapsedTime: number) => {
      glowMaterial.uniforms.coefficient.value +=
        (targetCoefficient - glowMaterial.uniforms.coefficient.value) * 0.1;
      glowMaterial.uniforms.power.value +=
        (targetPower - glowMaterial.uniforms.power.value) * 0.1;

      // Add pulsation effect
      glowMaterial.uniforms.coefficient.value +=
        Math.sin(elapsedTime * 2) * 0.02;
    };

    canvas.addEventListener("click", () => {
      // Temporarily boost the glow intensity
      glowMaterial.uniforms.coefficient.value = 1.0;
      glowMaterial.uniforms.power.value = 4.0;

      // Gradually return to normal
      setTimeout(() => {
        glowMaterial.uniforms.coefficient.value = 0.5;
        glowMaterial.uniforms.power.value = 2.0;
      }, 500); // Reset after 500ms
    });

    const updateProximityGlow = () => {
      const distance = camera.position.length(); // Distance from the origin
      const intensity = Math.max(0.5, 2.0 / distance); // Inverse relation
      glowMaterial.uniforms.coefficient.value = intensity;
      glowMaterial.uniforms.power.value = 2.0 + intensity * 0.5;
    };

    window.addEventListener("mousemove", (event) => {
      const x = (event.clientX / window.innerWidth) * 2 - 1; // Normalized X
      const y = -(event.clientY / window.innerHeight) * 2 + 1; // Normalized Y

      galaxyDisk.rotation.z = x * 0.1; // Slight tilt around the Z-axis
      galaxyDisk.rotation.x = y * 0.1; // Slight tilt around the X-axis
    });

    // Animation Loop
    const clock = new THREE.Clock();

    const tick = () => {
      const elapsedTime = clock.getElapsedTime();

      // Animate core and glow
      core.rotation.y = elapsedTime * 0.5;
      updateGlowEffect(elapsedTime);
      updateProximityGlow();

      // Animate galaxy disk
      animateDisk();

      // Animate jets
      animateJets();

      // Animate disk particles
      animateDiskParticles();

      // Apply camera shake
      applyCameraShake();

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

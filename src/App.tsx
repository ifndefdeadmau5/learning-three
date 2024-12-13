"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import GUI from "lil-gui";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
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
      2000 // Increased far clipping plane
    );
    camera.position.set(0.14, -80.73, 55.14);
    camera.rotation.set(0.97, 0.0, -0.0);

    camera.near = 0.1;
    camera.far = 2000; // Increase far clipping plane
    camera.updateProjectionMatrix();

    scene.add(camera);

    const gui = new GUI();

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
      0.5, // strength
      0.865, // Slight radius for subtle effect
      0 // Higher threshold to exclude dimmer objects
    );

    // GUI for bloom adjustments
    const bloomParams = { strength: 0.6, radius: 0.865, threshold: 0 };
    gui
      .add(bloomParams, "strength", 0.3, 0.9)
      .onChange((v: number) => (bloomPass.strength = v));
    gui
      .add(bloomParams, "radius", 0, 1)
      .onChange((v: number) => (bloomPass.radius = v));
    gui
      .add(bloomParams, "threshold", 0, 1)
      .onChange((v: number) => (bloomPass.threshold = v));

    composer.addPass(bloomPass);

    const disposeScene = () => {
      // Traverse and dispose all scene children
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh && object.geometry)
          object.geometry.dispose();
        const mesh = object as THREE.Mesh;
        if (mesh.material) {
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((mat: THREE.Material) => mat.dispose());
          } else {
            mesh.material.dispose();
          }
        }
        if ((mesh as any).texture) (mesh as any).texture.dispose();
      });
    };

    const disposeRenderer = () => {
      renderer.dispose();
    };

    const disposeGUI = () => {
      gui.destroy();
    };

    const disposeControls = () => {
      controls.dispose();
    };

    // GLTF Loader
    const loader = new GLTFLoader();

    // Load the 3D model
    loader.load(
      "/models/blackhole.glb", // Replace with the correct path to your model
      (gltf) => {
        const coreModel = gltf.scene;

        // Scale and position the model
        coreModel.scale.set(20, 20, 20); // Adjust the scale as needed
        coreModel.position.set(0, 0, 0); // Center the model at the origin
        coreModel.rotation.set(Math.PI / 2, 0, 0); // Rotate if necessary

        // Add a name to identify the new core model (optional)
        coreModel.name = "coreModel";

        // Add the new core model to the scene
        scene.add(coreModel);
      },
      (xhr) => {
        console.log((xhr.loaded / xhr.total) * 100 + "% loaded");
      },
      (error) => {
        console.error("An error occurred loading the 3D model:", error);
      }
    );

    const newCoreModel = scene.getObjectByName("coreModel");
    if (newCoreModel) camera.lookAt(newCoreModel.position);

    const blackHoleMaterial = new THREE.ShaderMaterial({
      uniforms: {
        color: { value: new THREE.Color(0x000000) },
        edgeGlow: { value: new THREE.Color(0x333333) }, // Glow around the event horizon
      },
      vertexShader: `
        varying vec3 vPosition;
        void main() {
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 color;
        uniform vec3 edgeGlow;
        varying vec3 vPosition;
        
        void main() {
          float radius = length(vPosition.xy);
          float glow = smoothstep(0.8, 1.0, radius); // Soft edge glow
          vec3 finalColor = mix(color, edgeGlow, glow);
          gl_FragColor = vec4(finalColor, 1.0 - radius); // Transparent at the edges
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
    });
    const eventHorizon = new THREE.Mesh(
      new THREE.SphereGeometry(5, 64, 64),
      blackHoleMaterial
    );
    eventHorizon.scale.set(3.12, 3.12, 3.12);
    scene.add(eventHorizon);

    const lensingShader = {
      uniforms: {
        tDiffuse: { value: null },
        distortionStrength: { value: 0.03 },
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
        uniform float distortionStrength;
        varying vec2 vUv;

        void main() {
          vec2 distortedUv = vUv - 0.5;
          float radius = length(distortedUv);
          distortedUv *= 1.0 + distortionStrength / (radius); // Lens effect
          distortedUv += 0.5;

          vec4 color = texture2D(tDiffuse, distortedUv);
          gl_FragColor = vec4(color.rgb, 1.0);
        }
      `,
    };
    const lensingPass = new ShaderPass(lensingShader);
    lensingPass.enabled = false; // Start enabled by default
    composer.addPass(lensingPass);

    // Add GUI control for enabling/disabling the lensing pass
    const guiParams = {
      lensingEnabled: true, // Initial state
    };

    gui
      .add(guiParams, "lensingEnabled")
      .name("Enable Lensing")
      .onChange((value: boolean) => {
        lensingPass.enabled = value; // Enable or disable the lensing pass
      });

    // add gui control for enabling/disabling the galaxy disk
    const diskParams2 = {
      diskEnabled: false, // Initial state
    };

    gui
      .add(diskParams2, "diskEnabled")
      .name("Enable Galaxy Disk")
      .onChange((v: boolean) => {
        galaxyDisk.visible = v;
      });

    // Jets
    const jetParameters = {
      count: 5000, // Increase the number of particles
      radius: 0.1, // Increase starting radius for a denser emission
      height: 1000,
      spread: 0.04,
      acceleration: 0.08,
      speed: 0.2, // Slightly faster initial speed
      turbulence: 0.0054,
    };

    const createJetStreams = () => {
      const jetGeometry = new THREE.BufferGeometry();
      const positions = new Float32Array(jetParameters.count * 3);
      const velocities = new Float32Array(jetParameters.count * 3); // Velocity for each particle

      for (let i = 0; i < jetParameters.count; i++) {
        const angle = Math.random() * Math.PI * 2; // Random angle for circular spread
        const radius = Math.random() * jetParameters.radius;

        // Pre-spread particles along the height of the jet
        const progress = Math.random() * jetParameters.height; // Random position along height

        positions[i * 3] = Math.cos(angle) * radius; // X
        positions[i * 3 + 1] = Math.sin(angle) * radius; // Y
        positions[i * 3 + 2] =
          Math.random() * jetParameters.height * (Math.random() < 0.5 ? 1 : -1); // Spread particles along height

        velocities[i] = (Math.random() - 0.5) * jetParameters.turbulence;
        velocities[i + 1] = (Math.random() - 0.5) * jetParameters.turbulence;
        velocities[i + 2] =
          jetParameters.speed * (Math.random() < 0.5 ? 1 : -1); // Match up/down direction
      }

      jetGeometry.setAttribute(
        "position",
        new THREE.BufferAttribute(positions, 3)
      );
      jetGeometry.setAttribute(
        "velocity",
        new THREE.BufferAttribute(velocities, 3)
      );

      const jetMaterial = new THREE.ShaderMaterial({
        uniforms: {
          color: { value: new THREE.Color(0xffe5c4) },
        },
        vertexShader: `
          attribute float size;
          varying float vOpacity;
    
          void main() {
            vOpacity = 1.0 - (abs(position.z) / 100.0); // Fade opacity with distance

            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); 
            gl_Position = projectionMatrix * mvPosition;
            gl_PointSize = 4.0 * (300.0 / max(-mvPosition.z, 0.1)); // Scale particles based on depth
}
        `,
        fragmentShader: `
        uniform vec3 color;
        varying float vOpacity;

        void main() {
          float alpha = max(vOpacity, 0.0); // Ensure vOpacity is clamped to a valid range
          gl_FragColor = vec4(color, alpha); // Use calculated alpha for opacity
        }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });

      const jets = new THREE.Points(jetGeometry, jetMaterial);

      const animateJets = () => {
        const positions = jets.geometry.attributes.position
          .array as Float32Array;
        const velocities = jets.geometry.attributes.velocity
          .array as Float32Array;

        for (let i = 0; i < positions.length; i += 3) {
          // Apply velocity to positions
          positions[i] += velocities[i];
          positions[i + 1] += velocities[i + 1];
          positions[i + 2] += velocities[i + 2];

          // Gradually increase spread over time
          velocities[i] += (Math.random() - 0.5) * jetParameters.spread;
          velocities[i + 1] += (Math.random() - 0.5) * jetParameters.spread;

          // Accelerate particles along Z-axis
          velocities[i + 2] +=
            jetParameters.acceleration * (velocities[i + 2] > 0 ? 1 : -1);

          // Reset particles that exceed the height limit
          if (Math.abs(positions[i + 2]) > jetParameters.height) {
            // Reset particle to a random position near the core, but with slight offset
            positions[i] =
              Math.cos(Math.random() * Math.PI * 2) * jetParameters.radius;
            positions[i + 1] =
              Math.sin(Math.random() * Math.PI * 2) * jetParameters.radius;
            // positions[i + 2] = Math.random() * -jetParameters.height; // Randomize reset position
            positions[i + 2] = 0;

            // Assign new random velocities
            velocities[i] = (Math.random() - 0.5) * jetParameters.turbulence;
            velocities[i + 1] =
              (Math.random() - 0.5) * jetParameters.turbulence;
            velocities[i + 2] =
              jetParameters.speed * (Math.random() < 0.5 ? 1 : -1);
          }

          const turbulence =
            Math.sin(performance.now() * 0.001) * jetParameters.turbulence;

          velocities[i] += turbulence;
          velocities[i + 1] += turbulence;
        }

        jets.geometry.attributes.position.needsUpdate = true;
      };

      return { jets, animateJets };
    };

    // Call this function to create the jets

    const { jets, animateJets } = createJetStreams();

    jets.rotation.x = Math.PI; // Flip the second jet for downward emission

    scene.add(jets);

    // Disk Parameters
    const diskParams = {
      numRings: 15, // Number of rings
      innerRadius: 20, // Inner radius of the innermost ring
      outerRadius: 30, // Outer radius of the outermost ring
      heightVariation: 0.1, // Vertical turbulence
      baseColor: "#FBA209", // Base color for gas (orange)
      tiltRange: Math.PI / 7, // Maximum tilt angle (~45 degrees)
      colorVariation: 0.5, // Degree of randomization (0 = no variation, 1 = full random)
      verticalGradient: 0.01, // Degree of height gradient (thickness of the disk)
      curveAmount: 0.1, // Amount of curvature applied to the rings
    };

    // Array to store rings for later updates
    const rings: THREE.Mesh[] = [];

    // Function to create a slightly randomized color based on the base color
    const randomizeColor = (baseColor: THREE.Color, variation: number) => {
      const r = Math.min(
        Math.max(baseColor.r + (Math.random() - 0.5) * variation, 0),
        1
      );
      const g = Math.min(
        Math.max(baseColor.g + (Math.random() - 0.5) * variation, 0),
        1
      );
      const b = Math.min(
        Math.max(baseColor.b + (Math.random() - 0.5) * variation, 0),
        1
      );
      return new THREE.Color(r, g, b);
    };

    const createRing = (
      innerRadius: number,
      outerRadius: number,
      baseColor: THREE.Color
    ) => {
      // Randomize thetaLength (length of the ring arc)
      const randomThetaLength = Math.random() * Math.PI * 2; // Random value between 0 and full circle (0 to 2π)

      // Create the ring geometry with random thetaLength
      const ringGeometry = new THREE.RingGeometry(
        innerRadius,
        outerRadius,
        40, // Radial segments
        30, // Tubular segments
        0, // Start angle
        randomThetaLength // Randomized theta length
      );

      const positions = ringGeometry.attributes.position.array;

      // Add vertical gradient and curvature to the vertices
      for (let i = 0; i < positions.length; i += 3) {
        // Apply height gradient (rings closer to the center are thicker)
        const radialDistance = Math.sqrt(
          positions[i] * positions[i] + positions[i + 1] * positions[i + 1]
        );
        const gradientFactor =
          ((radialDistance - innerRadius) / (outerRadius - innerRadius)) *
          diskParams.verticalGradient;

        // Random vertical turbulence
        positions[i + 2] +=
          (Math.random() - 0.5) * diskParams.heightVariation + gradientFactor;

        // Apply curvature (bend the rings slightly inwards or outwards)
        positions[i] +=
          Math.sin((radialDistance / outerRadius) * Math.PI) *
          diskParams.curveAmount *
          (Math.random() > 0.5 ? 1 : -1);
        positions[i + 1] +=
          Math.cos((radialDistance / outerRadius) * Math.PI) *
          diskParams.curveAmount *
          (Math.random() > 0.5 ? 1 : -1);
      }
      ringGeometry.attributes.position.needsUpdate = true;

      // Load texture for the rings
      const diskTexture = new THREE.TextureLoader().load(
        "/textures/transparent/fire_01.png"
      );
      diskTexture.wrapS = THREE.RepeatWrapping;
      diskTexture.wrapT = THREE.RepeatWrapping;
      diskTexture.repeat.set(1000, 1000); // Adjust texture tiling

      // Generate a slightly randomized color based on the base color
      const color = randomizeColor(baseColor, diskParams.colorVariation);

      const material = new THREE.MeshStandardMaterial({
        map: diskTexture,
        color: color,
        transparent: true,
        opacity: 1,
        emissive: color, // Glow
        emissiveIntensity: 1.0,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      });

      const ring = new THREE.Mesh(ringGeometry, material);

      // Apply random tilts
      ring.rotation.x += (Math.random() - 0.5) * diskParams.tiltRange; // Random tilt along X-axis
      ring.rotation.y += (Math.random() - 0.5) * diskParams.tiltRange; // Random tilt along Y-axis
      ring.rotation.z += (Math.random() - 0.5) * diskParams.tiltRange; // Random tilt along Z-axis

      return ring;
    };

    // Create multiple rings with slight color variations
    const baseColor = new THREE.Color(diskParams.baseColor);
    for (let i = 0; i < diskParams.numRings; i++) {
      const innerRadius = diskParams.innerRadius + Math.random() * 50; // Increment inner radius for each ring
      const outerRadius = innerRadius + 0.01; // Outer radius slightly larger
      const ring = createRing(innerRadius, outerRadius, baseColor);

      scene.add(ring);
      rings.push(ring); // Add to the array for later updates
    }

    // Animation: Rotate all rings slowly with wobble

    const animateDiskRings = (delta: number) => {
      scene.traverse((child) => {
        if (
          (child as THREE.Mesh).geometry &&
          (child as THREE.Mesh).geometry.type === "RingGeometry"
        ) {
          const mesh = child as THREE.Mesh;
          mesh.rotation.z += 0.01; // Rotate each ring slightly
          mesh.rotation.x += Math.sin(delta * 0.0001) * 0.0005; // Add subtle wobble
          // mesh.rotation.y += Math.cos(delta * 0.0001) * 0.0005;
        }
      });
    };
    // Store the number of created planets for orbit variation
    let planetCount = 0;

    const planetParams = {
      radius: 5, // Size of the planet
      orbitRadius: 50 + planetCount * 20, // Vary the starting distance based on the number of planets
      angularSpeed: 0.07, // Angular velocity (for spiral motion)
      radialSpeed: 0.5, // Speed at which it moves toward the core
      tailSegments: 200, // Number of segments in the tail
      tailSize: 10, // Base size of tail particles
    };

    gui
      .add(planetParams, "radius", 1, 30)
      .name("Planet Size")
      .onChange((v: number) => (planetParams.radius = v));
    gui
      .add(planetParams, "angularSpeed", 0.01, 0.2)
      .name("Angular Speed")
      .onChange((v: number) => (planetParams.angularSpeed = v));
    gui
      .add(planetParams, "radialSpeed", 0.1, 1)
      .name("Radial Speed")
      .onChange((v: number) => (planetParams.radialSpeed = v));
    const createAbsorbingPlanet = () => {
      // gui for planet parameters

      // Create the planet
      const planetGeometry = new THREE.SphereGeometry(
        planetParams.radius,
        32,
        32
      );
      const planetTexture = new THREE.TextureLoader().load(
        "/textures/transparent/planet_01.png"
      );
      // planetTexture.repeat.set(1, 1); // Repeat the texture
      const planetMaterial = new THREE.MeshBasicMaterial({
        map: planetTexture,
        // Cold blue
        color: 0x00bfff,
        side: THREE.DoubleSide,
      });
      const planet = new THREE.Mesh(planetGeometry, planetMaterial);
      scene.add(planet);

      // Create the tail as a line of particles
      const tailGeometry = new THREE.BufferGeometry();
      const tailPositions = new Float32Array(planetParams.tailSegments * 3); // 3 values per segment (x, y, z)
      const tailSizes = new Float32Array(planetParams.tailSegments); // Size for each segment
      const tailLifetimes = new Float32Array(planetParams.tailSegments); // Lifetime for each particle

      // Initialize tail positions, sizes, and lifetimes
      for (let i = 0; i < planetParams.tailSegments; i++) {
        const t = i / (planetParams.tailSegments - 1); // Interpolation factor (0 to 1)
        const x = Math.cos(0) * planetParams.orbitRadius * (1 - t); // Linear interpolation to core
        const z = Math.sin(0) * planetParams.orbitRadius * (1 - t);
        const y = 0;

        tailPositions[i * 3] = x;
        tailPositions[i * 3 + 1] = y;
        tailPositions[i * 3 + 2] = z;

        tailSizes[i] = planetParams.tailSize * (1 - t); // Smaller closer to core
        tailLifetimes[i] = 1.0 - t; // Particles fade as they approach the core
      }

      tailGeometry.setAttribute(
        "position",
        new THREE.BufferAttribute(tailPositions, 3)
      );
      tailGeometry.setAttribute(
        "size",
        new THREE.BufferAttribute(tailSizes, 1)
      );
      tailGeometry.setAttribute(
        "lifetime",
        new THREE.BufferAttribute(tailLifetimes, 1)
      );

      const tailMaterial = new THREE.ShaderMaterial({
        uniforms: {
          color: { value: new THREE.Color(0xffe5c4) }, // Base color for the tail
          opacity: { value: 1 }, // Adjust opacity dynamically
          time: { value: 0 }, // Uniform to track time for motion
        },
        vertexShader: `
          attribute float size;
          attribute float lifetime;
          varying float vOpacity;
          varying float vLifetime;
    
          uniform float time;
    
          void main() {
            vec3 flowPosition = position;
            flowPosition.z -= time * 0.1; // Simulate flow motion
            vLifetime = lifetime;
    
            vec4 mvPosition = modelViewMatrix * vec4(flowPosition, 1.0);
            gl_Position = projectionMatrix * mvPosition;
            gl_PointSize = size * (500.0 / max(-mvPosition.z, 0.1));
          }
        `,
        fragmentShader: `
          uniform vec3 color;
          uniform float opacity;
          varying float vOpacity;
          varying float vLifetime;
    
          void main() {
            vec2 coord = gl_PointCoord - vec2(0.5);
            float dist = length(coord);
            float alpha = 1.0 - smoothstep(0.4, 0.5, dist); // Circular fade
            alpha *= vLifetime * opacity;
            gl_FragColor = vec4(color, alpha);
          }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });

      const tail = new THREE.Points(tailGeometry, tailMaterial);
      // scene.add(tail);

      // Spiral motion logic
      let angle = 0; // Current angle
      let currentRadius = planetParams.orbitRadius; // Current radial distance

      const animatePlanet = () => {
        angle += planetParams.angularSpeed; // Increment angle
        currentRadius -= planetParams.radialSpeed; // Decrease radius

        // Smooth vertical motion using a sinusoidal function
        const zOscillation = Math.sin(angle * 2) * 0.05; // Small oscillation along Z-axis

        // Update planet position (aligned with the XY plane)
        const x = Math.cos(angle) * currentRadius; // Spiral along the X-axis
        const y = Math.sin(angle) * currentRadius; // Spiral along the Y-axis
        const z = zOscillation; // Smooth and subtle oscillation

        planet.position.set(x, y, z);

        // Update tail positions to follow the planet in a spiral motion
        const tailPositions = tail.geometry.attributes.position
          .array as Float32Array;

        for (let i = 0; i < planetParams.tailSegments; i++) {
          const t = i / (planetParams.tailSegments - 1); // Interpolation factor (0 to 1)

          // Calculate interpolated radius and angle for the tail segment
          const segmentRadius = currentRadius * (1 - t); // Gradually reduce the radius toward the core
          const segmentAngle = angle - t * Math.PI * 2; // Spread the tail along the spiral

          const tx = Math.cos(segmentAngle) * segmentRadius; // Align with X-axis
          const ty = Math.sin(segmentAngle) * segmentRadius; // Align with Y-axis
          const tz = zOscillation * (1 - t); // Gradually reduce oscillation toward core

          tailPositions[i * 3] = tx;
          tailPositions[i * 3 + 1] = ty;
          tailPositions[i * 3 + 2] = tz;
        }

        tail.geometry.attributes.position.needsUpdate = true;

        // Check if the planet is close to the core
        if (currentRadius <= 3) {
          // Fade out and remove the planet and tail
          fadeOutObject(planet);
          fadeOutObject(tail);
          clearInterval(animationInterval); // Stop animation
          createCoreEjectionFlare();
        }
      };

      const animationInterval = setInterval(animatePlanet, 50); // Update every 50ms

      planetCount++; // Increment planet count for orbit variation
    };

    let isDragging = false;
    let mouseDownPosition = { x: 0, y: 0 };

    // Add event listeners for detecting clicks vs dragging
    const onMouseDown = (event: MouseEvent) => {
      isDragging = false;
      mouseDownPosition = { x: event.clientX, y: event.clientY };
    };
    const onMouseMove = (event: MouseEvent) => {
      const dx = event.clientX - mouseDownPosition.x;
      const dy = event.clientY - mouseDownPosition.y;

      // Set a small threshold to distinguish between click and drag
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        isDragging = true;
      }
    };

    const onMouseUp = (event: MouseEvent) => {
      if (!isDragging) {
        // If not dragging, treat as a click and create the planet
        createAbsorbingPlanet();
      }
    };

    // Attach event listeners
    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mouseup", onMouseUp);

    // Utility function to fade out and remove objects
    const fadeOutObject = (object: THREE.Object3D) => {
      let opacity = 1.0;

      const fadeInterval = setInterval(() => {
        opacity -= 0.05;
        if (object instanceof THREE.Points) {
          const material = object.material as THREE.ShaderMaterial;
          material.uniforms.opacity.value = opacity;
        } else if (object instanceof THREE.Mesh) {
          (object.material as THREE.MeshBasicMaterial).opacity = opacity;
        }

        if (opacity <= 0) {
          scene.remove(object);
          clearInterval(fadeInterval);
        }
      }, 50);
    };

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
      count: 4000, // Number of particles
      radius: 60, // Maximum radius of the disk
      branches: 5, // Number of spiral arms
      randomness: 0.05, // Randomness factor for particle positioning
      heightVariation: 0.01, // Vertical randomness
      spin: 0.1, // Spin factor for the spiral arms
      speed: 0.01, // Rotation speed
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
        size: 0.33, // Particle size
        color: 0xb0003c,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      });

      const galaxyDisk = new THREE.Points(diskGeometry, diskMaterial);

      // Rotate the disk to align it perpendicular to the jet streams
      galaxyDisk.rotation.x = Math.PI / 2;

      // scene.add(galaxyDisk);

      // Animate the disk rotation in the animation loop
      const animateDisk = () => {
        galaxyDisk.rotation.y += diskParameters.speed; // Smooth rotation around the z-axis
      };

      return { galaxyDisk, animateDisk };
    };

    // add gui for the disk rotation
    gui
      .add(diskParameters, "speed", 0.01, 0.1)
      .name("Disk Rotation Speed")
      .onChange((v: number) => (diskParameters.speed = v));

    const createCoreEjectionFlare = () => {
      const flareParameters = {
        count: 10000, // Number of particles per ejection
        size: 5, // Initial size of particles
        speed: 2.5, // Initial speed of particles
        acceleration: 0.25, // Acceleration per frame
        maxLifetime: 5, // Lifetime in seconds
      };

      // Geometry for particles
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(flareParameters.count * 3);
      const velocities = new Float32Array(flareParameters.count * 3);

      // Initialize positions at the core and assign random velocities
      for (let i = 0; i < flareParameters.count; i++) {
        const angle = Math.random() * Math.PI * 2; // Random direction
        const speed = Math.random() * flareParameters.speed;

        // Position (start at the core)
        positions[i * 3] = 0; // X (core position)
        positions[i * 3 + 1] = 0; // Y (core position)
        positions[i * 3 + 2] = 1; // Z (core position)

        // Velocity (random outward direction)
        velocities[i * 3] = Math.cos(angle) * speed; // X velocity
        velocities[i * 3 + 1] = (Math.random() - 0.5) * speed; // Y velocity (vertical spread)
        // velocities[i * 3 + 2] = Math.sin(angle) * speed; // Z velocity
        velocities[i * 3 + 2] = Math.sin(angle) * speed; // Z velocity
      }

      geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(positions, 3)
      );
      geometry.setAttribute(
        "velocity",
        new THREE.BufferAttribute(velocities, 3)
      );

      // Particle material
      const material = new THREE.PointsMaterial({
        size: flareParameters.size,
        // the color of the random planets that teared off from the quasar, something other than orange, similar with the cold ice color
        color: 0xffe5c4,
        map: new THREE.TextureLoader().load(
          "/textures/transparent/star_05.png"
        ),
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        opacity: 1.0, // Fully visible initially
      });

      const particles = new THREE.Points(geometry, material);
      scene.add(particles);

      // Animation logic
      let lifetime = 0;

      const animateFlare = () => {
        lifetime += 0.05; // Increment time

        // Get position and velocity arrays
        const posArray = geometry.attributes.position.array as Float32Array;
        const velArray = geometry.attributes.velocity.array as Float32Array;

        // Update positions and velocities
        for (let i = 0; i < posArray.length; i += 3) {
          velArray[i] *= 1 + flareParameters.acceleration; // Accelerate X
          velArray[i + 1] *= 1 + flareParameters.acceleration; // Accelerate Y
          velArray[i + 2] *= 1 + flareParameters.acceleration; // Accelerate Z

          posArray[i] += velArray[i]; // Update X position
          posArray[i + 1] += velArray[i + 1]; // Update Y position
          posArray[i + 2] += velArray[i + 2]; // Update Z position
        }

        geometry.attributes.position.needsUpdate = true;

        // Gradually fade particles
        material.opacity = Math.max(
          1.0 - lifetime / flareParameters.maxLifetime,
          0
        );

        // Remove flare when lifetime is over
        if (lifetime >= flareParameters.maxLifetime) {
          scene.remove(particles);
          clearInterval(animationInterval);
        }
      };

      material.size = flareParameters.size + lifetime * 0.2; // Gradually increase size

      const animationInterval = setInterval(animateFlare, 50); // Update every 50ms
    };

    // Call this function to create the galaxy disk
    const { galaxyDisk, animateDisk } = createGalaxyDisk();

    const lensDistortionShader = {
      uniforms: {
        tDiffuse: { value: null },
        strength: { value: 0.1 },
        center: { value: new THREE.Vector2(0.5, 0.5) },
        radius: { value: 0.3 }, // Initial radius
        smoothness: { value: 0.1 },
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
        uniform vec2 center;
        uniform float radius;
        uniform float smoothness;
        varying vec2 vUv;
    
        void main() {
          // Calculate distance from the center
          float dist = distance(vUv, center);
    
          // Apply radial falloff
          float falloff = smoothstep(radius, radius + smoothness, dist);
    
          // Apply distortion only within the falloff radius
          vec2 uv = vUv;
          if (dist < radius) {
            vec2 offset = vUv - center;
            uv -= strength * offset * (1.0 - falloff) * dist * dist;
          }
    
          gl_FragColor = texture2D(tDiffuse, uv);
        }
      `,
    };

    const distortionPass = new ShaderPass(lensDistortionShader);
    distortionPass.uniforms.center.value = new THREE.Vector2(0.5, 0.5); // Center on screen
    distortionPass.uniforms.radius.value = 1; // Base distortion radius
    distortionPass.uniforms.smoothness.value = 0.5;
    distortionPass.uniforms.strength.value = 0.4;

    composer.addPass(distortionPass);

    composer.addPass(distortionPass);

    // Animation Loop
    const clock = new THREE.Clock();

    const tick = () => {
      const elapsedTime = clock.getElapsedTime();

      // Animate galaxy disk
      animateDisk();

      // Rotate the new core model
      const newCoreModel = scene.getObjectByName("coreModel");
      if (newCoreModel) {
        newCoreModel.rotation.y = elapsedTime * 0.4;
      }

      // Animate jets
      // Update animations
      animateJets();

      // Animate disk particles

      // animateAccretionDisk();
      animateDiskRings(elapsedTime);

      // Render scene
      controls.update();
      composer.render();

      requestAnimationFrame(tick);
    };
    tick();

    return () => {
      gui.destroy();
      disposeScene();
      disposeRenderer();
      disposeGUI();
      disposeControls();
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mouseup", onMouseMove);
    };
  }, []);

  return <canvas ref={el}></canvas>;
}

export default QuasarSimulation;

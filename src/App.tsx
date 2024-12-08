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
      0.07, // Lowered strength (was 0.8)
      0.001, // Slight radius for subtle effect
      0.25 // Higher threshold to exclude dimmer objects
    );
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

    // GUI for bloom adjustments
    const bloomParams = { strength: 1.0, radius: 0.01, threshold: 0.25 };
    gui
      .add(bloomParams, "strength", 0, 0.09)
      .onChange((v: number) => (bloomPass.strength = v));
    gui
      .add(bloomParams, "radius", 0, 1)
      .onChange((v: number) => (bloomPass.radius = v));
    gui
      .add(bloomParams, "threshold", 0, 1)
      .onChange((v: number) => (bloomPass.threshold = v));

    // Quasar Core
    // const coreMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    // const coreGeometry = new THREE.SphereGeometry(1, 32, 32);
    // const core = new THREE.Mesh(coreGeometry, coreMaterial);
    // Core of the black hole
    const coreGeometry = new THREE.SphereGeometry(5, 64, 64);
    const coreMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    scene.add(core);

    camera.lookAt(core.position);

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
    scene.add(eventHorizon);

    const lensingShader = {
      uniforms: {
        tDiffuse: { value: null },
        distortionStrength: { value: 0.05 },
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

    composer.addPass(lensingPass);

    const diskParams = {
      count: 10000,
      radius: 50,
      spin: 2.0,
    };

    const accretionDiskGeometry = new THREE.BufferGeometry();
    const diskPositions = new Float32Array(diskParams.count * 3);
    const diskColors = new Float32Array(diskParams.count * 3);

    for (let i = 0; i < diskParams.count; i++) {
      const angle = (i / diskParams.count) * Math.PI * 2 * diskParams.spin;
      const distance = Math.random() * diskParams.radius;
      const height = (Math.random() - 0.5) * 0.1; // Slight vertical variation

      diskPositions[i * 3] = Math.cos(angle) * distance;
      diskPositions[i * 3 + 1] = Math.sin(angle) * distance;
      diskPositions[i * 3 + 2] = height;

      diskColors[i * 3] = 1.0; // Red
      diskColors[i * 3 + 1] = 0.5; // Orange
      diskColors[i * 3 + 2] = 0.2; // Yellow
    }

    accretionDiskGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(diskPositions, 3)
    );
    accretionDiskGeometry.setAttribute(
      "color",
      new THREE.BufferAttribute(diskColors, 3)
    );

    const accretionDiskMaterial = new THREE.PointsMaterial({
      size: 0.1,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const accretionDisk = new THREE.Points(
      accretionDiskGeometry,
      accretionDiskMaterial
    );
    scene.add(accretionDisk);

    // Rotation Animation
    const animateAccretionDisk = () => {
      accretionDisk.rotation.z += 0.2;
    };

    // Shader Glow for Core
    // const glowMaterial = new THREE.ShaderMaterial({
    //   uniforms: {
    //     viewVector: { value: camera.position },
    //     glowColor: { value: new THREE.Color(0x99ccff) },
    //     coefficient: { value: 0.1 }, // Reduce intensity
    //     power: { value: 0.8 }, // Lowered power
    //   },
    //   vertexShader: `
    //     uniform vec3 viewVector;
    //     uniform float power;
    //     varying float intensity;

    //     void main() {
    //       vec3 vNormal = normalize(normalMatrix * normal);
    //       vec3 vNormView = normalize(viewVector - (modelViewMatrix * vec4(position, 1.0)).xyz);
    //       intensity = pow(dot(vNormal, vNormView), power);
    //       gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    //     }
    //   `,
    //   fragmentShader: `
    //     uniform vec3 glowColor;
    //     varying float intensity;

    //     void main() {
    //       gl_FragColor = vec4(glowColor * intensity, 1.0);
    //     }
    //   `,
    //   side: THREE.BackSide,
    //   blending: THREE.AdditiveBlending,
    //   transparent: true,
    //   depthWrite: false,
    // });

    const glowGeometry = new THREE.SphereGeometry(5.2, 32, 32); // Slightly larger than core

    const glowMaterial = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        baseColor: { value: new THREE.Color(0x99ccff) },
      },
      vertexShader: `
        uniform float time;
        varying float intensity;
    
        void main() {
          intensity = 0.5 + 0.5 * sin(time * 3.0); // Pulsating intensity
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 baseColor;
        varying float intensity;
    
        void main() {
          gl_FragColor = vec4(baseColor * intensity, 1.0);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    scene.add(glow);
    // Animate pulsation
    const animateGlow = (time: number): void => {
      glowMaterial.uniforms.time.value = time;
    };

    // Jets
    const jetParameters = {
      count: 10000, // Increase the number of particles
      radius: 0.5, // Increase starting radius for a denser emission
      height: 1000,
      spread: 0.05,
      acceleration: 0.01,
      speed: 1.5, // Slightly faster initial speed
      turbulence: 0.0054,
    };

    const jetParams = { speed: 1.5, turbulence: 0.02, spread: 0.2 };
    // gui
    //   .add(jetParams, "speed", 0.1, 5)
    //   .onChange((v: number) => (jetParameters.speed = v));
    // gui
    //   .add(jetParams, "turbulence", 0.0, 0.1)
    //   .onChange((v: number) => (jetParameters.turbulence = v));
    // gui
    //   .add(jetParams, "spread", 0.0, 0.5)
    //   .onChange((v: number) => (jetParameters.spread = v));

    const createJetStreams = () => {
      // const jetParameters = {
      //   count: 50000, // Higher particle count for denser streams
      //   radius: 1.5, // Wider initial spread
      //   height: 1200, // Increased jet height
      //   spread: 0.03, // Larger spread for a gas-like effect
      //   acceleration: 0.005, // Reduce acceleration for smoother motion
      //   speed: 1.5, // Adjust initial speed
      //   turbulence: 0.02, // Subtle randomness
      // };

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

      const lifetimes = new Float32Array(jetParameters.count).fill(1.0); // Full opacity initially

      jetGeometry.setAttribute(
        "lifetime",
        new THREE.BufferAttribute(lifetimes, 1)
      );

      const jetMaterial = new THREE.ShaderMaterial({
        uniforms: {
          color: { value: new THREE.Color(0x99ccff) },
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

    const { jets: jetUp, animateJets: animateJetUp } = createJetStreams();
    const { jets: jetDown, animateJets: animateJetDown } = createJetStreams();

    jetDown.rotation.x = Math.PI; // Flip the second jet for downward emission

    scene.add(jetUp);
    scene.add(jetDown);

    const createAbsorbingPlanet = () => {
      const planetParams = {
        radius: 3, // Size of the planet
        orbitRadius: 40, // Starting distance from the core
        angularSpeed: 0.05, // Angular velocity (for spiral motion)
        radialSpeed: 0.3, // Speed at which it moves toward the core
        tailSegments: 50, // Number of segments in the tail
        tailSize: 10, // Base size of tail particles
      };

      // Create the planet
      const planetGeometry = new THREE.SphereGeometry(
        planetParams.radius,
        32,
        32
      );
      const planetMaterial = new THREE.MeshBasicMaterial({ color: 0x4682b4 }); // Cold blue
      const planet = new THREE.Mesh(planetGeometry, planetMaterial);
      scene.add(planet);

      // Create the tail as a line of particles
      const tailGeometry = new THREE.BufferGeometry();
      const tailPositions = new Float32Array(planetParams.tailSegments * 3); // 3 values per segment (x, y, z)
      const tailSizes = new Float32Array(planetParams.tailSegments); // Size for each segment

      // Initialize positions along the path from the core to the planet
      for (let i = 0; i < planetParams.tailSegments; i++) {
        const t = i / (planetParams.tailSegments - 1); // Interpolation factor (0 to 1)
        const x = Math.cos(0) * planetParams.orbitRadius * (1 - t); // Linear interpolation to core
        const z = Math.sin(0) * planetParams.orbitRadius * (1 - t);
        const y = 0;

        tailPositions[i * 3] = x;
        tailPositions[i * 3 + 1] = y;
        tailPositions[i * 3 + 2] = z;

        // Tail segment sizes shrink closer to the core
        tailSizes[i] = planetParams.tailSize * (1 - t); // Smaller closer to core
      }

      tailGeometry.setAttribute(
        "position",
        new THREE.BufferAttribute(tailPositions, 3)
      );
      tailGeometry.setAttribute(
        "size",
        new THREE.BufferAttribute(tailSizes, 1)
      );

      const tailMaterial = new THREE.ShaderMaterial({
        uniforms: {
          pointTexture: {
            value: new THREE.TextureLoader().load("/textures/flare.jpg"),
          },
          opacity: { value: 0.5 }, // Adjust opacity
        },
        vertexShader: `
          attribute float size;
          varying float vSize;
      
          void main() {
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            vSize = size;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = size * (300.0 / max(-mvPosition.z, 0.001));
          }
        `,
        fragmentShader: `
          varying float vSize;
          uniform sampler2D pointTexture;
          uniform float opacity;
      
          void main() {
            vec4 color = texture2D(pointTexture, gl_PointCoord);
            gl_FragColor = vec4(color.rgb, color.a * opacity); // Use uniform opacity
          }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });

      const tail = new THREE.Points(tailGeometry, tailMaterial);
      scene.add(tail);

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

        // Update tail positions
        const tailPositions = tail.geometry.attributes.position
          .array as Float32Array;

        for (let i = 0; i < planetParams.tailSegments; i++) {
          const t = i / (planetParams.tailSegments - 1); // Interpolation factor (0 to 1)

          // Calculate spiral offset for each segment
          const segmentAngle = angle - t * Math.PI * 2; // Spread the segments around the spiral
          const segmentRadius = currentRadius * (1 - t); // Gradually reduce the radius

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
          setTimeout(() => {
            createAbsorbingPlanet();
          }, 5000);
        }
      };

      // Animate the planet and tail
      const animationInterval = setInterval(animatePlanet, 50); // Update every 50ms
    };

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
      count: 2000, // Number of particles
      radius: 60, // Maximum radius of the disk
      branches: 3, // Number of spiral arms
      randomness: 0.3, // Randomness factor for particle positioning
      heightVariation: 0.3, // Vertical randomness
      spin: 0.1, // Spin factor for the spiral arms
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
        size: 0.5, // Particle size
        color: 0xffcc00, // Yellowish glow
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
        galaxyDisk.rotation.y += 0.02; // Smooth rotation around the z-axis
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
          float intensity = 0.01 / length(vPosition - lightPosition);
          gl_FragColor = vec4(vec3(intensity), 1.0);
        }
      `,
    };

    const createCoreEjectionFlare = () => {
      const flareParameters = {
        count: 10000, // Number of particles per ejection
        size: 0.3, // Initial size of particles
        speed: 1, // Initial speed of particles
        acceleration: 0.001, // Acceleration per frame
        maxLifetime: 10, // Lifetime in seconds
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
        color: 0x4682b4,
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

    const animateDiskParticles = () => {
      const positions = galaxyDisk.geometry.attributes.position
        .array as Float32Array;
      for (let i = 0; i < positions.length; i += 3) {
        const distance = Math.sqrt(positions[i] ** 2 + positions[i + 2] ** 2);
        const drift = 0.001 * Math.sign(distance); // Small outward drift

        if (distance < diskParameters.radius) {
          // positions[i] += positions[i] * drift;
          // positions[i + 2] += positions[i + 2] * drift;
        }
      }
      galaxyDisk.geometry.attributes.position.needsUpdate = true;
    };

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

    // const distortionPass = new ShaderPass(lensDistortionShader);
    const distortionPass = new ShaderPass(lensDistortionShader);
    distortionPass.uniforms.center.value = new THREE.Vector2(0.5, 0.5); // Center on screen
    distortionPass.uniforms.radius.value = 0.3; // Base distortion radius
    distortionPass.uniforms.smoothness.value = 0.1;
    distortionPass.uniforms.strength.value = 0.2;

    composer.addPass(distortionPass);

    composer.addPass(distortionPass);

    // add volumetricLightShader to the composer
    const volumetricLightPass = new ShaderPass(volumetricLightShader);
    // composer.addPass(volumetricLightPass);

    let targetCoefficient = 0.5;
    let targetPower = 2.0;

    canvas.addEventListener("click", () => {
      targetCoefficient = 1.0;
      targetPower = 4.0;
    });

    const triggerAbsorbingPlanets = () => {
      createAbsorbingPlanet(); // Create a new absorbing planet
    };
    triggerAbsorbingPlanets();

    // Animation Loop
    const clock = new THREE.Clock();

    const tick = () => {
      const elapsedTime = clock.getElapsedTime();

      // Animate core and glow
      core.rotation.y = elapsedTime * 0.5;

      // Animate galaxy disk
      animateDisk();

      // Animate jets
      // Update animations
      animateJetUp();
      animateJetDown();

      // Animate disk particles
      animateDiskParticles();

      animateAccretionDisk();
      animateGlow(elapsedTime);
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
    };
  }, []);

  return <canvas ref={el}></canvas>;
}

export default QuasarSimulation;

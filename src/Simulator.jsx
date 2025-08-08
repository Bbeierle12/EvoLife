import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import * as d3 from "d3";

export default function Simulator() {
  const containerRef = useRef(null);
  const rafRef = useRef(null);
  const rendererRef = useRef(null);

  useEffect(() => {
    console.log("[Simulator] mount");
    const container = containerRef.current;
    if (!container) return;

    // Scene & camera
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0e0e12);

    const camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.set(2.5, 2.5, 3.5);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dir = new THREE.DirectionalLight(0xffffff, 1.0);
    dir.position.set(5, 5, 5);
    scene.add(dir);

    // Cube
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({
      color: 0x00aaff,
      roughness: 0.4,
      metalness: 0.1
    });
    const cube = new THREE.Mesh(geometry, material);
    scene.add(cube);

    // d3 color animation
    const colorScale = d3.scaleSequential(d3.interpolateTurbo).domain([0, 5000]);

    // Resize handling
    const onResize = () => {
      if (!rendererRef.current) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      rendererRef.current.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);

    // Loop
    const tick = (t) => {
      cube.rotation.x += 0.01;
      cube.rotation.y += 0.013;
      material.color.set(colorScale(t % 5000));
      renderer.render(scene, camera);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    // Cleanup
    return () => {
      console.log("[Simulator] cleanup");
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", onResize);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      if (renderer.domElement?.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Fill the viewport
  return (
    <div
      ref={containerRef}
      style={{ width: "100vw", height: "100vh", overflow: "hidden", position: "relative" }}
    >
      <div
        style={{
          position: "absolute",
          top: 12,
          left: 16,
          fontFamily: "system-ui, sans-serif",
          fontSize: 14,
          color: "#ddd",
          opacity: 0.8,
          userSelect: "none"
        }}
      >
        EvoLife: Three.js sanity check
      </div>
    </div>
  );
}
'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * Latar header: bidang partikel bergelombang (Three.js) dengan parallax halus
 * mengikuti kursor. Dekoratif murni — pointer-events dimatikan, dan pada
 * prefers-reduced-motion hanya dirender satu frame statis.
 */
export default function HeroBackground() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
    camera.position.set(0, 5.5, 13);
    camera.lookAt(0, 0, 0);

    // Grid titik yang nantinya diayunkan seperti permukaan air
    const COLS = 110;
    const ROWS = 34;
    const SPACING = 0.55;
    const positions = new Float32Array(COLS * ROWS * 3);
    let i = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        positions[i++] = (c - COLS / 2) * SPACING;
        positions[i++] = 0;
        positions[i++] = (r - ROWS / 2) * SPACING;
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.045,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    const points = new THREE.Points(geometry, material);
    scene.add(points);

    const pointer = { x: 0, y: 0 };
    const onMouseMove = (e: MouseEvent) => {
      pointer.x = e.clientX / window.innerWidth - 0.5;
      pointer.y = e.clientY / window.innerHeight - 0.5;
    };
    window.addEventListener('mousemove', onMouseMove);

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = mount;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);

    let raf = 0;
    let t = 0;
    const render = () => {
      t += 0.012;
      const pos = geometry.attributes.position as THREE.BufferAttribute;
      for (let p = 0; p < COLS * ROWS; p++) {
        const x = pos.getX(p);
        const z = pos.getZ(p);
        pos.setY(p, Math.sin(x * 0.5 + t) * 0.4 + Math.cos(z * 0.45 + t * 0.75) * 0.35);
      }
      pos.needsUpdate = true;

      // Parallax lembut ke arah kursor
      points.rotation.y += (pointer.x * 0.18 - points.rotation.y) * 0.04;
      points.rotation.x += (pointer.y * 0.1 - points.rotation.x) * 0.04;

      renderer.render(scene, camera);
      if (!reducedMotion) raf = requestAnimationFrame(render);
    };
    render();

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      window.removeEventListener('mousemove', onMouseMove);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div
      ref={mountRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 opacity-70 [&>canvas]:h-full [&>canvas]:w-full"
    />
  );
}

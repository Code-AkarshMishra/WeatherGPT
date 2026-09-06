import { useEffect, useRef } from 'react';
import { weatherAudio } from '../services/weatherAudio';

/**
 * AtmosphericCanvas
 * High-performance HTML5 Canvas rendering realistic weather atmospherics:
 * - Thunderstorm with branching lightning bolts, sky illumination & thunder audio sync
 * - Rain with multi-layer depth & splash droplets
 * - Volumetric drifting clouds
 * - Radiant sun rays and atmospheric dust motes
 * - Swaying snowflakes
 */
export default function AtmosphericCanvas({ condition = 'clear', rainProbability = 50, interactive = true }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId;
    let width = (canvas.width = canvas.parentElement?.clientWidth || window.innerWidth);
    let height = (canvas.height = canvas.parentElement?.clientHeight || window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.parentElement?.clientWidth || window.innerWidth;
      height = canvas.height = canvas.parentElement?.clientHeight || window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    // Rain particles
    const rainCount = condition === 'storm' ? 140 : condition === 'rain' ? 90 : 0;
    const raindrops = Array.from({ length: rainCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      len: 12 + Math.random() * 18,
      speed: 12 + Math.random() * 10,
      opacity: 0.2 + Math.random() * 0.45,
      weight: 1 + Math.random() * 1.5,
    }));

    // Splash particles
    const splashes = [];
    const createSplash = (x, y) => {
      if (splashes.length > 50) return;
      for (let i = 0; i < 3; i++) {
        splashes.push({
          x,
          y,
          vx: (Math.random() - 0.5) * 4,
          vy: -Math.random() * 3 - 1,
          radius: 1 + Math.random() * 1.5,
          alpha: 0.6,
        });
      }
    };

    // Lightning state
    let lightningFlash = 0;
    let lightningBolts = [];
    let nextLightningTime = Date.now() + 2000 + Math.random() * 3500;

    const generateLightning = (startX, startY, endX, endY, branchLevel = 0) => {
      const bolt = [];
      let curX = startX;
      let curY = startY;
      const steps = 18;
      const dx = (endX - startX) / steps;
      const dy = (endY - startY) / steps;

      for (let i = 0; i < steps; i++) {
        const nextX = curX + dx + (Math.random() - 0.5) * 35;
        const nextY = curY + dy;
        bolt.push({ x1: curX, y1: curY, x2: nextX, y2: nextY });

        // Branching
        if (branchLevel < 2 && Math.random() < 0.25) {
          const branchAngle = (Math.random() - 0.5) * Math.PI * 0.5;
          const branchLength = 60 + Math.random() * 60;
          const bEndX = nextX + Math.sin(branchAngle) * branchLength;
          const bEndY = nextY + Math.cos(branchAngle) * branchLength;
          bolt.push(...generateLightning(nextX, nextY, bEndX, bEndY, branchLevel + 1));
        }

        curX = nextX;
        curY = nextY;
      }
      return bolt;
    };

    const triggerLightningBolt = () => {
      const startX = width * 0.2 + Math.random() * width * 0.6;
      const endX = startX + (Math.random() - 0.5) * 140;
      lightningBolts = generateLightning(startX, 0, endX, height * 0.7);
      lightningFlash = 0.85;

      // Sync sound
      weatherAudio.triggerThunder();
    };

    // Cloud motes / volumetric puffs
    const clouds = Array.from({ length: 12 }, () => ({
      x: Math.random() * width,
      y: Math.random() * (height * 0.5),
      radius: 60 + Math.random() * 90,
      speed: 0.15 + Math.random() * 0.25,
      alpha: 0.08 + Math.random() * 0.12,
    }));

    // Sun dust motes / sparkles
    const sunMotes = Array.from({ length: 30 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: 1 + Math.random() * 2.5,
      vy: -0.2 - Math.random() * 0.4,
      vx: (Math.random() - 0.5) * 0.3,
      alpha: 0.2 + Math.random() * 0.5,
    }));

    // Snowflakes
    const snowCount = condition === 'snow' ? 70 : 0;
    const snowflakes = Array.from({ length: snowCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: 1.5 + Math.random() * 3,
      speed: 0.8 + Math.random() * 1.6,
      wind: (Math.random() - 0.5) * 0.8,
      swing: Math.random() * Math.PI * 2,
    }));

    let lastTime = performance.now();

    const render = (now) => {
      const delta = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      ctx.clearRect(0, 0, width, height);

      // 1. SKY BASE GRADIENT
      let skyGrad = ctx.createLinearGradient(0, 0, 0, height);
      if (condition === 'storm') {
        skyGrad.addColorStop(0, '#1c2438');
        skyGrad.addColorStop(0.5, '#25334d');
        skyGrad.addColorStop(1, '#1b2333');
      } else if (condition === 'rain') {
        skyGrad.addColorStop(0, '#2d3b4e');
        skyGrad.addColorStop(0.6, '#38485e');
        skyGrad.addColorStop(1, '#2c3746');
      } else if (condition === 'cloudy') {
        skyGrad.addColorStop(0, '#3a4b60');
        skyGrad.addColorStop(0.7, '#4e627d');
        skyGrad.addColorStop(1, '#3b4756');
      } else if (condition === 'snow') {
        skyGrad.addColorStop(0, '#374151');
        skyGrad.addColorStop(0.7, '#4b5563');
        skyGrad.addColorStop(1, '#374151');
      } else {
        // clear / sunny
        skyGrad.addColorStop(0, '#1e3a8a');
        skyGrad.addColorStop(0.4, '#2563eb');
        skyGrad.addColorStop(1, '#0284c7');
      }
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, width, height);

      // 2. SUN RAYS / SOLAR AURA (FOR CLEAR)
      if (condition === 'clear') {
        const sunX = width * 0.75;
        const sunY = height * 0.15;
        const sunGlow = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, width * 0.8);
        sunGlow.addColorStop(0, 'rgba(253, 224, 71, 0.35)');
        sunGlow.addColorStop(0.3, 'rgba(245, 158, 11, 0.15)');
        sunGlow.addColorStop(1, 'rgba(245, 158, 11, 0)');
        ctx.fillStyle = sunGlow;
        ctx.fillRect(0, 0, width, height);

        // Sun motes
        sunMotes.forEach((m) => {
          m.y += m.vy;
          m.x += m.vx;
          if (m.y < 0) m.y = height;
          if (m.x < 0) m.x = width;
          if (m.x > width) m.x = 0;

          ctx.beginPath();
          ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(254, 240, 138, ${m.alpha})`;
          ctx.fill();
        });
      }

      // 3. DRIFTING CLOUDS
      if (condition === 'cloudy' || condition === 'storm' || condition === 'rain') {
        clouds.forEach((c) => {
          c.x += c.speed;
          if (c.x - c.radius > width) c.x = -c.radius;

          const cloudGrad = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.radius);
          const cColor = condition === 'storm' ? '28, 38, 56' : '100, 116, 139';
          cloudGrad.addColorStop(0, `rgba(${cColor}, ${c.alpha * 1.5})`);
          cloudGrad.addColorStop(0.7, `rgba(${cColor}, ${c.alpha * 0.6})`);
          cloudGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

          ctx.beginPath();
          ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2);
          ctx.fillStyle = cloudGrad;
          ctx.fill();
        });
      }

      // 4. LIGHTNING FLASH & BOLTS (FOR STORM)
      if (condition === 'storm') {
        if (Date.now() > nextLightningTime) {
          triggerLightningBolt();
          nextLightningTime = Date.now() + 3200 + Math.random() * 4500;
        }

        if (lightningFlash > 0) {
          // Whole sky glow
          ctx.fillStyle = `rgba(224, 242, 254, ${lightningFlash * 0.45})`;
          ctx.fillRect(0, 0, width, height);

          // Draw bolt
          ctx.save();
          ctx.strokeStyle = `rgba(255, 255, 255, ${Math.min(1, lightningFlash * 1.5)})`;
          ctx.lineWidth = 2.5;
          ctx.shadowColor = '#67e8f9';
          ctx.shadowBlur = 14;

          lightningBolts.forEach((seg) => {
            ctx.beginPath();
            ctx.moveTo(seg.x1, seg.y1);
            ctx.lineTo(seg.x2, seg.y2);
            ctx.stroke();
          });
          ctx.restore();

          lightningFlash -= delta * 1.8;
          if (lightningFlash < 0) {
            lightningFlash = 0;
            lightningBolts = [];
          }
        }
      }

      // 5. FALLING RAIN & SPLASHES
      if (condition === 'storm' || condition === 'rain') {
        ctx.strokeStyle = condition === 'storm' ? 'rgba(186, 230, 253, 0.45)' : 'rgba(224, 242, 254, 0.35)';
        ctx.lineWidth = 1.2;

        raindrops.forEach((r) => {
          ctx.beginPath();
          ctx.moveTo(r.x, r.y);
          // angle slightly with wind
          ctx.lineTo(r.x - 3, r.y + r.len);
          ctx.stroke();

          r.y += r.speed;
          r.x -= 1.5;

          if (r.y > height - 10) {
            if (Math.random() < 0.3) createSplash(r.x, height - 8);
            r.y = -20;
            r.x = Math.random() * width + 50;
          }
        });

        // Update splashes
        for (let i = splashes.length - 1; i >= 0; i--) {
          const sp = splashes[i];
          sp.x += sp.vx;
          sp.y += sp.vy;
          sp.vy += 0.15; // gravity
          sp.alpha -= delta * 2;

          if (sp.alpha <= 0) {
            splashes.splice(i, 1);
            continue;
          }

          ctx.beginPath();
          ctx.arc(sp.x, sp.y, sp.radius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(186, 230, 253, ${sp.alpha})`;
          ctx.fill();
        }
      }

      // 6. SNOW
      if (condition === 'snow') {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
        snowflakes.forEach((s) => {
          s.swing += 0.02;
          s.y += s.speed;
          s.x += Math.sin(s.swing) * s.wind;

          if (s.y > height) {
            s.y = -10;
            s.x = Math.random() * width;
          }

          ctx.beginPath();
          ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    // Optional click to trigger lightning in storm mode
    const handleClick = (e) => {
      if (!interactive) return;
      if (condition === 'storm') {
        triggerLightningBolt();
      }
    };

    canvas.addEventListener('click', handleClick);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('click', handleClick);
    };
  }, [condition, rainProbability, interactive]);

  return (
    <canvas
      ref={canvasRef}
      className="atmospheric-canvas"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: interactive ? 'auto' : 'none',
        zIndex: 0,
      }}
    />
  );
}

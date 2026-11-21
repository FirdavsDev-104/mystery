import * as THREE from 'three';

function makeCanvasTexture(
  size: number,
  draw: (ctx: CanvasRenderingContext2D, size: number) => void,
  repeatX = 1,
  repeatY = 1,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 4;
  return tex;
}

export function createGrassTexture(repeat = 8): THREE.CanvasTexture {
  return makeCanvasTexture(
    256,
    (ctx, s) => {
      ctx.fillStyle = '#3b8c47';
      ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 650; i++) {
        ctx.fillStyle = i % 2 === 0 ? 'rgba(92, 184, 92, 0.25)' : 'rgba(34, 92, 42, 0.25)';
        ctx.fillRect((i * 73) % s, (i * 137) % s, 6, 10);
      }
    },
    repeat,
    repeat,
  );
}

export function createAsphaltTexture(repeatX = 1, repeatY = 12): THREE.CanvasTexture {
  return makeCanvasTexture(
    256,
    (ctx, s) => {
      ctx.fillStyle = '#242933';
      ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 900; i++) {
        const v = 30 + (i % 25);
        ctx.fillStyle = `rgb(${v},${v + 2},${v + 6})`;
        ctx.fillRect((i * 59) % s, (i * 97) % s, 3, 3);
      }
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(10, 0, 8, s);
      ctx.fillRect(s - 18, 0, 8, s);
      ctx.fillStyle = '#f59e0b';
      for (let y = 0; y < s; y += 64) {
        ctx.fillRect(s / 2 - 4, y + 8, 8, 36);
      }
    },
    repeatX,
    repeatY,
  );
}

export function createPitchTexture(): THREE.CanvasTexture {
  return makeCanvasTexture(
    512,
    (ctx, s) => {
      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#2f8a42' : '#379c4c';
        ctx.fillRect(0, (i * s) / 8, s, s / 8);
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 6;
      ctx.strokeRect(20, 20, s - 40, s - 40);
      ctx.beginPath();
      ctx.moveTo(20, s / 2);
      ctx.lineTo(s - 20, s / 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(s / 2, s / 2, 58, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeRect(s / 2 - 90, 20, 180, 64);
      ctx.strokeRect(s / 2 - 90, s - 84, 180, 64);
    },
    1,
    1,
  );
}

export function createGridFloorTexture(baseColor = '#172030', lineColor = '#2d3d56', repeat = 12): THREE.CanvasTexture {
  return makeCanvasTexture(
    256,
    (ctx, s) => {
      ctx.fillStyle = baseColor;
      ctx.fillRect(0, 0, s, s);
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 3;
      ctx.strokeRect(0, 0, s, s);
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(s / 2, 0);
      ctx.lineTo(s / 2, s);
      ctx.moveTo(0, s / 2);
      ctx.lineTo(s, s / 2);
      ctx.stroke();
    },
    repeat,
    repeat,
  );
}

export function createWoodTexture(base = '#9a6234'): THREE.CanvasTexture {
  return makeCanvasTexture(
    128,
    (ctx, s) => {
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      for (let y = 0; y < s; y += 16) {
        ctx.fillRect(0, y, s, 2);
      }
    },
    1,
    1,
  );
}

export function createVoxelFaceTexture(topColor: string, accentColor: string): THREE.CanvasTexture {
  return makeCanvasTexture(
    64,
    (ctx, s) => {
      ctx.fillStyle = topColor;
      ctx.fillRect(0, 0, s, s);
      for (let x = 0; x < s; x += 8) {
        for (let y = 0; y < s; y += 8) {
          if ((x * 7 + y * 13) % 5 === 0) {
            ctx.fillStyle = accentColor;
            ctx.fillRect(x, y, 8, 8);
          }
        }
      }
      ctx.strokeStyle = 'rgba(0,0,0,0.12)';
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, s, s);
    },
    1,
    1,
  );
}

import { useEffect, useState, type CSSProperties } from 'react';
import {
  Binary, Boxes, CircuitBoard, Cloud, Code2, Cpu, Database, Fingerprint,
  Layers3, LockKeyhole, Network, Radar, Radio, Server, ShieldCheck, Wifi,
  Workflow, Zap, type LucideIcon,
} from 'lucide-react';
import styles from './auth-cube.module.css';

const coordinates = [-1, 0, 1];
const faces = ['front', 'back', 'right', 'left', 'top', 'bottom'] as const;
// Three distinct symbols per outer face, with staggered positions and generous gaps.
// Keys are local face coordinates (u:v); no symbol is repeated across the six faces.
const faceIcons: Record<(typeof faces)[number], Partial<Record<string, LucideIcon>>> = {
  front: { '0:0': Cpu, '1:0': Cloud, '-1:1': Radio },
  back: { '-1:-1': Server, '0:0': Database, '1:1': Network },
  right: { '1:-1': Workflow, '0:0': Layers3, '-1:1': Boxes },
  left: { '-1:-1': Wifi, '0:0': Radar, '1:1': Zap },
  top: { '-1:-1': Binary, '0:0': Code2, '1:1': CircuitBoard },
  bottom: { '1:-1': LockKeyhole, '0:0': ShieldCheck, '-1:1': Fingerprint },
};
// A few independent modules pull away while the rest stays assembled.
const modules = {
  '0:-1:0': { offset: [0, -70, 0] },
  '1:0:1': { offset: [48, 0, 52] },
  '-1:1:1': { offset: [-38, 40, 48] },
  '1:1:-1': { offset: [54, 38, -30] },
} as const;

function CubeLayer({ y }: { y: number }) {
  return (
    <div className={styles.layer}>
      {coordinates.flatMap((x) => coordinates.map((z) => {
        const key = `${x}:${y}:${z}`;
        const module = modules[key as keyof typeof modules];
        return (
          <div
            key={key}
            className={styles.cubie}
            data-module={Boolean(module)}
            style={{ '--x': x, '--y': y, '--z': z,
              '--dx': `${module?.offset[0] ?? 0}px`,
              '--dy': `${module?.offset[1] ?? 0}px`,
              '--dz': `${module?.offset[2] ?? 0}px`,
            } as CSSProperties}
          >
            {faces.map((face) => {
              const visible = (face === 'front' && z === 1) || (face === 'back' && z === -1)
                || (face === 'right' && x === 1) || (face === 'left' && x === -1)
                || (face === 'top' && y === -1) || (face === 'bottom' && y === 1);
              const [u, v] = face === 'top' || face === 'bottom' ? [x, z]
                : face === 'right' || face === 'left' ? [z, y] : [x, y];
              const FaceIcon = visible ? faceIcons[face][`${u}:${v}`] : undefined;
              return (
                <span key={face} className={styles.face} data-face={face} data-sticker={visible}>
                  {FaceIcon && <FaceIcon size={27} strokeWidth={1.7} />}
                </span>
              );
            })}
          </div>
        );
      }))}
    </div>
  );
}

export function AuthCube() {
  const [expanded, setExpanded] = useState(false);
  // Restart the dwell period after every toggle, including a user's click.
  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce), (max-width: 1023px)');
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      clearTimeout(timer);
      if (!motion.matches && !document.hidden) {
        timer = setTimeout(() => setExpanded((value) => !value), 5000);
      }
    };
    schedule();
    motion.addEventListener('change', schedule);
    document.addEventListener('visibilitychange', schedule);
    return () => {
      clearTimeout(timer);
      motion.removeEventListener('change', schedule);
      document.removeEventListener('visibilitychange', schedule);
    };
  }, [expanded]);
  return (
    <div className={styles.scene} data-expanded={expanded}>
      <div className={styles.halo} />
      <div className={styles.orbit} />
      <div className={styles.cube} aria-hidden="true">
        {coordinates.map((y) => <CubeLayer key={y} y={y} />)}
      </div>
      <div className={styles.shadow} />
      <button
        type="button"
        className={styles.toggle}
        aria-label="展开魔方"
        aria-pressed={expanded}
        onClick={() => setExpanded((value) => !value)}
      />
    </div>
  );
}

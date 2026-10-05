import type { CSSProperties } from 'react';
import styles from './auth-cube.module.css';

const coordinates = [-1, 0, 1];
const faces = ['front', 'back', 'right', 'left', 'top', 'bottom'] as const;

function CubeLayer({ y }: { y: number }) {
  return (
    <div className={y === -1 ? styles.turningLayer : styles.layer}>
      {coordinates.flatMap((x) => coordinates.map((z) => (
        <div
          key={`${x}:${z}`}
          className={styles.cubie}
          style={{ '--x': x, '--y': y, '--z': z } as CSSProperties}
        >
          {faces.map((face) => {
            const visible = (face === 'front' && z === 1) || (face === 'back' && z === -1)
              || (face === 'right' && x === 1) || (face === 'left' && x === -1)
              || (face === 'top' && y === -1) || (face === 'bottom' && y === 1);
            return <span key={face} className={styles.face} data-face={face} data-sticker={visible} />;
          })}
        </div>
      )))}
    </div>
  );
}

/** Decorative CSS cube: whole-cube rotation and an independent top-layer turn. */
export function AuthCube() {
  return (
    <div className={styles.scene} aria-hidden="true">
      <div className={styles.cube}>
        {coordinates.map((y) => <CubeLayer key={y} y={y} />)}
      </div>
      <div className={styles.shadow} />
    </div>
  );
}

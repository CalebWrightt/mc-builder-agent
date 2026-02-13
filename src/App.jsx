import { useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei';

const BLOCK_COLORS = ['#FF7F7F', '#7FB3FF', '#7FFFB2', '#FFD27F', '#D29BFF'];
const GRID_SIZE = 12;

function Voxel({ position, color }) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={[0.95, 0.95, 0.95]} />
      <meshStandardMaterial color={color} roughness={0.38} metalness={0.08} />
    </mesh>
  );
}

function Ground({ hoverCell, onHover, onLeave, onPlace }) {
  return (
    <mesh
      position={[0, -0.5, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
      onPointerMove={(e) => {
        e.stopPropagation();
        const x = Math.floor(e.point.x + GRID_SIZE / 2);
        const z = Math.floor(e.point.y + GRID_SIZE / 2);
        if (x >= 0 && x < GRID_SIZE && z >= 0 && z < GRID_SIZE) {
          onHover([x, z]);
        }
      }}
      onPointerOut={onLeave}
      onClick={(e) => {
        e.stopPropagation();
        if (hoverCell) onPlace(hoverCell);
      }}
    >
      <planeGeometry args={[GRID_SIZE, GRID_SIZE]} />
      <meshStandardMaterial color="#f2f4f8" />
    </mesh>
  );
}

export default function App() {
  const [voxels, setVoxels] = useState([]);
  const [activeColor, setActiveColor] = useState(BLOCK_COLORS[0]);
  const [hoverCell, setHoverCell] = useState(null);

  const occupied = useMemo(() => new Set(voxels.map((v) => `${v.x}:${v.y}:${v.z}`)), [voxels]);

  const handlePlace = ([gridX, gridZ]) => {
    const x = gridX - GRID_SIZE / 2 + 0.5;
    const z = gridZ - GRID_SIZE / 2 + 0.5;
    let y = 0;
    while (occupied.has(`${x}:${y}:${z}`)) y += 1;
    setVoxels((prev) => [...prev, { x, y, z, color: activeColor }]);
  };

  const handleUndo = () => setVoxels((prev) => prev.slice(0, -1));
  const handleReset = () => setVoxels([]);

  const glassPanel = {
    background: 'rgba(255,255,255,0.85)',
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
    border: '1px solid rgba(255,255,255,0.45)',
    borderRadius: 18,
    boxShadow: '0 10px 34px rgba(23, 35, 68, 0.14)',
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        fontFamily: 'Inter, Segoe UI, Helvetica, Arial, sans-serif',
        background: 'radial-gradient(circle at top, #f5f7fa 0%, #c3cfe2 100%)',
        display: 'grid',
        gridTemplateRows: 'auto 1fr',
        padding: 18,
        gap: 14,
      }}
    >
      <header
        style={{
          ...glassPanel,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '14px 18px',
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: 0.3 }}>Voxel Architect</h1>
          <p style={{ margin: '4px 0 0', fontWeight: 600, opacity: 0.75 }}>Build stacked voxel concepts with a single click.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={hudButton} onClick={handleUndo}>Undo</button>
          <button style={hudButton} onClick={handleReset}>Reset</button>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 14, minHeight: 0 }}>
        <aside style={{ ...glassPanel, padding: 14, display: 'grid', alignContent: 'start', gap: 14 }}>
          <section>
            <h2 style={hudHeading}>Palette</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
              {BLOCK_COLORS.map((color) => (
                <button
                  key={color}
                  aria-label={`Set color ${color}`}
                  onClick={() => setActiveColor(color)}
                  style={{
                    height: 32,
                    borderRadius: 10,
                    border: activeColor === color ? '3px solid #1f2f54' : '2px solid rgba(0,0,0,0.15)',
                    background: color,
                    cursor: 'pointer',
                  }}
                />
              ))}
            </div>
          </section>

          <section>
            <h2 style={hudHeading}>HUD</h2>
            <p style={hudLabel}>Blocks: <strong>{voxels.length}</strong></p>
            <p style={hudLabel}>Active: <strong>{activeColor}</strong></p>
            <p style={hudLabel}>Tip: hover ground and click to place.</p>
          </section>
        </aside>

        <main style={{ ...glassPanel, overflow: 'hidden' }}>
          <Canvas shadows camera={{ position: [8, 9, 10], fov: 52 }}>
            <color attach="background" args={['#edf1f7']} />
            <ambientLight intensity={0.6} />
            <directionalLight castShadow position={[7, 12, 6]} intensity={1.3} shadow-mapSize={[2048, 2048]} />

            <Ground
              hoverCell={hoverCell}
              onHover={setHoverCell}
              onLeave={() => setHoverCell(null)}
              onPlace={handlePlace}
            />

            {voxels.map((voxel, i) => (
              <Voxel key={`${voxel.x}-${voxel.y}-${voxel.z}-${i}`} position={[voxel.x, voxel.y, voxel.z]} color={voxel.color} />
            ))}

            {hoverCell && (
              <mesh position={[hoverCell[0] - GRID_SIZE / 2 + 0.5, 0, hoverCell[1] - GRID_SIZE / 2 + 0.5]}>
                <boxGeometry args={[0.98, 0.06, 0.98]} />
                <meshBasicMaterial color={activeColor} transparent opacity={0.35} />
              </mesh>
            )}

            <ContactShadows position={[0, -0.49, 0]} opacity={0.35} blur={1.8} scale={15} />
            <Environment preset="city" />
            <OrbitControls makeDefault maxPolarAngle={Math.PI / 2.1} />
          </Canvas>
        </main>
      </div>
    </div>
  );
}

const hudHeading = {
  margin: '0 0 10px',
  fontSize: 14,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: 0.6,
  opacity: 0.7,
};

const hudLabel = {
  margin: '8px 0',
  fontSize: 14,
  fontWeight: 700,
  color: '#1e2a45',
};

const hudButton = {
  border: 'none',
  borderRadius: 10,
  padding: '10px 14px',
  fontWeight: 800,
  fontSize: 13,
  background: 'rgba(255,255,255,0.95)',
  boxShadow: '0 6px 14px rgba(30, 42, 69, 0.12)',
  cursor: 'pointer',
};

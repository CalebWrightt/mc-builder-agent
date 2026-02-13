import { Suspense, useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import {
  ContactShadows,
  Environment,
  GizmoHelper,
  GizmoViewport,
  Grid,
  OrbitControls,
  Stage,
} from '@react-three/drei';
import { SRGBColorSpace, TextureLoader } from 'three';

const DEFAULT_BLUEPRINT = {
  meta: { dimensions: { x: 10, y: 8, z: 10 } },
  palette: { '1': 'cobblestone', '2': 'planks_oak', '3': 'glass' },
  structure: [
    { y: 0, blocks: [{ x: 4, z: 4, id: '1' }, { x: 5, z: 4, id: '1' }, { x: 4, z: 5, id: '1' }, { x: 5, z: 5, id: '1' }] },
    { y: 1, blocks: [{ x: 4, z: 4, id: '2' }, { x: 5, z: 4, id: '2' }, { x: 4, z: 5, id: '2' }, { x: 5, z: 5, id: '2' }] },
    { y: 2, blocks: [{ x: 4, z: 4, id: '1' }, { x: 5, z: 4, id: '1' }, { x: 4, z: 5, id: '1' }, { x: 5, z: 5, id: '1' }, { x: 4, z: 6, id: '3' }] },
  ],
};

const THEMES = [
  {
    key: 'fantasy',
    title: 'Fantasy Bastion',
    subtitle: 'Classic keep with stone/oak accents',
    blueprint: DEFAULT_BLUEPRINT,
  },
  {
    key: 'scifi',
    title: 'Sci-Fi Outpost',
    subtitle: 'Quartz + cyan-glass clean-room style',
    blueprint: {
      meta: { dimensions: { x: 12, y: 9, z: 12 } },
      palette: { '1': 'quartz', '2': 'cyan_glass', '3': 'obsidian' },
      structure: [
        { y: 0, blocks: [{ x: 5, z: 5, id: '3' }, { x: 6, z: 5, id: '3' }, { x: 5, z: 6, id: '3' }, { x: 6, z: 6, id: '3' }] },
        { y: 1, blocks: [{ x: 5, z: 5, id: '1' }, { x: 6, z: 5, id: '1' }, { x: 5, z: 6, id: '1' }, { x: 6, z: 6, id: '1' }] },
        { y: 2, blocks: [{ x: 5, z: 5, id: '2' }, { x: 6, z: 5, id: '2' }, { x: 5, z: 6, id: '2' }, { x: 6, z: 6, id: '2' }] },
      ],
    },
  },
  {
    key: 'empty',
    title: 'Empty Plot',
    subtitle: 'Paste your own generated JSON blueprint',
    blueprint: {
      meta: { dimensions: { x: 10, y: 10, z: 10 } },
      palette: { '1': 'cobblestone', '2': 'planks_oak' },
      structure: [{ y: 0, blocks: [] }],
    },
  },
];

const MC_TEXTURE_BASE = 'https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/pc/1.20.4/assets/minecraft/textures/block';

const MATERIAL_LIBRARY = {
  cobblestone: { color: '#8b939b', texture: `${MC_TEXTURE_BASE}/cobblestone.png`, icon: '🪨' },
  planks_oak: { color: '#b88757', texture: `${MC_TEXTURE_BASE}/oak_planks.png`, icon: '🪵' },
  glass: { color: '#bdefff', texture: `${MC_TEXTURE_BASE}/glass.png`, transparent: true, opacity: 0.6, icon: '🧊' },
  quartz: { color: '#ececeb', texture: `${MC_TEXTURE_BASE}/quartz_block_top.png`, icon: '⬜' },
  cyan_glass: { color: '#95eeff', texture: `${MC_TEXTURE_BASE}/cyan_stained_glass.png`, transparent: true, opacity: 0.62, icon: '🔷' },
  obsidian: { color: '#33224f', texture: `${MC_TEXTURE_BASE}/obsidian.png`, icon: '🟪' },
  default: { color: '#a3a3a3', icon: '◻️' },
};

function validateBlueprint(raw) {
  const errors = [];
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return { ok: false, errors: [`Invalid JSON: ${error.message}`] };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, errors: ['Blueprint root must be a JSON object.'] };
  }

  const x = toPositiveInt(parsed?.meta?.dimensions?.x, 'meta.dimensions.x', errors);
  const y = toPositiveInt(parsed?.meta?.dimensions?.y, 'meta.dimensions.y', errors);
  const z = toPositiveInt(parsed?.meta?.dimensions?.z, 'meta.dimensions.z', errors);

  const palette = normalizePalette(parsed.palette, errors);
  const structure = normalizeStructure(parsed.structure, errors);

  if (errors.length) return { ok: false, errors };

  return {
    ok: true,
    blueprint: {
      meta: { dimensions: { x, y, z } },
      palette,
      structure,
    },
  };
}

function toPositiveInt(value, path, errors) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) {
    errors.push(`Invalid ${path}: expected positive integer, got "${value}".`);
    return null;
  }
  return number;
}

function toInt(value, path, errors) {
  const number = Number(value);
  if (!Number.isInteger(number)) {
    errors.push(`Invalid ${path}: expected integer, got "${value}".`);
    return null;
  }
  return number;
}

function normalizePalette(palette, errors) {
  if (!palette || typeof palette !== 'object' || Array.isArray(palette)) {
    errors.push('Missing/invalid required field: palette must be an object mapping IDs to material names.');
    return null;
  }

  const out = {};
  for (const [key, value] of Object.entries(palette)) {
    if (typeof value !== 'string' || !value.trim()) {
      errors.push(`Invalid palette[${key}]: material name must be a non-empty string.`);
      continue;
    }
    out[String(key)] = value.trim();
  }

  if (!Object.keys(out).length) {
    errors.push('Invalid palette: at least one valid entry is required.');
  }

  return out;
}

function normalizeStructure(structure, errors) {
  if (!Array.isArray(structure)) {
    errors.push('Missing/invalid required field: structure must be an array of { y, blocks }.');
    return null;
  }

  return structure
    .map((layer, layerIndex) => {
      if (!layer || typeof layer !== 'object' || Array.isArray(layer)) {
        errors.push(`Invalid structure[${layerIndex}]: expected object with { y, blocks }.`);
        return null;
      }
      const y = toInt(layer.y, `structure[${layerIndex}].y`, errors);
      if (!Array.isArray(layer.blocks)) {
        errors.push(`Invalid structure[${layerIndex}].blocks: expected array.`);
        return null;
      }

      const blocks = layer.blocks
        .map((block, blockIndex) => {
          if (!block || typeof block !== 'object' || Array.isArray(block)) {
            errors.push(`Invalid structure[${layerIndex}].blocks[${blockIndex}]: expected object with { x, z, id }.`);
            return null;
          }
          const x = toInt(block.x, `structure[${layerIndex}].blocks[${blockIndex}].x`, errors);
          const z = toInt(block.z, `structure[${layerIndex}].blocks[${blockIndex}].z`, errors);
          const id = block.id === undefined || block.id === null ? null : String(block.id);
          if (!id) {
            errors.push(`Invalid structure[${layerIndex}].blocks[${blockIndex}].id: expected non-empty id.`);
            return null;
          }
          if (x === null || z === null) return null;
          return { x, z, id };
        })
        .filter(Boolean);

      if (y === null) return null;
      return { y, blocks };
    })
    .filter(Boolean);
}

function useTextureMap(blueprint) {
  const [textures, setTextures] = useState({});

  useEffect(() => {
    const loader = new TextureLoader();
    const urls = [...new Set(Object.values(blueprint.palette).map((name) => MATERIAL_LIBRARY[name]?.texture).filter(Boolean))];
    let cancelled = false;
    const next = {};

    if (!urls.length) {
      setTextures({});
      return () => {};
    }

    let pending = urls.length;
    urls.forEach((url) => {
      loader.load(
        url,
        (tex) => {
          if (cancelled) return;
          tex.colorSpace = SRGBColorSpace;
          tex.needsUpdate = true;
          next[url] = tex;
          pending -= 1;
          if (pending === 0) setTextures(next);
        },
        undefined,
        () => {
          pending -= 1;
          if (pending === 0 && !cancelled) setTextures(next);
        },
      );
    });

    return () => {
      cancelled = true;
    };
  }, [blueprint]);

  return textures;
}

function BlueprintBlocks({ blueprint, selectedLayer }) {
  const textures = useTextureMap(blueprint);
  const xOffset = blueprint.meta.dimensions.x / 2 - 0.5;
  const zOffset = blueprint.meta.dimensions.z / 2 - 0.5;

  return blueprint.structure.map((layer) => {
    if (layer.y > selectedLayer) return null;
    return layer.blocks.map((block, index) => {
      const materialName = blueprint.palette[block.id] ?? 'default';
      const material = MATERIAL_LIBRARY[materialName] ?? MATERIAL_LIBRARY.default;
      const texture = material.texture ? textures[material.texture] : null;

      return (
        <mesh key={`${layer.y}-${index}-${block.x}-${block.z}-${block.id}`} position={[block.x - xOffset, layer.y + 0.5, block.z - zOffset]} castShadow receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial
            map={texture ?? null}
            color={material.color}
            roughness={material.roughness ?? 0.85}
            metalness={material.metalness ?? 0.08}
            transparent={material.transparent ?? false}
            opacity={material.opacity ?? 1}
          />
        </mesh>
      );
    });
  });
}

function MaterialPanel({ blueprint, selectedLayer }) {
  const rows = useMemo(() => {
    const count = new Map();
    blueprint.structure.forEach((layer) => {
      if (layer.y !== selectedLayer) return;
      layer.blocks.forEach((block) => {
        const material = blueprint.palette[block.id] ?? 'default';
        count.set(material, (count.get(material) ?? 0) + 1);
      });
    });
    return [...count.entries()].sort((a, b) => b[1] - a[1]);
  }, [blueprint, selectedLayer]);

  return (
    <aside style={{ ...styles.glass, ...styles.materialPanel }}>
      <h3 style={styles.panelTitle}>Current Layer Materials</h3>
      <p style={{ margin: '0 0 8px', opacity: 0.75, fontWeight: 700 }}>Layer {selectedLayer}</p>
      {rows.length === 0 ? <p style={{ margin: 0, fontWeight: 600 }}>No blocks on this layer.</p> : rows.map(([name, count]) => (
        <div key={name} style={styles.materialRow}>
          <span style={styles.icon}>{(MATERIAL_LIBRARY[name] ?? MATERIAL_LIBRARY.default).icon}</span>
          <span style={{ fontWeight: 700 }}>{name}</span>
          <strong style={{ marginLeft: 'auto' }}>{count}</strong>
        </div>
      ))}
    </aside>
  );
}

function JsonModal({ open, initial, errors, onCancel, onApply }) {
  const [text, setText] = useState(initial);

  useEffect(() => {
    if (open) setText(initial);
  }, [initial, open]);

  if (!open) return null;

  return (
    <div style={styles.modalBackdrop}>
      <div style={{ ...styles.glass, ...styles.modalCard }}>
        <h2 style={{ margin: 0 }}>Architect&apos;s Desk</h2>
        <p style={{ margin: '6px 0 0', fontWeight: 600, opacity: 0.78 }}>Paste blueprint JSON and apply to the viewer.</p>
        <textarea style={styles.textarea} value={text} onChange={(event) => setText(event.target.value)} />
        {errors.length > 0 && <ul style={styles.errors}>{errors.map((err) => <li key={err}>{err}</li>)}</ul>}
        <div style={styles.modalActions}>
          <button style={styles.ghostBtn} onClick={onCancel}>Cancel</button>
          <button style={styles.primaryBtn} onClick={() => onApply(text)}>Parse & Apply</button>
        </div>
      </div>
    </div>
  );
}

function MainMenu({ onSelect }) {
  return (
    <div style={styles.root}>
      <div style={{ ...styles.glass, ...styles.menuCard }}>
        <h1 style={styles.title}>Voxel Architect</h1>
        <p style={styles.subtitle}>Minecraft Blueprint Viewer • Mobile-game style UI</p>
        <div style={styles.carousel}>
          {THEMES.map((theme) => (
            <button key={theme.key} style={{ ...styles.glass, ...styles.themeCard }} onClick={() => onSelect(theme.blueprint)}>
              <h3 style={{ margin: 0 }}>{theme.title}</h3>
              <p style={{ margin: '8px 0 0', opacity: 0.75, fontWeight: 600 }}>{theme.subtitle}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [blueprint, setBlueprint] = useState(DEFAULT_BLUEPRINT);
  const [selectedLayer, setSelectedLayer] = useState(DEFAULT_BLUEPRINT.meta.dimensions.y - 1);
  const [modalOpen, setModalOpen] = useState(false);
  const [errors, setErrors] = useState([]);

  const maxLayer = Math.max(0, blueprint.meta.dimensions.y - 1);
  const serialized = useMemo(() => JSON.stringify(blueprint, null, 2), [blueprint]);

  const applyBlueprint = (raw) => {
    const result = validateBlueprint(raw);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setBlueprint(result.blueprint);
    setSelectedLayer(Math.max(0, result.blueprint.meta.dimensions.y - 1));
    setErrors([]);
    setModalOpen(false);
    setViewerOpen(true);
  };

  if (!viewerOpen) {
    return <MainMenu onSelect={(bp) => { setBlueprint(bp); setSelectedLayer(Math.max(0, bp.meta.dimensions.y - 1)); setViewerOpen(true); }} />;
  }

  return (
    <div style={styles.root}>
      <header style={{ ...styles.glass, ...styles.viewerHeader }}>
        <strong>Voxel Architect</strong>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button style={styles.ghostBtn} onClick={() => setViewerOpen(false)}>Themes</button>
          <button style={styles.primaryBtn} onClick={() => setModalOpen(true)}>New Blueprint</button>
        </div>
      </header>

      <MaterialPanel blueprint={blueprint} selectedLayer={selectedLayer} />

      <div style={styles.sliderDock}>
        <div style={{ ...styles.glass, ...styles.sliderCard }}>
          <label style={{ fontWeight: 800 }}>Layer: {selectedLayer}</label>
          <input type="range" min={0} max={maxLayer} value={selectedLayer} onChange={(e) => setSelectedLayer(Number(e.target.value))} style={{ width: 260 }} />
        </div>
      </div>

      <Canvas shadows camera={{ position: [11, 9, 11], fov: 46 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 18, 12]} intensity={1.25} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} />
        <Suspense fallback={null}>
          <Stage intensity={0.32} adjustCamera={false} environment={null}>
            <BlueprintBlocks blueprint={blueprint} selectedLayer={selectedLayer} />
          </Stage>
        </Suspense>
        <Environment preset="city" />
        <Grid infiniteGrid cellSize={1} sectionSize={5} fadeDistance={60} cellColor="#9faecc" sectionColor="#7f92b6" />
        <ContactShadows position={[0, -0.02, 0]} opacity={0.32} blur={2.8} scale={44} />
        <OrbitControls makeDefault />
        <GizmoHelper alignment="bottom-left" margin={[85, 85]}>
          <GizmoViewport axisColors={['#ef4444', '#16a34a', '#2563eb']} labelColor="black" />
        </GizmoHelper>
      </Canvas>

      <JsonModal
        open={modalOpen}
        initial={serialized}
        errors={errors}
        onCancel={() => {
          setErrors([]);
          setModalOpen(false);
        }}
        onApply={applyBlueprint}
      />
    </div>
  );
}

const styles = {
  root: {
    position: 'relative',
    width: '100vw',
    height: '100vh',
    overflow: 'hidden',
    fontFamily: 'Inter, Segoe UI, system-ui, sans-serif',
    background: 'radial-gradient(circle at 20% 10%, #f5f7fa 0%, #c3cfe2 100%)',
  },
  glass: {
    background: 'rgba(255, 255, 255, 0.85)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    borderRadius: 20,
    boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
  },
  menuCard: {
    width: 'min(1040px, 94vw)',
    margin: '6vh auto',
    padding: 24,
  },
  title: { margin: 0, fontSize: 40, fontWeight: 900 },
  subtitle: { margin: '6px 0 16px', fontWeight: 700, opacity: 0.72 },
  carousel: { display: 'grid', gridAutoFlow: 'column', gridAutoColumns: 'minmax(260px,1fr)', gap: 12, overflowX: 'auto', paddingBottom: 6 },
  themeCard: { border: 'none', textAlign: 'left', padding: 18, minHeight: 130, cursor: 'pointer' },
  viewerHeader: { position: 'absolute', top: 14, left: 14, right: 14, zIndex: 12, display: 'flex', alignItems: 'center', padding: '10px 14px', fontWeight: 800 },
  materialPanel: { position: 'absolute', top: 78, right: 14, zIndex: 12, width: 280, padding: 14 },
  panelTitle: { margin: '0 0 4px', fontSize: 16, fontWeight: 900 },
  materialRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 },
  icon: { width: 22, display: 'inline-flex', justifyContent: 'center' },
  sliderDock: { position: 'absolute', left: 0, right: 0, bottom: 14, display: 'flex', justifyContent: 'center', zIndex: 12 },
  sliderCard: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px' },
  ghostBtn: { border: 'none', borderRadius: 12, padding: '9px 12px', fontWeight: 700, cursor: 'pointer', background: 'rgba(255,255,255,0.95)' },
  primaryBtn: { border: 'none', borderRadius: 12, padding: '9px 12px', fontWeight: 800, cursor: 'pointer', color: '#fff', background: '#2563eb' },
  modalBackdrop: { position: 'absolute', inset: 0, zIndex: 20, background: 'rgba(13,18,30,0.45)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalCard: { width: 'min(780px, 96vw)', padding: 16 },
  textarea: { width: '100%', minHeight: 260, resize: 'vertical', borderRadius: 14, border: '1px solid rgba(0,0,0,0.16)', marginTop: 8, padding: 10, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 },
  errors: { margin: '10px 0 0', color: '#b91c1c', fontWeight: 700, maxHeight: 130, overflow: 'auto' },
};

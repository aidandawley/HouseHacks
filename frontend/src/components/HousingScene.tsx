/**
 * Conceptual 3D site view. Schematic massing only — NOT to scale, not a site plan.
 *
 * Every number shown comes from the backend scenario or the project's documented
 * facts. The only arithmetic here is layout geometry and turning backend dollar
 * figures into display proportions for the "Funding" view.
 */
import { Edges, Html, Line, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { type ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { fmtUsd0 } from "../format";
import type { ScenarioResult } from "../types";

// ------------------------------------------------------------------ dimensions (schematic "meters")
const UNIT_W = 7;
const UNIT_D = 10;
const WALL_H = 6;
const ROOF_H = 3.2;
const BUILDING_GAP = 4.5;
const ROW_GAP = 9;
const PER_ROW = 3;
const FRONT_SETBACK = 7;
const STALL_W = 2.7;
const STALL_D = 5.5;
const AISLE = 6.5;
const DRIVE_W = 6;

const COLORS = {
  siding: "#f6f3ec",
  trim: "#d8d2c4",
  roof: "#3a4048",
  door: "#2f4b46",
  glass: "#8fb3c9",
  frame: "#ffffff",
  whatIfSiding: "#d3e2f4",
  whatIfRoof: "#5f7fa6",
  ghost: "#94a3b8",
  proceeds: "#4f9d69",
  funding: "#3d7cc9",
  gap: "#d64545",
  grass: "#cfe2bd",
  lot: "#bcd7a5",
  concrete: "#e3e0d8",
  asphalt: "#4a4f57",
  lotLine: "#e07b00",
};

export type UnitStatus = "built" | "whatif" | "removed";
export type SceneMode = "homes" | "funding";

interface Props {
  homes: number;
  documentedHomes: number | null;
  parkingSpaces: number | null;
  streetName: string | null;
  siteLabel: string;
  scenario: ScenarioResult | null;
  priceCeiling: number | null;
  stale: boolean;
}

// ------------------------------------------------------------------ layout

interface UnitSlot {
  index: number;
  x: number;
  z: number;
  status: UnitStatus;
  doorRight: boolean; // mirror within a duplex
  exposedLeft: boolean;
  exposedRight: boolean;
}

interface Layout {
  units: UnitSlot[];
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  driveX: number;
  parking: { x0: number; z: number; stalls: number } | null;
  frontZ: number;
}

function computeLayout(homes: number, documented: number | null, parkingSpaces: number | null): Layout {
  const slots = Math.max(homes, documented ?? 0);
  const buildings: number[] = []; // units per building
  for (let left = slots; left > 0; left -= 2) buildings.push(Math.min(2, left));
  const rows = Math.max(1, Math.ceil(buildings.length / PER_ROW));

  const units: UnitSlot[] = [];
  let maxRowWidth = 0;
  for (let r = 0; r < rows; r++) {
    const rowBuildings = buildings.slice(r * PER_ROW, (r + 1) * PER_ROW);
    const width = rowBuildings.reduce((a, u) => a + u * UNIT_W, 0) + (rowBuildings.length - 1) * BUILDING_GAP;
    maxRowWidth = Math.max(maxRowWidth, width);
    let x = -width / 2;
    const z = -r * (UNIT_D + ROW_GAP);
    rowBuildings.forEach((count) => {
      for (let k = 0; k < count; k++) {
        const index = units.length;
        const status: UnitStatus =
          index >= homes ? "removed" : documented !== null && index >= documented ? "whatif" : "built";
        units.push({
          index,
          x: x + UNIT_W / 2 + k * UNIT_W,
          z,
          status,
          doorRight: k === 1,
          exposedLeft: k === 0,
          exposedRight: k === count - 1,
        });
      }
      x += count * UNIT_W + BUILDING_GAP;
    });
  }

  const frontZ = UNIT_D / 2 + FRONT_SETBACK;
  const lastRowBack = -(rows - 1) * (UNIT_D + ROW_GAP) - UNIT_D / 2;
  const stalls = parkingSpaces ?? 0;
  const parkingWidth = stalls * STALL_W;
  const coreWidth = Math.max(maxRowWidth, parkingWidth);
  const minX = -coreWidth / 2 - 4;
  const driveX = coreWidth / 2 + 2 + DRIVE_W / 2;
  const maxX = driveX + DRIVE_W / 2 + 2;
  const parkingZ = lastRowBack - 4 - AISLE - STALL_D / 2;
  const minZ = stalls > 0 ? parkingZ - STALL_D / 2 - 3 : lastRowBack - 6;
  return {
    units,
    minX,
    maxX,
    minZ,
    maxZ: frontZ,
    driveX,
    parking: stalls > 0 ? { x0: -parkingWidth / 2, z: parkingZ, stalls } : null,
    frontZ,
  };
}

// ------------------------------------------------------------------ pieces

function useRoofGeometry() {
  return useMemo(() => {
    const overhang = 0.4;
    const shape = new THREE.Shape();
    shape.moveTo(-UNIT_W / 2 - overhang, 0);
    shape.lineTo(UNIT_W / 2 + overhang, 0);
    shape.lineTo(0, ROOF_H);
    shape.closePath();
    const depth = UNIT_D + overhang * 2;
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
    geo.translate(0, 0, -depth / 2);
    return geo;
  }, []);
}

function Window({ position, rotationY = 0 }: { position: [number, number, number]; rotationY?: number }) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh castShadow>
        <boxGeometry args={[1.3, 1.6, 0.12]} />
        <meshStandardMaterial color={COLORS.frame} />
      </mesh>
      <mesh position={[0, 0, 0.04]}>
        <boxGeometry args={[1.05, 1.35, 0.1]} />
        <meshStandardMaterial color={COLORS.glass} roughness={0.15} metalness={0.25} />
      </mesh>
      <mesh position={[0, 0, 0.1]}>
        <boxGeometry args={[0.08, 1.35, 0.02]} />
        <meshStandardMaterial color={COLORS.frame} />
      </mesh>
    </group>
  );
}

interface Bands {
  proceeds: number;
  funding: number;
  gap: number;
}

function Walls({ status, mode, bands }: { status: UnitStatus; mode: SceneMode; bands: Bands | null }) {
  if (status === "removed") {
    return (
      <mesh position={[0, WALL_H / 2, 0]}>
        <boxGeometry args={[UNIT_W, WALL_H, UNIT_D]} />
        <meshStandardMaterial color={COLORS.ghost} transparent opacity={0.12} depthWrite={false} />
        <Edges color={COLORS.ghost} />
      </mesh>
    );
  }
  if (mode === "funding" && bands) {
    const parts: [number, string][] = [
      [bands.proceeds, COLORS.proceeds],
      [bands.funding, COLORS.funding],
      [bands.gap, COLORS.gap],
    ];
    let y = 0;
    return (
      <>
        {parts.map(([frac, color], i) => {
          const h = Math.max(frac * WALL_H, 0);
          if (h < 0.01) return null;
          const mesh = (
            <mesh key={i} position={[0, y + h / 2, 0]} castShadow receiveShadow>
              <boxGeometry args={[UNIT_W - 0.02, h, UNIT_D - 0.02]} />
              <meshStandardMaterial color={color} transparent={i === 2} opacity={i === 2 ? 0.85 : 1} />
            </mesh>
          );
          y += h;
          return mesh;
        })}
      </>
    );
  }
  const whatIf = status === "whatif";
  return (
    <>
      <mesh position={[0, WALL_H / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[UNIT_W, WALL_H, UNIT_D]} />
        <meshStandardMaterial color={whatIf ? COLORS.whatIfSiding : COLORS.siding} transparent={whatIf} opacity={whatIf ? 0.9 : 1} />
        {whatIf && <Edges color={COLORS.whatIfRoof} />}
      </mesh>
      {/* floor-line trim band */}
      <mesh position={[0, WALL_H / 2, 0]}>
        <boxGeometry args={[UNIT_W + 0.08, 0.22, UNIT_D + 0.08]} />
        <meshStandardMaterial color={COLORS.trim} />
      </mesh>
    </>
  );
}

interface UnitProps {
  slot: UnitSlot;
  mode: SceneMode;
  bands: Bands | null;
  roofGeo: THREE.ExtrudeGeometry;
  hovered: boolean;
  onHover: (i: number | null) => void;
  tooltip: ReactNode;
}

function Unit({ slot, mode, bands, roofGeo, hovered, onHover, tooltip }: UnitProps) {
  const group = useRef<THREE.Group>(null);
  // Grow in on mount / when the slot becomes active.
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const target = hovered ? 1.03 : 1;
    g.scale.y += (target - g.scale.y) * 0.16;
    g.scale.x = g.scale.z = 1 + (g.scale.y - 1) * 0.3;
  });
  useLayoutEffect(() => {
    if (group.current) group.current.scale.set(1, 0.01, 1);
  }, []);

  const ghost = slot.status === "removed";
  const whatIf = slot.status === "whatif";
  const doorX = slot.doorRight ? 1.7 : -1.7;
  const front = UNIT_D / 2;
  const showDetails = !ghost;

  return (
    <group
      ref={group}
      position={[slot.x, 0, slot.z]}
      onPointerOver={(e) => {
        e.stopPropagation();
        onHover(slot.index);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        onHover(null);
        document.body.style.cursor = "";
      }}
    >
      <Walls status={slot.status} mode={mode} bands={bands} />

      {/* gable roof */}
      <mesh geometry={roofGeo} position={[0, WALL_H, 0]} castShadow>
        <meshStandardMaterial
          color={ghost ? COLORS.ghost : whatIf ? COLORS.whatIfRoof : COLORS.roof}
          transparent={ghost}
          opacity={ghost ? 0.12 : 1}
          depthWrite={!ghost}
        />
        {ghost && <Edges color={COLORS.ghost} />}
      </mesh>

      {showDetails && (
        <>
          {/* door + porch */}
          <mesh position={[doorX, 1.15, front + 0.06]}>
            <boxGeometry args={[1.1, 2.3, 0.12]} />
            <meshStandardMaterial color={COLORS.door} />
          </mesh>
          <mesh position={[doorX, 0.12, front + 1.1]} receiveShadow castShadow>
            <boxGeometry args={[3, 0.24, 2.2]} />
            <meshStandardMaterial color={COLORS.concrete} />
          </mesh>
          {[-1.3, 1.3].map((dx) => (
            <mesh key={dx} position={[doorX + dx, 1.45, front + 2.05]} castShadow>
              <boxGeometry args={[0.16, 2.7, 0.16]} />
              <meshStandardMaterial color={COLORS.frame} />
            </mesh>
          ))}
          <mesh position={[doorX, 2.9, front + 1.15]} rotation={[0.18, 0, 0]} castShadow>
            <boxGeometry args={[3.3, 0.14, 2.5]} />
            <meshStandardMaterial color={whatIf ? COLORS.whatIfRoof : COLORS.roof} />
          </mesh>

          {/* front windows */}
          <Window position={[-doorX, 1.7, front + 0.05]} />
          <Window position={[-1.6, 4.4, front + 0.05]} />
          <Window position={[1.6, 4.4, front + 0.05]} />
          {/* gable vent */}
          <mesh position={[0, WALL_H + 1.1, front + 0.42]}>
            <boxGeometry args={[0.9, 0.9, 0.08]} />
            <meshStandardMaterial color={COLORS.frame} />
          </mesh>
          {/* side windows on exposed walls only (party wall between duplex units) */}
          {slot.exposedLeft &&
            [-2.5, 2.5].map((dz) => <Window key={`l${dz}`} position={[-UNIT_W / 2 - 0.05, 4.4, dz]} rotationY={-Math.PI / 2} />)}
          {slot.exposedRight &&
            [-2.5, 2.5].map((dz) => <Window key={`r${dz}`} position={[UNIT_W / 2 + 0.05, 4.4, dz]} rotationY={Math.PI / 2} />)}
          {/* front walk to the sidewalk (front row only) */}
          {slot.z === 0 && <mesh position={[doorX, 0.03, front + 2.2 + FRONT_SETBACK / 2]} receiveShadow>
            <boxGeometry args={[1.3, 0.06, FRONT_SETBACK]} />
            <meshStandardMaterial color={COLORS.concrete} />
          </mesh>}
          {/* shrubs */}
          {[-1, 1].map((s) => (
            <mesh key={s} position={[-doorX + s * 1.1, 0.5, front + 0.9]} castShadow>
              <icosahedronGeometry args={[0.6, 0]} />
              <meshStandardMaterial color="#5f8f4e" flatShading />
            </mesh>
          ))}
        </>
      )}

      {hovered && (
        <Html position={[0, WALL_H + ROOF_H + 1.2, 0]} center zIndexRange={[30, 0]}>
          <div className="scene-tip">{tooltip}</div>
        </Html>
      )}
    </group>
  );
}

function Tree({ position, scale = 1, tint = 0 }: { position: [number, number, number]; scale?: number; tint?: number }) {
  const greens = ["#6a9a55", "#5b8c4a", "#7aa860"];
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 1, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.3, 2, 6]} />
        <meshStandardMaterial color="#7a5a3a" />
      </mesh>
      <mesh position={[0, 3, 0]} castShadow>
        <icosahedronGeometry args={[1.7, 0]} />
        <meshStandardMaterial color={greens[tint % greens.length]} flatShading />
      </mesh>
    </group>
  );
}

function Car({ position, color }: { position: [number, number, number]; color: string }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.55, 0]} castShadow>
        <boxGeometry args={[1.8, 0.8, 4.2]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 1.2, -0.2]} castShadow>
        <boxGeometry args={[1.6, 0.6, 2.2]} />
        <meshStandardMaterial color="#cfd8e3" roughness={0.2} metalness={0.3} />
      </mesh>
    </group>
  );
}

function Parking({ x0, z, stalls, driveX }: { x0: number; z: number; stalls: number; driveX: number }) {
  const width = stalls * STALL_W;
  const padLeft = x0 - 1;
  const padRight = driveX; // pad runs into the driveway so the aisle connects
  const carColors = ["#c0392b", "#2c3e50", "#ecf0f1", "#7f8c8d", "#2980b9"];
  return (
    <group>
      <mesh position={[(padLeft + padRight) / 2, 0.025, z + AISLE / 2 - 0.3]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[padRight - padLeft, STALL_D + AISLE + 1]} />
        <meshStandardMaterial color={COLORS.asphalt} />
      </mesh>
      {Array.from({ length: stalls + 1 }, (_, i) => (
        <mesh key={i} position={[x0 + i * STALL_W, 0.04, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.12, STALL_D]} />
          <meshStandardMaterial color="#f5f5f5" />
        </mesh>
      ))}
      {[1, 4, 6, 10, 13]
        .filter((i) => i < stalls)
        .map((i, k) => (
          <Car key={i} position={[x0 + (i + 0.5) * STALL_W, 0, z]} color={carColors[k % carColors.length]} />
        ))}
    </group>
  );
}

function CameraFit({ width, depth, cx, cz, version }: { width: number; depth: number; cx: number; cz: number; version: string }) {
  const { camera, size, controls } = useThree();
  useEffect(() => {
    const span = width + depth;
    camera.zoom = Math.min(size.width / (span * 0.78), size.height / (span * 0.6));
    camera.position.set(cx + 55, 50, cz + 70);
    camera.lookAt(cx, 0, cz);
    camera.updateProjectionMatrix();
    const c = controls as unknown as { target?: THREE.Vector3; update?: () => void } | null;
    if (c?.target) {
      c.target.set(cx, 0, cz);
      c.update?.();
    }
    // Re-fit when the layout or viewport changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, size.width, size.height, controls]);
  return null;
}

// ------------------------------------------------------------------ scene

export default function HousingScene({ homes, documentedHomes, parkingSpaces, streetName, siteLabel, scenario, priceCeiling, stale }: Props) {
  const [mode, setMode] = useState<SceneMode>("homes");
  const [hovered, setHovered] = useState<number | null>(null);
  const layout = useMemo(() => computeLayout(homes, documentedHomes, parkingSpaces), [homes, documentedHomes, parkingSpaces]);
  const roofGeo = useRoofGeometry();

  // Display proportions of backend figures (no new financial totals are computed).
  const bands: Bands | null = useMemo(() => {
    if (!scenario || scenario.total_development_cost <= 0) return null;
    const total = Math.max(scenario.total_development_cost, scenario.sale_proceeds + scenario.counted_project_support);
    return {
      proceeds: scenario.sale_proceeds / total,
      funding: scenario.counted_project_support / total,
      gap: scenario.remaining_gap / total,
    };
  }, [scenario]);

  const { minX, maxX, minZ, maxZ } = layout;
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ + 15) / 2;
  const lotCorners: [number, number, number][] = [
    [minX, 0.08, minZ],
    [maxX, 0.08, minZ],
    [maxX, 0.08, maxZ],
    [minX, 0.08, maxZ],
    [minX, 0.08, minZ],
  ];
  const sidewalkZ = maxZ + 1.5;
  const streetZ = maxZ + 5 + 5; // 3 sidewalk + 2 grass parkway, then 10 of street
  const whatIf = layout.units.filter((u) => u.status === "whatif");
  const removed = layout.units.filter((u) => u.status === "removed");
  const centerOf = (us: UnitSlot[]): [number, number, number] => [
    us.reduce((a, u) => a + u.x, 0) / us.length,
    WALL_H + ROOF_H + 2.2,
    us.reduce((a, u) => a + u.z, 0) / us.length,
  ];

  const trees: { p: [number, number, number]; s: number }[] = useMemo(() => {
    const t: { p: [number, number, number]; s: number }[] = [];
    for (let x = minX - 3; x <= maxX + 3; x += 9) t.push({ p: [x, 0, minZ - 3], s: 1.1 });
    for (let z = minZ + 4; z <= maxZ - 4; z += 9) {
      t.push({ p: [minX - 3, 0, z], s: 1 });
      t.push({ p: [maxX + 3, 0, z], s: 0.9 });
    }
    for (let x = minX + 2; x <= maxX; x += 12) t.push({ p: [x, 0, maxZ + 4], s: 0.75 }); // parkway street trees
    return t;
  }, [minX, maxX, minZ, maxZ]);

  const tooltipFor = (u: UnitSlot) => (
    <>
      <strong>Home {u.index + 1}</strong>{" "}
      {u.status === "built" ? (documentedHomes !== null ? "· documented" : "") : u.status === "whatif" ? "· what-if (unapproved)" : "· not in this scenario"}
      {u.status !== "removed" && scenario && (
        <>
          <br />
          Price ceiling {priceCeiling !== null ? fmtUsd0(priceCeiling) : "—"}
          <br />
          Gap / home {fmtUsd0(scenario.gap_per_home)}
        </>
      )}
    </>
  );

  return (
    <div className={`scene-wrap${stale ? " stale" : ""}`}>
      <Canvas shadows orthographic camera={{ zoom: 8, position: [60, 50, 70], near: -500, far: 1000 }} dpr={[1, 2]}>
        <hemisphereLight args={["#eaf3ff", "#b7c9a8", 0.9]} />
        <directionalLight
          position={[cx + 40, 60, cz + 30]}
          intensity={1.6}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-90}
          shadow-camera-right={90}
          shadow-camera-top={90}
          shadow-camera-bottom={-90}
          shadow-bias={-0.0004}
        />

        {/* ground */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, -0.02, cz]} receiveShadow>
          <planeGeometry args={[400, 400]} />
          <meshStandardMaterial color={COLORS.grass} />
        </mesh>
        {/* parcel (schematic) */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(minX + maxX) / 2, 0, (minZ + maxZ) / 2]} receiveShadow>
          <planeGeometry args={[maxX - minX, maxZ - minZ]} />
          <meshStandardMaterial color={COLORS.lot} />
        </mesh>
        <Line points={lotCorners} color={COLORS.lotLine} lineWidth={2} dashed dashSize={1.2} gapSize={0.8} />
        <Html position={[minX + 0.5, 0.2, minZ + 0.5]} zIndexRange={[20, 0]}>
          <div className="scene-label lot">{siteLabel}</div>
        </Html>

        {/* driveway to rear parking */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[layout.driveX, 0.03, (minZ + maxZ) / 2 + 1]} receiveShadow>
          <planeGeometry args={[DRIVE_W, maxZ - minZ + 2]} />
          <meshStandardMaterial color={COLORS.concrete} />
        </mesh>

        {/* sidewalk + street */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.02, sidewalkZ]} receiveShadow>
          <planeGeometry args={[400, 3]} />
          <meshStandardMaterial color={COLORS.concrete} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.01, streetZ]} receiveShadow>
          <planeGeometry args={[400, 10]} />
          <meshStandardMaterial color={COLORS.asphalt} />
        </mesh>
        {Array.from({ length: 40 }, (_, i) => (
          <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[cx - 200 + i * 10, 0.03, streetZ]}>
            <planeGeometry args={[4, 0.25]} />
            <meshStandardMaterial color="#f2c94c" />
          </mesh>
        ))}
        <Html position={[minX - 2, 0.2, streetZ]} zIndexRange={[20, 0]}>
          <div className="scene-label street">{streetName ?? "Street (schematic)"}</div>
        </Html>

        {layout.parking && (
          <>
            <Parking {...layout.parking} driveX={layout.driveX} />
            <Html position={[layout.parking.x0, 0.2, layout.parking.z + STALL_D / 2 + 0.5]} zIndexRange={[20, 0]}>
              <div className="scene-label">{layout.parking.stalls} on-site spaces · documented count, placement schematic</div>
            </Html>
          </>
        )}

        {trees.map((t, i) => (
          <Tree key={i} position={t.p} scale={t.s} tint={i} />
        ))}

        {layout.units.map((u) => (
          <Unit
            key={`${u.index}-${u.status}`}
            slot={u}
            mode={mode}
            bands={bands}
            roofGeo={roofGeo}
            hovered={hovered === u.index}
            onHover={setHovered}
            tooltip={tooltipFor(u)}
          />
        ))}

        {whatIf.length > 0 && (
          <Html position={centerOf(whatIf)} center zIndexRange={[25, 0]}>
            <div className="scene-label whatif">What-if: unapproved, not zoning-validated</div>
          </Html>
        )}
        {removed.length > 0 && (
          <Html position={centerOf(removed)} center zIndexRange={[25, 0]}>
            <div className="scene-label ghost">Documented homes not in this scenario</div>
          </Html>
        )}

        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          minPolarAngle={0.35}
          maxPolarAngle={1.25}
          minZoom={3}
          maxZoom={40}
        />
        <CameraFit
          width={maxX - minX}
          depth={maxZ - minZ + 15}
          cx={cx}
          cz={cz}
          version={`${layout.units.length}-${minX}-${minZ}`}
        />
      </Canvas>

      {/* DOM overlays */}
      <div className="scene-badge">Conceptual 3D visualization — not to scale · not a site plan</div>
      <div className="scene-toggle">
        <button className={mode === "homes" ? "on" : ""} onClick={() => setMode("homes")}>
          Homes
        </button>
        <button className={mode === "funding" ? "on" : ""} disabled={!bands} onClick={() => setMode("funding")}>
          Funding
        </button>
      </div>
      <div className="scene-legend">
        {mode === "homes" ? (
          <>
            <span><i style={{ background: COLORS.siding, border: "1px solid #bbb" }} /> {documentedHomes !== null ? "Documented home" : "Modeled home"}</span>
            {documentedHomes !== null && <span><i style={{ background: COLORS.whatIfSiding, border: `1px solid ${COLORS.whatIfRoof}` }} /> What-if (unapproved)</span>}
            {documentedHomes !== null && <span><i style={{ background: "transparent", border: `1px dashed ${COLORS.ghost}` }} /> Not in scenario</span>}
          </>
        ) : (
          <>
            <span><i style={{ background: COLORS.proceeds }} /> Sale proceeds</span>
            <span><i style={{ background: COLORS.funding }} /> Counted funding</span>
            <span><i style={{ background: COLORS.gap }} /> Remaining gap</span>
            <span className="muted">share of each home's modeled cost</span>
          </>
        )}
        <span className="muted hint-right">drag to orbit · scroll to zoom · hover a home</span>
      </div>
    </div>
  );
}

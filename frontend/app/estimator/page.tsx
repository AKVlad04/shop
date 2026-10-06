"use client";

import { useEffect, useRef, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { DarkRoseNoirBackground } from "@/components/DarkRoseNoirBackground";
import { Footer } from "@/components/Footer";
import { FeaturedProducts } from "@/components/FeaturedProducts";
import { CategoriesGrid } from "@/components/CategoriesGrid";
import {
  Box,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  Info,
  LayoutGrid,
  LockKeyhole,
  Move,
  RotateCw,
  RefreshCw,
  ShoppingCart,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";

type ColorOption = { name: string; hex: string; available: boolean };
type ModelItem = {
  file: File;
  originalName: string;
  mesh: THREE.Mesh;
  baseSurfaceAreaMm2: number;
  baseVolumeCm3: number;
  serverStoredFileName: string;
  originalSizeMm: THREE.Vector3;
  scalePct: number;
  quantity: number;
  homePosition: THREE.Vector3;
  homeQuaternion: THREE.Quaternion;
};
type Quote = {
  grams: number;
  volumeCm3: number;
  filamentVolumeCm3: number;
  printTimeMin: number;
  materialCost: number;
  wearCost: number;
  laborCost: number;
  margin: number;
  totalRounded: number;
};
type ApiResponse = {
  success?: boolean;
  error?: string;
  msg?: string;
  serverFileName?: string;
  volume_cm3?: number;
  checkoutUrl?: string;
};

const BED_MM = 200;
const PLA_DENSITY_G_PER_CM3 = 1.24;
const SHELL_THICKNESS_MM = 0.9;
const FILAMENT_PRICE_LEI_PER_KG = 82;
const WEAR_PRICE_LEI_PER_HOUR = 2;
const FIXED_LABOR_LEI = 10;
const PRICE_MARGIN = 0.9;
const FILAMENT_FLOW_MM3_PER_SECOND = 6;
const PRINT_TIME_OVERHEAD = 1.25;
const MIN_PRINT_MAX_DIM_MM = 20;
const MAX_SCALE_PCT = 2000;
const COLORS: ColorOption[] = [
  { name: "Alb", hex: "#ffffff", available: true },
  { name: "Negru", hex: "#111111", available: true },
  { name: "Roșu", hex: "#e53935", available: true },
  { name: "Baby Blue", hex: "#8fd3ff", available: true },
  { name: "Verde", hex: "#2ecc71", available: false },
  { name: "Galben", hex: "#ffd166", available: false },
];
const MATERIAL_OPTIONS = [
  { name: "PLA", available: true },
  { name: "PETG", available: false },
  { name: "ABS", available: false },
  { name: "TPU", available: false },
  { name: "ASA", available: false },
  { name: "Nylon", available: false },
];
const INFILL_OPTIONS = [
  { value: 20, name: "Standard", description: "Cel mai folosit echilibru optim între economie, timp redus și rezistență excelentă pentru piesele de zi cu zi." },
  { value: 40, name: "Rigid", description: "Oferă o rigiditate structurală superioară, ideală pentru piese funcționale și solicitări mecanice moderate." },
  { value: 80, name: "Robust", description: "Nivel crescut de umplere pentru componente industriale și piese expuse la presiuni intense." },
  { value: 100, name: "Solid", description: "Densitate maximă, recomandat pentru piese grele, cu rezistență extremă la impact și solicitări severe." },
];
const VIEW_DIRECTIONS: Record<string, THREE.Vector3> = {
  Sus: new THREE.Vector3(0, 1, 0),
  Jos: new THREE.Vector3(0, -1, 0),
  Față: new THREE.Vector3(0, 0, 1),
  Spate: new THREE.Vector3(0, 0, -1),
  Stânga: new THREE.Vector3(-1, 0, 0),
  Dreapta: new THREE.Vector3(1, 0, 0),
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function geometrySurfaceArea(geometry: THREE.BufferGeometry) {
  const source = geometry.index ? geometry.toNonIndexed() : geometry;
  const positions = source.getAttribute("position");
  if (!positions) return 0;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  let area = 0;
  for (let i = 0; i + 2 < positions.count; i += 3) {
    a.fromBufferAttribute(positions, i);
    b.fromBufferAttribute(positions, i + 1);
    c.fromBufferAttribute(positions, i + 2);
    ab.subVectors(b, a);
    ac.subVectors(c, a);
    area += ab.cross(ac).length() / 2;
  }
  if (source !== geometry) source.dispose();
  return area;
}

function ensureOutwardWinding(geometry: THREE.BufferGeometry) {
  const source = geometry.index ? geometry.toNonIndexed() : geometry;
  const position = source.getAttribute("position");
  if (!position || position.count < 3) {
    if (source !== geometry) source.dispose();
    return;
  }
  let signedVolumeTimesSix = 0;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const cross = new THREE.Vector3();
  for (let i = 0; i + 2 < position.count; i += 3) {
    a.fromBufferAttribute(position, i);
    b.fromBufferAttribute(position, i + 1);
    c.fromBufferAttribute(position, i + 2);
    signedVolumeTimesSix += a.dot(cross.crossVectors(b, c));
  }
  if (Math.abs(signedVolumeTimesSix) < 1e-6) {
    if (source !== geometry) source.dispose();
    return;
  }
  if (signedVolumeTimesSix < 0) {
    const values = position.array;
    for (let i = 0; i + 8 < values.length; i += 9) {
      for (let axis = 0; axis < 3; axis += 1) {
        const second = i + 3 + axis;
        const third = i + 6 + axis;
        [values[second], values[third]] = [values[third], values[second]];
      }
    }
    position.needsUpdate = true;
  }
  source.computeVertexNormals();
  if (source !== geometry) {
    geometry.copy(source);
    source.dispose();
  }
}

function geometryWorldBounds(mesh: THREE.Mesh, exact = false) {
  const geometry = mesh.geometry as THREE.BufferGeometry;
  const position = geometry.getAttribute("position");
  if (!position) return new THREE.Box3();
  mesh.updateMatrixWorld(true);
  const box = new THREE.Box3().makeEmpty();
  const step = exact ? 1 : Math.max(1, Math.floor(position.count / 2500));
  const point = new THREE.Vector3();
  for (let i = 0; i < position.count; i += step) {
    point.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
    box.expandByPoint(point);
  }
  if (step > 1 && position.count > 0) {
    point.fromBufferAttribute(position, position.count - 1).applyMatrix4(mesh.matrixWorld);
    box.expandByPoint(point);
  }
  return box;
}

function geometryBoundsAtTransform(
  mesh: THREE.Mesh,
  position: THREE.Vector3,
  quaternion: THREE.Quaternion,
  scale = mesh.scale.x,
) {
  const geometry = mesh.geometry as THREE.BufferGeometry;
  geometry.computeBoundingBox();
  const bounds = new THREE.Box3().makeEmpty();
  if (!geometry.boundingBox) return bounds;
  const matrix = new THREE.Matrix4().compose(position, quaternion, new THREE.Vector3(scale, scale, scale));
  const point = new THREE.Vector3();
  for (const x of [geometry.boundingBox.min.x, geometry.boundingBox.max.x]) {
    for (const y of [geometry.boundingBox.min.y, geometry.boundingBox.max.y]) {
      for (const z of [geometry.boundingBox.min.z, geometry.boundingBox.max.z]) {
        point.set(x, y, z).applyMatrix4(matrix);
        bounds.expandByPoint(point);
      }
    }
  }
  return bounds;
}

function getMaxBedScalePct(mesh: THREE.Mesh, otherMeshes: THREE.Mesh[] = []) {
  const unitBounds = geometryBoundsAtTransform(
    mesh,
    mesh.position,
    mesh.quaternion,
    1,
  );
  if (unitBounds.isEmpty()) return 100;

  const offsetMinX = unitBounds.min.x - mesh.position.x;
  const offsetMaxX = unitBounds.max.x - mesh.position.x;
  const offsetMinY = unitBounds.min.y - mesh.position.y;
  const offsetMaxY = unitBounds.max.y - mesh.position.y;
  const offsetMinZ = unitBounds.min.z - mesh.position.z;
  const offsetMaxZ = unitBounds.max.z - mesh.position.z;
  let maxScale = BED_MM / Math.max(0.001, offsetMaxY - offsetMinY);
  if (offsetMaxX > 0) maxScale = Math.min(maxScale, (BED_MM / 2 - mesh.position.x) / offsetMaxX);
  if (offsetMinX < 0) maxScale = Math.min(maxScale, (-BED_MM / 2 - mesh.position.x) / offsetMinX);
  if (offsetMaxZ > 0) maxScale = Math.min(maxScale, (BED_MM / 2 - mesh.position.z) / offsetMaxZ);
  if (offsetMinZ < 0) maxScale = Math.min(maxScale, (-BED_MM / 2 - mesh.position.z) / offsetMinZ);

  for (const otherMesh of otherMeshes) {
    if (otherMesh === mesh) continue;
    const otherBounds = geometryBoundsAtTransform(
      otherMesh,
      otherMesh.position,
      otherMesh.quaternion,
      otherMesh.scale.x,
    );
    const limits = [
      offsetMaxX > 0 ? (otherBounds.min.x - mesh.position.x) / offsetMaxX : -1,
      offsetMinX < 0 ? (otherBounds.max.x - mesh.position.x) / offsetMinX : -1,
      offsetMaxZ > 0 ? (otherBounds.min.z - mesh.position.z) / offsetMaxZ : -1,
      offsetMinZ < 0 ? (otherBounds.max.z - mesh.position.z) / offsetMinZ : -1,
    ].filter((limit) => Number.isFinite(limit) && limit >= 0);
    if (!limits.length) return 1;
    maxScale = Math.min(maxScale, Math.max(...limits));
  }
  return clamp(Math.floor(maxScale * 100), 1, MAX_SCALE_PCT);
}

function isWithinBedBounds(mesh: THREE.Mesh) {
  const bounds = geometryBoundsAtTransform(mesh, mesh.position, mesh.quaternion, mesh.scale.x);
  return !(
    bounds.min.x < -BED_MM / 2 - 1e-6 ||
    bounds.max.x > BED_MM / 2 + 1e-6 ||
    bounds.min.z < -BED_MM / 2 - 1e-6 ||
    bounds.max.z > BED_MM / 2 + 1e-6 ||
    bounds.min.y < -1e-6 ||
    bounds.max.y > BED_MM + 1e-6
  );
}

function hasBedClearance(mesh: THREE.Mesh, otherMeshes: THREE.Mesh[]) {
  if (!isWithinBedBounds(mesh)) return false;
  const bounds = geometryBoundsAtTransform(mesh, mesh.position, mesh.quaternion, mesh.scale.x);
  return otherMeshes.every((otherMesh) => {
    if (otherMesh === mesh) return true;
    const other = geometryBoundsAtTransform(
      otherMesh,
      otherMesh.position,
      otherMesh.quaternion,
      otherMesh.scale.x,
    );
    const tolerance = 1e-6;
    return bounds.max.x <= other.min.x + tolerance ||
      other.max.x <= bounds.min.x + tolerance ||
      bounds.max.z <= other.min.z + tolerance ||
      other.max.z <= bounds.min.z + tolerance;
  });
}

function geometryWorldMinY(mesh: THREE.Mesh) {
  const position = (mesh.geometry as THREE.BufferGeometry).getAttribute("position");
  if (!position) return 0;
  mesh.updateMatrixWorld(true);
  let minY = Infinity;
  const matrix = mesh.matrixWorld.elements;
  for (let i = 0; i < position.count; i += 1) {
    const y =
      matrix[1] * position.getX(i) +
      matrix[5] * position.getY(i) +
      matrix[9] * position.getZ(i) +
      matrix[13];
    if (y < minY) minY = y;
  }
  return Number.isFinite(minY) ? minY : 0;
}

function restOnBed(mesh: THREE.Mesh) {
  mesh.updateMatrixWorld(true);
  const minY = geometryWorldMinY(mesh);
  if (Number.isFinite(minY)) mesh.position.y -= minY;
  mesh.updateMatrixWorld(true);
}

function clampToBedFootprint(mesh: THREE.Mesh) {
  const box = geometryWorldBounds(mesh);
  let dx = 0;
  let dz = 0;
  if (box.min.x < -BED_MM / 2) dx = -BED_MM / 2 - box.min.x;
  if (box.max.x > BED_MM / 2) dx = BED_MM / 2 - box.max.x;
  if (box.min.z < -BED_MM / 2) dz = -BED_MM / 2 - box.min.z;
  if (box.max.z > BED_MM / 2) dz = BED_MM / 2 - box.max.z;
  mesh.position.x += dx;
  mesh.position.z += dz;
  mesh.updateMatrixWorld(true);
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => material.dispose());
  });
}

function getCubeRotations() {
  const axes = [
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(-1, 0, 0),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, -1, 0),
    new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(0, 0, -1),
  ];
  const rotations: THREE.Quaternion[] = [];
  for (const yAxis of axes) {
    for (const xCandidate of axes) {
      if (Math.abs(yAxis.dot(xCandidate)) > 0.1) continue;
      const zAxis = new THREE.Vector3().crossVectors(xCandidate, yAxis).normalize();
      const matrix = new THREE.Matrix4().makeBasis(xCandidate, yAxis, zAxis);
      const quaternion = new THREE.Quaternion().setFromRotationMatrix(matrix);
      if (!rotations.some((existing) => 1 - Math.abs(existing.dot(quaternion)) < 1e-6)) {
        rotations.push(quaternion);
      }
    }
  }
  return rotations;
}

function estimateFilamentVolume(modelVolumeCm3: number, surfaceAreaMm2: number, infillPct: number) {
  if (!Number.isFinite(modelVolumeCm3) || modelVolumeCm3 <= 0) return 0;
  const volumeMm3 = modelVolumeCm3 * 1000;
  const shellMm3 = Math.min(volumeMm3, Math.max(0, surfaceAreaMm2) * SHELL_THICKNESS_MM);
  return (shellMm3 + Math.max(0, volumeMm3 - shellMm3) * clamp(infillPct, 0, 100) / 100) / 1000;
}

function calculateQuote(models: ModelItem[], infillPct: number): Quote {
  let volumeCm3 = 0;
  let filamentVolumeCm3 = 0;
  for (const model of models) {
    if (model.baseVolumeCm3 <= 0) continue;
    const scale = model.scalePct / 100;
    const volume = model.baseVolumeCm3 * scale ** 3;
    const surface = model.baseSurfaceAreaMm2 * scale ** 2;
    volumeCm3 += volume * model.quantity;
    filamentVolumeCm3 += estimateFilamentVolume(volume, surface, infillPct) * model.quantity;
  }
  const grams = filamentVolumeCm3 * PLA_DENSITY_G_PER_CM3;
  const flowCm3PerMinute = FILAMENT_FLOW_MM3_PER_SECOND * 60 / 1000;
  const printTimeMin = filamentVolumeCm3 > 0
    ? clamp(filamentVolumeCm3 / flowCm3PerMinute * PRINT_TIME_OVERHEAD, 10, 24 * 60)
    : 0;
  const materialCost = grams * FILAMENT_PRICE_LEI_PER_KG / 1000;
  const wearCost = Math.round(printTimeMin) / 60 * WEAR_PRICE_LEI_PER_HOUR;
  const base = materialCost + wearCost + FIXED_LABOR_LEI;
  const margin = PRICE_MARGIN * base;
  return {
    grams,
    volumeCm3,
    filamentVolumeCm3,
    printTimeMin: Math.round(printTimeMin),
    materialCost,
    wearCost,
    laborCost: FIXED_LABOR_LEI,
    margin,
    totalRounded: Math.ceil(base + margin),
  };
}

function formatScale(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export default function EstimatorPage() {
  const [step, setStep] = useState(1);
  const [models, setModels] = useState<ModelItem[]>([]);
  const [activeModelIndex, setActiveModelIndex] = useState(0);
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [selectedInfill, setSelectedInfill] = useState(20);
  const [orientationPreference, setOrientationPreference] = useState<"estimator" | "slicer">("estimator");
  const [orderNotes, setOrderNotes] = useState("");
  const [scaleInput, setScaleInput] = useState("100");
  const [transformMode, setTransformMode] = useState<"translate" | "rotate">("translate");
  const [supportsEnabled, setSupportsEnabled] = useState(false);
  const [supportsAngleDeg, setSupportsAngleDeg] = useState(35);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [wizardVisible, setWizardVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [viewerRevision, setViewerRevision] = useState(0);
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const submissionInFlightRef = useRef(false);
  const lastSafeTransformRef = useRef<{
    mesh: THREE.Mesh;
    position: THREE.Vector3;
    quaternion: THREE.Quaternion;
  } | null>(null);

  const mountRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const orbitRef = useRef<OrbitControls | null>(null);
  const transformRef = useRef<TransformControls | null>(null);
  const supportOverlayRef = useRef<THREE.Mesh | null>(null);
  const modelsRef = useRef(models);
  const modeRef = useRef(transformMode);
  const dragRef = useRef<{ mesh: THREE.Mesh; offset: THREE.Vector3; startPosition: THREE.Vector3 } | null>(null);
  const dragPlaneRef = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const pickRaycasterRef = useRef(new THREE.Raycaster());
  const pickNdcRef = useRef(new THREE.Vector2());
  const dragPointRef = useRef(new THREE.Vector3());

  const activeModel = models[activeModelIndex] ?? null;
  const scalePct = activeModel?.scalePct ?? 100;
  const sizeBox = activeModel ? geometryWorldBounds(activeModel.mesh) : null;
  const currentSize = sizeBox?.getSize(new THREE.Vector3()) ?? null;
  const dimensionsText = currentSize
    ? `${(currentSize.x / 10).toFixed(1)} × ${(currentSize.y / 10).toFixed(1)} × ${(currentSize.z / 10).toFixed(1)} cm`
    : "—";
  const fitsBed = models.every((model) => {
    return isWithinBedBounds(model.mesh);
  });
  const quote = calculateQuote(models, selectedInfill);
  const activeOriginalSize = activeModel && scalePct > 0 && currentSize
    ? currentSize.clone().multiplyScalar(100 / scalePct)
    : null;
  const bedFitScalePct = activeModel
    ? getMaxBedScalePct(activeModel.mesh, [])
    : 100;
  const preferredMinScalePct = activeOriginalSize
    ? clamp(Math.ceil(MIN_PRINT_MAX_DIM_MM / Math.max(activeOriginalSize.x, activeOriginalSize.y, activeOriginalSize.z) * 100), 1, MAX_SCALE_PCT)
    : 1;
  const minScalePct = Math.min(preferredMinScalePct, bedFitScalePct);
  const maxScalePct = bedFitScalePct;

  const refreshViewer = () => setViewerRevision((revision) => revision + 1);

  const clearSupportOverlay = () => {
    const overlay = supportOverlayRef.current;
    if (!overlay) return;
    overlay.parent?.remove(overlay);
    overlay.geometry.dispose();
    const materials = Array.isArray(overlay.material) ? overlay.material : [overlay.material];
    materials.forEach((material) => material.dispose());
    supportOverlayRef.current = null;
  };

  const updateSupportOverlay = (mesh: THREE.Mesh | null, threshold: number) => {
    clearSupportOverlay();
    if (!mesh || !supportsEnabled) return;
    const geometry = mesh.geometry as THREE.BufferGeometry;
    const positions = geometry.getAttribute("position");
    if (!positions) return;
    mesh.updateMatrixWorld(true);
    const worldBox = geometryWorldBounds(mesh);
    const bedEpsilon = Math.max(0.15, (worldBox.max.y - worldBox.min.y) * 0.0005);
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    const wa = new THREE.Vector3();
    const wb = new THREE.Vector3();
    const wc = new THREE.Vector3();
    const normal = new THREE.Vector3();
    const edgeA = new THREE.Vector3();
    const edgeB = new THREE.Vector3();
    const vertices: number[] = [];
    const limit = 90 - clamp(threshold, 0, 89.9);
    for (let i = 0; i + 2 < positions.count; i += 3) {
      a.fromBufferAttribute(positions, i);
      b.fromBufferAttribute(positions, i + 1);
      c.fromBufferAttribute(positions, i + 2);
      wa.copy(a).applyMatrix4(mesh.matrixWorld);
      wb.copy(b).applyMatrix4(mesh.matrixWorld);
      wc.copy(c).applyMatrix4(mesh.matrixWorld);
      if (wa.y <= worldBox.min.y + bedEpsilon && wb.y <= worldBox.min.y + bedEpsilon && wc.y <= worldBox.min.y + bedEpsilon) continue;
      edgeA.subVectors(b, a);
      edgeB.subVectors(c, a);
      normal.crossVectors(edgeA, edgeB).normalize().applyMatrix3(normalMatrix).normalize();
      const dotDown = -normal.y;
      if (dotDown <= 0 || Math.acos(clamp(dotDown, 0, 1)) * 180 / Math.PI >= limit) continue;
      vertices.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    }
    if (!vertices.length) return;
    const overlayGeometry = new THREE.BufferGeometry();
    overlayGeometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    overlayGeometry.computeVertexNormals();
    const overlay = new THREE.Mesh(
      overlayGeometry,
      new THREE.MeshBasicMaterial({
        color: 0x00e5ff,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      }),
    );
    overlay.renderOrder = 10;
    mesh.add(overlay);
    supportOverlayRef.current = overlay;
  };

  const autoArrangeModels = (items: ModelItem[]): ModelItem[] | null => {
    type PackingOption = {
      model: ModelItem;
      quaternion: THREE.Quaternion;
      boundsAtOrigin: THREE.Box3;
    };
    type PositionedModel = {
      model: ModelItem;
      quaternion: THREE.Quaternion;
      position: THREE.Vector3;
      bounds: THREE.Box3;
    };

    const sorted = items.map((model) => {
      const options = [0, Math.PI / 2].map((yaw) => {
        const quaternion = new THREE.Quaternion()
          .setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw)
          .multiply(model.mesh.quaternion);
        const boundsAtOrigin = geometryBoundsAtTransform(
          model.mesh,
          new THREE.Vector3(),
          quaternion,
          model.mesh.scale.x,
        );
        return { model, quaternion, boundsAtOrigin };
      });
      return { model, options };
    }).sort((a, b) => {
      const areaA = Math.max(...a.options.map(({ boundsAtOrigin }) =>
        (boundsAtOrigin.max.x - boundsAtOrigin.min.x) * (boundsAtOrigin.max.z - boundsAtOrigin.min.z)));
      const areaB = Math.max(...b.options.map(({ boundsAtOrigin }) =>
        (boundsAtOrigin.max.x - boundsAtOrigin.min.x) * (boundsAtOrigin.max.z - boundsAtOrigin.min.z)));
      return areaB - areaA;
    });

    const previousTransforms = items.map((model) => ({
      model,
      position: model.mesh.position.clone(),
      quaternion: model.mesh.quaternion.clone(),
      homePosition: model.homePosition.clone(),
      homeQuaternion: model.homeQuaternion.clone(),
    }));

    const placed: PositionedModel[] = [];
    const first = sorted[0];
    if (!first) return items;
    const firstOption = first.options[0];
    const firstSize = firstOption.boundsAtOrigin.getSize(new THREE.Vector3());
    const firstPosition = new THREE.Vector3(
      -(firstOption.boundsAtOrigin.min.x + firstOption.boundsAtOrigin.max.x) / 2,
      first.model.mesh.position.y,
      -(firstOption.boundsAtOrigin.min.z + firstOption.boundsAtOrigin.max.z) / 2,
    );
    const firstBounds = geometryBoundsAtTransform(
      first.model.mesh,
      firstPosition,
      firstOption.quaternion,
      first.model.mesh.scale.x,
    );
    if (
      firstSize.x > BED_MM ||
      firstSize.z > BED_MM ||
      firstBounds.min.y < -1e-6 ||
      firstBounds.max.y > BED_MM + 1e-6
    ) return null;
    placed.push({
      model: first.model,
      quaternion: firstOption.quaternion,
      position: firstPosition,
      bounds: firstBounds,
    });

    for (const entry of sorted.slice(1)) {
      let best: {
        option: PackingOption;
        position: THREE.Vector3;
        bounds: THREE.Box3;
        scoreArea: number;
        scorePerimeter: number;
        scoreCenterDistance: number;
      } | null = null;

      for (const option of entry.options) {
        const width = option.boundsAtOrigin.max.x - option.boundsAtOrigin.min.x;
        const depth = option.boundsAtOrigin.max.z - option.boundsAtOrigin.min.z;
        const xCandidates = new Set<number>();
        const zCandidates = new Set<number>();
        for (const existing of placed) {
          const existingCenterX = (existing.bounds.min.x + existing.bounds.max.x) / 2;
          const existingCenterZ = (existing.bounds.min.z + existing.bounds.max.z) / 2;
          xCandidates.add(existing.bounds.min.x - width);
          xCandidates.add(existing.bounds.max.x);
          xCandidates.add(existingCenterX - width / 2);
          xCandidates.add(existing.bounds.min.x);
          xCandidates.add(existing.bounds.max.x - width);
          zCandidates.add(existing.bounds.min.z - depth);
          zCandidates.add(existing.bounds.max.z);
          zCandidates.add(existingCenterZ - depth / 2);
          zCandidates.add(existing.bounds.min.z);
          zCandidates.add(existing.bounds.max.z - depth);
        }

        for (const minX of xCandidates) {
          for (const minZ of zCandidates) {
            const position = new THREE.Vector3(
              minX - option.boundsAtOrigin.min.x,
              entry.model.mesh.position.y,
              minZ - option.boundsAtOrigin.min.z,
            );
            const bounds = geometryBoundsAtTransform(
              entry.model.mesh,
              position,
              option.quaternion,
              entry.model.mesh.scale.x,
            );
            if (
              bounds.min.x < -BED_MM / 2 - 1e-6 ||
              bounds.max.x > BED_MM / 2 + 1e-6 ||
              bounds.min.z < -BED_MM / 2 - 1e-6 ||
              bounds.max.z > BED_MM / 2 + 1e-6 ||
              bounds.min.y < -1e-6 ||
              bounds.max.y > BED_MM + 1e-6
            ) continue;
            const collides = placed.some((existing) =>
              bounds.min.x < existing.bounds.max.x - 1e-6 &&
              bounds.max.x > existing.bounds.min.x + 1e-6 &&
              bounds.min.z < existing.bounds.max.z - 1e-6 &&
              bounds.max.z > existing.bounds.min.z + 1e-6,
            );
            if (collides) continue;

            const minGroupX = Math.min(bounds.min.x, ...placed.map((item) => item.bounds.min.x));
            const maxGroupX = Math.max(bounds.max.x, ...placed.map((item) => item.bounds.max.x));
            const minGroupZ = Math.min(bounds.min.z, ...placed.map((item) => item.bounds.min.z));
            const maxGroupZ = Math.max(bounds.max.z, ...placed.map((item) => item.bounds.max.z));
            const groupWidth = maxGroupX - minGroupX;
            const groupDepth = maxGroupZ - minGroupZ;
            const scoreArea = groupWidth * groupDepth;
            const scorePerimeter = groupWidth + groupDepth;
            const scoreCenterDistance = Math.hypot((minGroupX + maxGroupX) / 2, (minGroupZ + maxGroupZ) / 2);
            if (
              !best ||
              scoreArea < best.scoreArea ||
              (scoreArea === best.scoreArea && scorePerimeter < best.scorePerimeter) ||
              (scoreArea === best.scoreArea && scorePerimeter === best.scorePerimeter && scoreCenterDistance < best.scoreCenterDistance)
            ) {
              best = { option, position, bounds, scoreArea, scorePerimeter, scoreCenterDistance };
            }
          }
        }
      }
      if (!best) {
        previousTransforms.forEach(({ model, position, quaternion, homePosition, homeQuaternion }) => {
          model.mesh.position.copy(position);
          model.mesh.quaternion.copy(quaternion);
          model.homePosition.copy(homePosition);
          model.homeQuaternion.copy(homeQuaternion);
        });
        return null;
      }
      placed.push({
        model: entry.model,
        quaternion: best.option.quaternion,
        position: best.position,
        bounds: best.bounds,
      });
    }

    for (const placement of placed) {
      placement.model.mesh.position.copy(placement.position);
      placement.model.mesh.quaternion.copy(placement.quaternion);
      restOnBed(placement.model.mesh);
    }
    const groupBounds = new THREE.Box3().makeEmpty();
    items.forEach(({ mesh }) => groupBounds.union(geometryWorldBounds(mesh, true)));
    const groupCenter = groupBounds.getCenter(new THREE.Vector3());
    for (const model of items) {
      model.mesh.position.x -= groupCenter.x;
      model.mesh.position.z -= groupCenter.z;
      restOnBed(model.mesh);
      model.homePosition = model.mesh.position.clone();
      model.homeQuaternion = model.mesh.quaternion.clone();
    }
    if (items.some((model) => !hasBedClearance(model.mesh, items.map((item) => item.mesh)))) {
      previousTransforms.forEach(({ model, position, quaternion, homePosition, homeQuaternion }) => {
        model.mesh.position.copy(position);
        model.mesh.quaternion.copy(quaternion);
        model.homePosition.copy(homePosition);
        model.homeQuaternion.copy(homeQuaternion);
      });
      return null;
    }
    return items;
  };

  const selectModel = (index: number) => {
    const list = modelsRef.current;
    if (!list.length) return;
    const nextIndex = clamp(index, 0, list.length - 1);
    setActiveModelIndex(nextIndex);
    setScaleInput(String(list[nextIndex].scalePct));
    const transform = transformRef.current;
    if (transform) {
      if (modeRef.current === "rotate") {
        transform.attach(list[nextIndex].mesh);
        lastSafeTransformRef.current = {
          mesh: list[nextIndex].mesh,
          position: list[nextIndex].mesh.position.clone(),
          quaternion: list[nextIndex].mesh.quaternion.clone(),
        };
      }
      else transform.detach();
    }
    clearSupportOverlay();
    refreshViewer();
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 10000);
    camera.position.set(180, 150, 180);
    cameraRef.current = camera;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.position = "absolute";
    renderer.domElement.style.inset = "0";
    renderer.domElement.style.zIndex = "1";
    renderer.domElement.style.touchAction = "none";
    container.prepend(renderer.domElement);
    rendererRef.current = renderer;

    scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    const keyLight = new THREE.DirectionalLight(0xffffff, 0.9);
    keyLight.position.set(50, 70, 80);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
    fillLight.position.set(-60, 30, -50);
    scene.add(fillLight);
    scene.add(new THREE.GridHelper(BED_MM, 20, 0x7c5cff, 0x38313a));
    const outlinePoints = [
      new THREE.Vector3(-100, 0.02, -100),
      new THREE.Vector3(100, 0.02, -100),
      new THREE.Vector3(100, 0.02, 100),
      new THREE.Vector3(-100, 0.02, 100),
    ];
    const outline = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(outlinePoints),
      new THREE.LineBasicMaterial({ color: 0xfb7185 }),
    );
    scene.add(outline);

    const orbit = new OrbitControls(camera, renderer.domElement);
    orbit.enableDamping = true;
    orbit.dampingFactor = 0.08;
    orbit.enabled = modelsRef.current.length > 0;
    orbitRef.current = orbit;
    const transform = new TransformControls(camera, renderer.domElement);
    transform.setSpace("local");
    transform.setMode("rotate");
    transform.rotationSnap = THREE.MathUtils.degToRad(45);
    transform.getHelper().visible = false;
    scene.add(transform.getHelper());
    transformRef.current = transform;
    transform.addEventListener("dragging-changed", (event) => {
      orbit.enabled = !event.value && modelsRef.current.length > 0;
      if (event.value && transform.object instanceof THREE.Mesh) {
        lastSafeTransformRef.current = {
          mesh: transform.object,
          position: transform.object.position.clone(),
          quaternion: transform.object.quaternion.clone(),
        };
      } else if (!event.value && transform.object instanceof THREE.Mesh) {
        const mesh = transform.object;
        restOnBed(mesh);
        clampToBedFootprint(mesh);
        const start = lastSafeTransformRef.current;
        if (!isWithinBedBounds(mesh) && start?.mesh === mesh) {
          mesh.position.copy(start.position);
          mesh.quaternion.copy(start.quaternion);
          mesh.updateMatrixWorld(true);
        }
        setErrorMessage("");
        refreshViewer();
      }
    });
    transform.addEventListener("objectChange", () => {
      if (!(transform.object instanceof THREE.Mesh)) return;
      const mesh = transform.object;
      restOnBed(mesh);
      clampToBedFootprint(mesh);
    });

    const raycaster = pickRaycasterRef.current;
    const ndc = pickNdcRef.current;
    const plane = dragPlaneRef.current;
    const point = dragPointRef.current;
    const onPointerDown = (event: PointerEvent) => {
      if (modeRef.current !== "translate" || !modelsRef.current.length) return;
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const meshes = modelsRef.current.map((model) => model.mesh);
      const hit = raycaster.intersectObjects(meshes, false)[0];
      if (!hit) return;
      const index = meshes.indexOf(hit.object as THREE.Mesh);
      if (index < 0) return;
      selectModel(index);
      const mesh = meshes[index];
      if (!raycaster.ray.intersectPlane(plane, point)) return;
      dragRef.current = {
        mesh,
        offset: new THREE.Vector3(mesh.position.x - point.x, 0, mesh.position.z - point.z),
        startPosition: mesh.position.clone(),
      };
      orbit.enabled = false;
      renderer.domElement.setPointerCapture(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      if (!raycaster.ray.intersectPlane(plane, point)) return;
      drag.mesh.position.x = point.x + drag.offset.x;
      drag.mesh.position.z = point.z + drag.offset.z;
      clampToBedFootprint(drag.mesh);
    };
    const onPointerUp = (event: PointerEvent) => {
      if (!dragRef.current) return;
      const { mesh, startPosition } = dragRef.current;
      restOnBed(mesh);
      if (!isWithinBedBounds(mesh)) {
        mesh.position.copy(startPosition);
        mesh.updateMatrixWorld(true);
      }
      setErrorMessage("");
      dragRef.current = null;
      orbit.enabled = modelsRef.current.length > 0;
      if (renderer.domElement.hasPointerCapture(event.pointerId)) renderer.domElement.releasePointerCapture(event.pointerId);
      refreshViewer();
    };
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("pointercancel", onPointerUp);

    let animationFrame = 0;
    const animate = () => {
      animationFrame = requestAnimationFrame(animate);
      orbit.update();
      renderer.render(scene, camera);
    };
    animate();
    const resize = () => {
      const nextWidth = Math.max(1, container.clientWidth);
      const nextHeight = Math.max(1, container.clientHeight);
      renderer.setSize(nextWidth, nextHeight);
      camera.aspect = nextWidth / nextHeight;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(animationFrame);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("pointercancel", onPointerUp);
      transform.dispose();
      orbit.dispose();
      clearSupportOverlay();
      modelsRef.current.forEach(({ mesh }) => disposeObject(mesh));
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.LineLoop) disposeObject(object);
      });
      renderer.dispose();
      renderer.domElement.remove();
      sceneRef.current = null;
      cameraRef.current = null;
      rendererRef.current = null;
      orbitRef.current = null;
      transformRef.current = null;
    };
    // The viewer owns one Three.js scene for the lifetime of this page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    modelsRef.current = models;
    if (orbitRef.current) orbitRef.current.enabled = models.length > 0;
  }, [models]);

  useEffect(() => {
    modeRef.current = transformMode;
    const transform = transformRef.current;
    if (!transform) return;
    if (transformMode === "rotate" && activeModel) {
      transform.attach(activeModel.mesh);
      transform.getHelper().visible = true;
    } else {
      transform.detach();
      transform.getHelper().visible = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transformMode, activeModelIndex, models.length]);

  useEffect(() => {
    models.forEach(({ mesh }) => {
      const material = mesh.material as THREE.MeshPhongMaterial;
      material.color.set(selectedColor.hex);
      material.needsUpdate = true;
    });
    updateSupportOverlay(activeModel?.mesh ?? null, supportsAngleDeg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [models, activeModelIndex, selectedColor, supportsEnabled, supportsAngleDeg, viewerRevision]);

  const handleFileSelection = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    setFileMenuOpen(false);
    setErrorMessage("");
    setNotice("");
    setIsCalculating(true);
    const loader = new STLLoader();
    const created: ModelItem[] = [];
    const existing = modelsRef.current;
    try {
      for (const file of files) {
        if (!file.name.toLowerCase().endsWith(".stl")) {
          throw new Error(`${file.name}: selectează numai fișiere STL.`);
        }
        const geometry = loader.parse(await file.arrayBuffer());
        const position = geometry.getAttribute("position");
        if (!position || position.count < 3) {
          geometry.dispose();
          throw new Error(`${file.name}: fișierul STL nu conține o geometrie validă.`);
        }
        ensureOutwardWinding(geometry);
        const surfaceArea = geometrySurfaceArea(geometry);
        geometry.computeBoundingBox();
        geometry.center();
        geometry.computeBoundingBox();
        geometry.computeVertexNormals();
        const material = new THREE.MeshPhongMaterial({
          color: selectedColor.hex,
          specular: 0x111111,
          shininess: 60,
          side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.x = -Math.PI / 2;
        sceneRef.current?.add(mesh);
        restOnBed(mesh);
        const box = geometryWorldBounds(mesh, true);
        created.push({
          file,
          originalName: file.name,
          mesh,
          baseSurfaceAreaMm2: surfaceArea,
          baseVolumeCm3: 0,
          serverStoredFileName: "",
          originalSizeMm: box.getSize(new THREE.Vector3()),
          scalePct: 100,
          quantity: 1,
          homePosition: mesh.position.clone(),
          homeQuaternion: mesh.quaternion.clone(),
        });
      }
      const arranged = autoArrangeModels([...existing, ...created]);
      if (!arranged) {
        throw new Error("Piesele nu încap pe pat fără să se suprapună. Încarcă mai puține piese sau piese mai mici.");
      }
      modelsRef.current = arranged;
      setModels(arranged);
      const newActiveIndex = Math.max(0, arranged.indexOf(created[0]));
      setActiveModelIndex(newActiveIndex);
      setScaleInput(String(arranged[newActiveIndex]?.scalePct ?? 100));
      setFileMenuOpen(false);
      setWizardVisible(true);
      setStep(1);
      refreshViewer();
      await calculateOffer(created);
    } catch (error) {
      created.forEach(({ mesh }) => {
        sceneRef.current?.remove(mesh);
        disposeObject(mesh);
      });
      const message = error instanceof Error ? error.message : "Nu am putut încărca fișierele STL.";
      setErrorMessage(message);
    } finally {
      setIsCalculating(false);
      event.target.value = "";
    }
  };

  const calculateOffer = async (modelsToCalculate: ModelItem[] = modelsRef.current) => {
    if (!modelsToCalculate.length) {
      setErrorMessage("Alege unul sau mai multe fișiere STL.");
      return;
    }
    if (!modelsToCalculate.every(({ mesh }) => Boolean(mesh.geometry.getAttribute("position")))) {
      setErrorMessage("Unul dintre modele nu are geometrie validă. Reîncarcă fișierele STL.");
      return;
    }
    setErrorMessage("");
    setNotice("");
    setIsCalculating(true);
    const apiBase = (process.env.NEXT_PUBLIC_ESTIMATOR_API_BASE ?? "").replace(/\/+$/, "");
    const configuredWindow = window as Window & { NEXUS3D_API_BASE?: string };
    const baseUrl = apiBase || configuredWindow.NEXUS3D_API_BASE || "http://localhost:5000";
    const updated = [...modelsToCalculate];
    try {
      for (let index = 0; index < updated.length; index += 1) {
        if (updated[index].serverStoredFileName) continue;
        const formData = new FormData();
        formData.append("file", updated[index].file);
        const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/upload`, {
          method: "POST",
          body: formData,
        });
        const raw = await response.text();
        let data: ApiResponse | null = null;
        try {
          data = raw ? JSON.parse(raw) as ApiResponse : null;
        } catch {
          throw new Error(`Răspuns invalid de la server pentru ${updated[index].originalName}.`);
        }
        if (!response.ok) {
          throw new Error(data?.error || data?.msg || `Upload eșuat (${response.status}) pentru ${updated[index].originalName}.`);
        }
        if (!data?.serverFileName || typeof data.volume_cm3 !== "number" || !Number.isFinite(data.volume_cm3) || data.volume_cm3 <= 0) {
          throw new Error(`Serverul nu a putut calcula volumul pentru ${updated[index].originalName}.`);
        }
        const previousModel = updated[index];
        updated[index] = {
          ...updated[index],
          baseVolumeCm3: data.volume_cm3,
          serverStoredFileName: data.serverFileName,
        };
        const allUpdated = modelsRef.current.map((model) => model === previousModel ? updated[index] : model);
        modelsRef.current = allUpdated;
        setModels(allUpdated);
      }
      setWizardVisible(true);
      setStep(1);
      refreshViewer();
    } catch (error) {
      const message = error instanceof Error ? error.message : "A apărut o eroare la calcularea ofertei.";
      setErrorMessage(message);
    } finally {
      setIsCalculating(false);
    }
  };

  const changeScale = (value: number) => {
    if (!activeModel) return;
    const nextScale = clamp(value, minScalePct, maxScalePct);
    setScaleInput(String(nextScale));
    const previousScale = activeModel.mesh.scale.x;
    activeModel.mesh.scale.setScalar(nextScale / 100);
    restOnBed(activeModel.mesh);
    if (!isWithinBedBounds(activeModel.mesh)) {
      activeModel.mesh.scale.setScalar(previousScale);
      restOnBed(activeModel.mesh);
      const safeScale = Math.round(previousScale * 100);
      setScaleInput(String(safeScale));
      setErrorMessage("Scalarea a fost oprită pentru a menține piesa în volumul patului de printare.");
      return;
    }
    setErrorMessage("");
    const updated = modelsRef.current.map((model, index) =>
      index === activeModelIndex ? { ...model, scalePct: nextScale } : model,
    );
    modelsRef.current = updated;
    setModels(updated);
    refreshViewer();
  };

  const resetActiveTransform = () => {
    if (!activeModel) return;
    const previousPosition = activeModel.mesh.position.clone();
    const previousQuaternion = activeModel.mesh.quaternion.clone();
    activeModel.mesh.position.copy(activeModel.homePosition);
    activeModel.mesh.quaternion.copy(activeModel.homeQuaternion);
    restOnBed(activeModel.mesh);
    clampToBedFootprint(activeModel.mesh);
    if (!isWithinBedBounds(activeModel.mesh)) {
      activeModel.mesh.position.copy(previousPosition);
      activeModel.mesh.quaternion.copy(previousQuaternion);
      activeModel.mesh.updateMatrixWorld(true);
      setErrorMessage("Resetarea ar scoate piesa din volumul patului de printare.");
      return;
    }
    setErrorMessage("");
    refreshViewer();
  };

  const resetScale = () => changeScale(clamp(100, minScalePct, maxScalePct));

  const arrangeCurrentModels = () => {
    if (models.length < 2) return;
    const arranged = autoArrangeModels(models);
    if (!arranged) {
      setErrorMessage("Nu pot aranja toate piesele pe pat fără suprapuneri. Încearcă să elimini sau să micșorezi unele piese.");
      return;
    }
    modelsRef.current = arranged;
    setModels(arranged);
    setErrorMessage("");
    refreshViewer();
  };

  const clearModels = () => {
    if (isCalculating) return;
    clearSupportOverlay();
    transformRef.current?.detach();
    modelsRef.current.forEach(({ mesh }) => {
      sceneRef.current?.remove(mesh);
      disposeObject(mesh);
    });
    modelsRef.current = [];
    setModels([]);
    setActiveModelIndex(0);
    setScaleInput("100");
    setWizardVisible(false);
    setErrorMessage("");
    setNotice("");
    setStep(1);
    setOrderNotes("");
    setOrientationPreference("estimator");
    setOrderSuccess(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    refreshViewer();
  };

  const removeModel = (index: number) => {
    const currentModels = modelsRef.current;
    const removed = currentModels[index];
    if (!removed) return;

    if (supportOverlayRef.current?.parent === removed.mesh) clearSupportOverlay();
    if (transformRef.current?.object === removed.mesh) transformRef.current.detach();
    sceneRef.current?.remove(removed.mesh);
    disposeObject(removed.mesh);

    const remaining = currentModels.filter((_, modelIndex) => modelIndex !== index);
    const nextActiveIndex = remaining.length === 0
      ? 0
      : index < activeModelIndex
        ? activeModelIndex - 1
        : index === activeModelIndex
          ? Math.min(index, remaining.length - 1)
          : activeModelIndex;

    modelsRef.current = remaining;
    setModels(remaining);
    setActiveModelIndex(nextActiveIndex);
    setScaleInput(String(remaining[nextActiveIndex]?.scalePct ?? 100));
    setErrorMessage("");
    setNotice("");
    if (!remaining.length) {
      setWizardVisible(false);
      setStep(1);
    }
    setFileMenuOpen(false);
    refreshViewer();
  };

  const changeModelQuantity = (index: number, quantity: number) => {
    const nextQuantity = clamp(Math.floor(quantity), 1, 999);
    const updated = modelsRef.current.map((model, modelIndex) =>
      modelIndex === index ? { ...model, quantity: nextQuantity } : model
    );
    modelsRef.current = updated;
    setModels(updated);
  };

  const autoOrientActive = async () => {
    if (!activeModel) return;
    const mesh = activeModel.mesh;
    const baseQuaternion = mesh.quaternion.clone();
    const basePosition = mesh.position.clone();
    const threshold = supportsAngleDeg;
    const rotations = getCubeRotations();
    let bestScore = Infinity;
    const bestQuaternion = baseQuaternion.clone();
    const bestPosition = basePosition.clone();
    const geometry = mesh.geometry as THREE.BufferGeometry;
    const positions = geometry.getAttribute("position");
    const normalMatrix = new THREE.Matrix3();
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    const edgeA = new THREE.Vector3();
    const edgeB = new THREE.Vector3();
    const normal = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    let largestFootprint = 0;
    const candidateScores: Array<{ quaternion: THREE.Quaternion; position: THREE.Vector3; footprint: number; supportArea: number; totalArea: number; contactArea: number; contactRatio: number; heightRatio: number }> = [];
    for (let index = 0; index < rotations.length; index += 1) {
      const candidate = baseQuaternion.clone().multiply(rotations[index]);
      mesh.quaternion.copy(candidate);
      mesh.position.copy(basePosition);
      restOnBed(mesh);
      clampToBedFootprint(mesh);
      if (!isWithinBedBounds(mesh)) continue;
      mesh.updateMatrixWorld(true);
      normalMatrix.getNormalMatrix(mesh.matrixWorld);
      const bounds = geometryWorldBounds(mesh);
      const dimensions = bounds.getSize(new THREE.Vector3());
      const footprint = Math.max(1, dimensions.x * dimensions.z);
      const areaScale = mesh.scale.x * mesh.scale.x;
      let supportArea = 0;
      let contactArea = 0;
      let totalArea = 0;
      const sampleStep = Math.max(1, Math.floor(positions.count / 12000));
      for (let i = 0; i + 2 < positions.count; i += 3 * sampleStep) {
        a.fromBufferAttribute(positions, i);
        b.fromBufferAttribute(positions, i + 1);
        c.fromBufferAttribute(positions, i + 2);
        const centroid = a.clone().add(b).add(c).multiplyScalar(1 / 3).applyMatrix4(mesh.matrixWorld);
        edgeA.subVectors(b, a);
        edgeB.subVectors(c, a);
        const area = edgeA.cross(edgeB).length() * 0.5 * areaScale * sampleStep;
        totalArea += area;
        if (centroid.y <= bounds.min.y + Math.max(0.2, dimensions.y * 0.001)) {
          contactArea += area;
          continue;
        }
        normal.crossVectors(edgeA, edgeB).normalize().applyMatrix3(normalMatrix).normalize();
        const downward = -normal.dot(up);
        if (downward > 0 && Math.acos(clamp(downward, 0, 1)) * 180 / Math.PI < 90 - threshold) {
          supportArea += area;
        }
      }
      const contactRatio = clamp(contactArea / footprint, 0, 1);
      largestFootprint = Math.max(largestFootprint, footprint);
      candidateScores.push({
        quaternion: candidate.clone(),
        position: mesh.position.clone(),
        footprint,
        supportArea,
        totalArea,
        contactArea,
        contactRatio,
        heightRatio: dimensions.y / Math.max(dimensions.x, dimensions.y, dimensions.z, 1),
      });
      if (index % 4 === 3) await new Promise((resolve) => window.setTimeout(resolve, 0));
    }
    const largestContactArea = Math.max(0, ...candidateScores.map((candidate) => candidate.contactArea));
    const largestBaseRatio = Math.max(0, ...candidateScores.map((candidate) => candidate.contactRatio));
    for (const candidate of candidateScores) {
      const unsupportedAreaRatio = candidate.supportArea / Math.max(1, candidate.totalArea);
      const contactScore = largestContactArea > 0 ? candidate.contactArea / largestContactArea : 0;
      const baseScore = largestBaseRatio > 0 ? candidate.contactRatio / largestBaseRatio : 0;
      const score = unsupportedAreaRatio * 20 +
        (1 - contactScore) * 2 +
        (1 - baseScore) * 0.5 +
        candidate.heightRatio * 0.25 +
        candidate.footprint / largestFootprint * 0.1 +
        (contactScore < 0.01 ? 2 : 0);
      if (score < bestScore) {
        bestScore = score;
        bestQuaternion.copy(candidate.quaternion);
        bestPosition.copy(candidate.position);
      }
    }
    mesh.quaternion.copy(bestQuaternion);
    mesh.position.copy(bestPosition);
    restOnBed(mesh);
    clampToBedFootprint(mesh);
    if (!isWithinBedBounds(mesh)) {
      mesh.quaternion.copy(baseQuaternion);
      mesh.position.copy(basePosition);
      restOnBed(mesh);
      setErrorMessage("Auto-orientarea ar scoate piesa din volumul patului de printare.");
      refreshViewer();
      return;
    }
    const updated = modelsRef.current.map((model) => model === activeModel
      ? { ...model, homePosition: mesh.position.clone(), homeQuaternion: mesh.quaternion.clone() }
      : model);
    modelsRef.current = updated;
    setModels(updated);
    setErrorMessage("");
    refreshViewer();
  };

  const setCameraView = (name: string) => {
    const camera = cameraRef.current;
    const controls = orbitRef.current;
    const direction = VIEW_DIRECTIONS[name];
    if (!camera || !controls || !direction) return;
    const box = new THREE.Box3().makeEmpty();
    models.forEach(({ mesh }) => box.union(geometryWorldBounds(mesh)));
    const center = box.isEmpty() ? new THREE.Vector3() : box.getCenter(new THREE.Vector3());
    const size = box.isEmpty() ? new THREE.Vector3(BED_MM, BED_MM, BED_MM) : box.getSize(new THREE.Vector3());
    const radius = Math.max(10, size.length() / 2);
    const distance = radius / Math.sin(camera.fov * Math.PI / 360) * 0.9;
    const offset = direction.clone().normalize().multiplyScalar(distance);
    if (name === "Sus" || name === "Jos") {
      offset.x += Math.max(1, distance * 0.02);
      offset.z += Math.max(1, distance * 0.02);
    }
    camera.up.set(0, 1, 0);
    camera.position.copy(center).add(offset);
    camera.lookAt(center);
    controls.target.copy(center);
    controls.update();
  };

  const handleSendOrder = async () => {
    if (submissionInFlightRef.current || orderSuccess) return;
    if (!models.length) {
      setErrorMessage("Alege unul sau mai multe fișiere STL înainte să trimiți comanda.");
      return;
    }
    if (models.some((model) => !model.serverStoredFileName)) {
      setErrorMessage("Calculează oferta pentru toate fișierele înainte să trimiți comanda.");
      return;
    }
    if (!fitsBed) {
      setErrorMessage("Cel puțin un model depășește patul de 20×20×20 cm. Micșorează-l înainte de comandă.");
      return;
    }
    setErrorMessage("");
    submissionInFlightRef.current = true;
    setIsSubmitting(true);
    const filesText = models.map((model) => `- ${model.originalName} × ${model.quantity} → ${model.serverStoredFileName}`).join("\n");
    const transformedText = models.map((model) => {
      const dot = model.serverStoredFileName.lastIndexOf(".");
      const base = dot >= 0 ? model.serverStoredFileName.slice(0, dot) : model.serverStoredFileName;
      const extension = dot >= 0 ? model.serverStoredFileName.slice(dot) : ".stl";
      return `- ${model.originalName} × ${model.quantity} (${formatScale(model.scalePct)}%) → ${base}_TRANSFORMED${extension}`;
    }).join("\n");
    const dimensions = currentSize
      ? `${(currentSize.x / 10).toFixed(1)} x ${(currentSize.y / 10).toFixed(1)} x ${(currentSize.z / 10).toFixed(1)} cm`
      : "—";
    const offerText = `========================================
          COMANDA NOUA
========================================
Data: ${new Date().toLocaleString("ro-RO")}
Fișiere:
${filesText}
Fișiere transformate (rotit/scalat/mutat):
${transformedText}
Ansamblu (toate piesele la pozițiile relative):
- ASAMBLU_TRANSFORMAT.stl
----------------------------------------
SPECIFICAȚII:
- Material: PLA
- Culoare: ${selectedColor.name}
- Infill: ${INFILL_OPTIONS.find((option) => option.value === selectedInfill)?.name ?? "Standard"}
- Cantități:
${models.map((model) => `- ${model.originalName}: ${model.quantity} buc.`).join("\n")}
- Orientare: ${orientationPreference === "estimator" ? "Păstrează orientarea din estimator" : "Optimizare completă în Bambu Studio la pregătirea printului"}
- Note:
${orderNotes.trim() || "—"}
- Scalare per piesă:
${models.map((model) => `- ${model.originalName}: ${formatScale(model.scalePct)}%`).join("\n")}
- Timp printare: ${quote.printTimeMin} min
- Greutate estimată: ${quote.grams.toFixed(2)} g
- Volum: ${quote.volumeCm3.toFixed(2)} cm3
- Dimensiuni model activ: ${dimensions}
----------------------------------------
CALCUL PREȚ:
- Material: ${quote.materialCost.toFixed(2)} Lei (${FILAMENT_PRICE_LEI_PER_KG} Lei/kg)
- Uzură: ${quote.wearCost.toFixed(2)} Lei (${WEAR_PRICE_LEI_PER_HOUR} Lei/oră)
- Manoperă: ${FIXED_LABOR_LEI.toFixed(2)} Lei (fix)
- Adaos 90%: ${quote.margin.toFixed(2)} Lei
----------------------------------------
VALOARE COMANDĂ: ${quote.totalRounded} LEI
========================================`;

    const apiBase = (process.env.NEXT_PUBLIC_ESTIMATOR_API_BASE ?? "").replace(/\/+$/, "");
    const configuredWindow = window as Window & { NEXUS3D_API_BASE?: string; NEXUS3D_CHECKOUT_MODE?: string };
    const baseUrl = apiBase || configuredWindow.NEXUS3D_API_BASE || "http://localhost:5000";
    const isDraft = (configuredWindow.NEXUS3D_CHECKOUT_MODE || "server").toLowerCase() === "draft";
    const endpoint = isDraft ? "/shopify/draft-order" : "/comanda";
    try {
      const response = await fetch(`${baseUrl.replace(/\/+$/, "")}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offerText,
          amountLei: quote.totalRounded,
          color: selectedColor.name,
          infill: selectedInfill,
          scalePct,
          files: models.map((model) => {
            model.mesh.updateMatrixWorld(true);
            const rotation = new THREE.Euler().setFromQuaternion(model.mesh.getWorldQuaternion(new THREE.Quaternion()), "XYZ");
            const position = model.mesh.getWorldPosition(new THREE.Vector3());
            const scale = model.mesh.getWorldScale(new THREE.Vector3());
            return {
              serverFileName: model.serverStoredFileName,
              originalName: model.originalName,
              quantity: model.quantity,
              transform: {
                matrixWorld: model.mesh.matrixWorld.toArray(),
                position: { x: position.x, y: position.y, z: position.z },
                rotationDeg: {
                  x: THREE.MathUtils.radToDeg(rotation.x),
                  y: THREE.MathUtils.radToDeg(rotation.y),
                  z: THREE.MathUtils.radToDeg(rotation.z),
                },
                scale: { x: scale.x, y: scale.y, z: scale.z },
              },
            };
          }),
        }),
      });
      const raw = await response.text();
      let result: ApiResponse | null = null;
      try {
        result = raw ? JSON.parse(raw) as ApiResponse : null;
      } catch {
        throw new Error("Răspuns invalid de la server la trimiterea comenzii.");
      }
      if (!response.ok || !result?.success) {
        throw new Error(result?.msg || result?.error || raw || `Trimiterea comenzii a eșuat (${response.status}).`);
      }
      if (isDraft && result.checkoutUrl) {
        window.location.assign(result.checkoutUrl);
        return;
      }
      setOrderSuccess(true);
      setNotice("Comanda a fost înregistrată cu succes pe server.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Nu s-a putut trimite comanda.");
    } finally {
      submissionInFlightRef.current = false;
      setIsSubmitting(false);
    }
  };

  const fileLabel = models.length === 0
    ? "Niciun fișier ales"
    : models.length === 1
      ? models[0].originalName
      : `${models.length} fișiere selectate`;

  return (
    <DarkRoseNoirBackground className="flex min-h-screen w-full flex-col justify-between overflow-x-hidden">
      <Navbar />
      <main className="relative z-10 mx-auto w-full max-w-7xl px-4 pb-12 pt-28">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-rose-400">Calculator Instant 3D</span>
            <h1 className="text-2xl font-black uppercase tracking-tight text-white sm:text-3xl">Estimator & Vizualizator STL</h1>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-rose-500/30 bg-rose-950/40 px-3 py-1.5 text-xs text-rose-200 sm:flex">
            <Sparkles size={13} className="animate-pulse text-rose-400" />
            <span>Pat printare: 20×20×20 cm</span>
          </div>
        </div>

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          <section className="flex min-w-0 flex-col gap-3 lg:col-span-6">
            <div
              ref={mountRef}
              className={`relative h-[400px] w-full overflow-hidden rounded-[24px] border bg-[#1b1418]/95 shadow-2xl backdrop-blur-2xl sm:h-[440px] ${fitsBed ? "border-white/10" : "border-red-400/60 shadow-red-950/40"}`}
            >
              {models.length === 0 && (
                <div className="pointer-events-none absolute inset-0 z-[2] flex flex-col items-center justify-center p-6 text-center">
                  <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl border border-rose-500/20 bg-rose-950/40 text-rose-400 shadow-[0_0_20px_rgba(225,29,72,0.15)]">
                    <Box size={32} strokeWidth={1.5} />
                  </div>
                  <p className="mb-1 text-sm font-bold text-white">Spațiu de randare 3D activ</p>
                  <p className="max-w-xs text-xs text-neutral-400">Încarcă unul sau mai multe fișiere STL pentru a vizualiza piesele în 3D.</p>
                </div>
              )}

              {models.length > 0 && (
                <div className="absolute left-3 top-3 z-20">
                  <button
                    type="button"
                    onClick={() => setFileMenuOpen(!fileMenuOpen)}
                    className="rounded-xl border border-white/15 bg-black/70 px-3 py-2 text-xs font-bold text-white backdrop-blur-md"
                    aria-expanded={fileMenuOpen}
                  >
                    {activeModelIndex + 1}/{models.length} piese ▾
                  </button>
                  {fileMenuOpen && (
                    <div className="mt-2 w-[min(20rem,calc(100vw-3rem))] overflow-hidden rounded-xl border border-white/15 bg-[#160d11]/95 shadow-xl backdrop-blur-xl">
                      {models.map((model, index) => (
                        <div key={`${model.originalName}-${index}`} className={`flex items-center gap-1 border-b border-white/5 ${index === activeModelIndex ? "bg-rose-950/50" : ""}`}>
                          <button
                            type="button"
                            onClick={() => { selectModel(index); setFileMenuOpen(false); }}
                            className={`min-w-0 flex-1 truncate px-3 py-2.5 text-left text-xs ${index === activeModelIndex ? "text-rose-200" : "text-neutral-200 hover:text-white"}`}
                          >
                            {model.originalName}{model.serverStoredFileName ? " · calculat" : ""}
                          </button>
                          <button
                            type="button"
                            onClick={() => removeModel(index)}
                            disabled={isCalculating}
                            className="mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-neutral-400 transition hover:bg-red-500/20 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-40"
                            aria-label={`Șterge ${model.originalName}`}
                            title={`Șterge ${model.originalName}`}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                      <button type="button" onClick={clearModels} disabled={isCalculating} className="w-full border-t border-white/10 px-3 py-2.5 text-left text-xs font-semibold text-rose-300 transition hover:bg-rose-950/50 disabled:cursor-not-allowed disabled:opacity-40">
                        Șterge toate fișierele
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="absolute right-3 top-3 z-20 grid grid-cols-3 gap-1 rounded-xl border border-white/10 bg-black/55 p-1 backdrop-blur-md">
                {Object.keys(VIEW_DIRECTIONS).map((name) => (
                  <button key={name} type="button" onClick={() => setCameraView(name)} disabled={!activeModel} className={`rounded-md px-2 py-1 text-[9px] font-semibold text-neutral-200 disabled:cursor-default disabled:opacity-40 ${activeModel ? "hover:bg-rose-500/20 hover:text-white" : ""}`} aria-label={`Vedere ${name}`}>
                    {name}
                  </button>
                ))}
              </div>

              <div className="absolute bottom-3 left-3 right-3 z-20 flex flex-wrap items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-black/60 p-1.5 backdrop-blur-md">
                <button type="button" onClick={() => setTransformMode("translate")} disabled={!activeModel} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium disabled:cursor-default disabled:opacity-40 ${activeModel ? `transition-all hover:bg-rose-500/20 hover:text-white hover:ring-1 hover:ring-rose-400/30 ${transformMode === "translate" ? "border border-rose-500/40 bg-rose-950/80 text-rose-200" : "text-neutral-300"}` : "text-neutral-300"}`} title="Mută piesa pe placa de printare">
                  <Move size={14} className="text-rose-400" /><span>Mută</span>
                </button>
                <button type="button" onClick={() => setTransformMode("rotate")} disabled={!activeModel} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium disabled:cursor-default disabled:opacity-40 ${activeModel ? `transition-all hover:bg-rose-500/20 hover:text-white hover:ring-1 hover:ring-rose-400/30 ${transformMode === "rotate" ? "border border-rose-500/40 bg-rose-950/80 text-rose-200" : "text-neutral-300"}` : "text-neutral-300"}`} title="Rotește piesa">
                  <RotateCw size={14} className="text-rose-400" /><span>Rotește</span>
                </button>
                <button type="button" onClick={resetActiveTransform} disabled={!activeModel} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium disabled:cursor-default disabled:opacity-40 ${activeModel ? "text-neutral-300 transition-all hover:bg-white/10 hover:text-white" : "text-neutral-300"}`} title="Resetează poziția și rotația">
                  <RefreshCw size={14} /><span>Reset</span>
                </button>
                <button type="button" onClick={() => setSupportsEnabled(!supportsEnabled)} disabled={!activeModel} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium disabled:cursor-default disabled:opacity-40 ${activeModel ? `transition-all ${supportsEnabled ? "bg-cyan-950/70 text-cyan-200" : "text-neutral-300 hover:bg-white/10 hover:text-white"}` : "text-neutral-300"}`} title="Arată zonele care necesită suport">
                  <Eye size={14} /><span>Suport</span>
                </button>
                <button type="button" onClick={() => setSupportsAngleDeg((angle) => angle === 30 ? 35 : angle === 35 ? 40 : angle === 40 ? 45 : 30)} disabled={!activeModel} className={`rounded-lg px-2 py-1.5 text-xs font-semibold text-neutral-300 disabled:cursor-default disabled:opacity-40 ${activeModel ? "transition-colors hover:bg-white/10" : ""}`} title="Unghi de suport">
                  {supportsAngleDeg}°
                </button>
                <button type="button" onClick={() => void autoOrientActive()} disabled={!activeModel} className={`rounded-lg px-2 py-1.5 text-xs font-semibold text-neutral-300 disabled:cursor-default disabled:opacity-40 ${activeModel ? "transition-colors hover:bg-white/10" : ""}`} title="Orientează piesa pentru suporturi minime">
                  Auto-orientare
                </button>
                {models.length > 1 && (
                  <button type="button" onClick={arrangeCurrentModels} className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-neutral-300 transition-colors hover:bg-rose-500/20 hover:text-white" title="Aranjează piesele eficient și centrează-le pe pat">
                    <LayoutGrid size={14} /> Auto-aranjează
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 rounded-[20px] border border-white/10 bg-[#120B0E]/60 p-4 backdrop-blur-xl">
              <div className="text-xs">
                <span className="text-neutral-400">Dimensiuni: </span>
                <span className="font-bold text-white">{dimensionsText}</span>
                <div className={`mt-1 text-[10px] font-semibold ${fitsBed ? "text-emerald-300" : "text-red-300"}`}>
                  {fitsBed ? "Încape pe patul de printare" : `Depășește patul · scalare maximă recomandată ${bedFitScalePct}%`}
                </div>
              </div>
              <div className="flex min-w-[220px] flex-1 items-center gap-3 sm:max-w-xs">
                <span className="text-xs font-semibold text-neutral-300">Scalare:</span>
                <input type="range" min={minScalePct} max={maxScalePct} step="1" value={scalePct} disabled={!activeModel} onChange={(event) => changeScale(Number(event.target.value))} className="h-1.5 w-full cursor-pointer accent-rose-500 disabled:cursor-default" aria-label="Scalare model" />
                <label className="flex items-center gap-1 rounded-lg border border-white/10 bg-black/30 px-2 py-1">
                  <input
                    type="number"
                    min={minScalePct}
                    max={maxScalePct}
                    step="1"
                    value={scaleInput}
                    disabled={!activeModel}
                    onChange={(event) => setScaleInput(event.target.value)}
                    onBlur={() => {
                      const parsed = Number(scaleInput);
                      if (scaleInput.trim() && Number.isFinite(parsed)) changeScale(parsed);
                      else setScaleInput(String(scalePct));
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") event.currentTarget.blur();
                    }}
                    className="w-12 appearance-none bg-transparent text-right text-xs font-bold text-rose-400 outline-none disabled:cursor-default"
                    aria-label="Procent de scalare"
                  />
                  <span className="text-xs font-bold text-rose-400">%</span>
                </label>
                <button type="button" onClick={resetScale} disabled={!activeModel} className="rounded-lg p-1 text-neutral-400 disabled:cursor-default disabled:opacity-40 enabled:hover:bg-white/10 enabled:hover:text-white" title="Resetare scalare la 100%">
                  <RefreshCw size={14} />
                </button>
              </div>
            </div>
          </section>

          <aside className="flex flex-col lg:col-span-6">
            <div className="flex flex-col gap-4 rounded-[24px] border border-white/10 bg-[#120B0E]/70 p-5 text-sm shadow-2xl backdrop-blur-2xl sm:p-6">
              <div className="grid grid-cols-3 gap-1.5 border-b border-white/10 pb-4 text-xs sm:gap-2 sm:text-sm">
                {["Setări", "Produse", "Sumar"].map((label, index) => (
                  <div key={label} className={`rounded-lg px-2 py-2 text-center font-bold transition-all ${step === index + 1 ? "border border-rose-500/40 bg-rose-950/60 text-rose-200" : "bg-white/5 text-neutral-400"}`}>
                    {index + 1}. {label}
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-black/20 p-3.5">
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-white/20 bg-white/[0.02] p-4 transition-all hover:border-rose-500/50 hover:bg-rose-950/10">
                  <span className="rounded-xl border border-rose-500/20 bg-rose-950/50 p-3 text-rose-400"><Upload size={20} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="mb-0.5 block truncate text-sm font-semibold text-white">{fileLabel}</span>
                    <span className="block text-xs text-neutral-400">{models.length ? "Adaugă și alte fișiere STL · procesare automată" : "Fișierele se procesează automat după selectare"}</span>
                  </span>
                  <input ref={fileInputRef} type="file" className="hidden" accept=".stl,model/stl" multiple disabled={isCalculating} onChange={handleFileSelection} />
                </label>
                {models.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    {wizardVisible && step > 1 && (
                      <button type="button" onClick={() => setStep((currentStep) => currentStep - 1)} disabled={isCalculating} className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-neutral-200 transition hover:border-white/20 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50">
                        <ChevronLeft size={14} /> Înapoi
                      </button>
                    )}
                    <button type="button" onClick={clearModels} disabled={isCalculating} className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-neutral-200 transition hover:border-white/20 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50">
                      <ChevronLeft size={14} /> Anulează
                    </button>
                  </div>
                )}
                {isCalculating && <p className="text-center text-sm text-rose-300">Se procesează automat fișierele...</p>}
                {errorMessage && <p role="alert" className="rounded-lg border border-red-400/30 bg-red-950/40 p-3 text-sm text-red-200">{errorMessage}</p>}
                {notice && <p role="status" className={`rounded-lg border p-3 text-sm ${orderSuccess ? "border-emerald-400/30 bg-emerald-950/40 text-emerald-200" : "border-white/10 bg-black/20 text-neutral-200"}`}>{notice}</p>}
              </div>

              {wizardVisible && (
                <>
                  {step === 1 && (
                    <div className="flex flex-col gap-2.5">
                      {!fitsBed && (
                        <p className="rounded-lg border border-red-400/30 bg-red-950/30 p-3 text-sm text-red-200">
                          Un model depășește volumul de printare 20×20×20 cm. Micșorează-l înainte de comandă.
                        </p>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        <section className="min-w-0 rounded-xl border border-white/10 bg-black/20 p-3.5">
                          <div className="mb-3 min-h-10">
                            <h3 className="text-base font-bold text-white">Material</h3>
                            <p className="mt-1 text-xs text-neutral-400">Selectează materialul</p>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {MATERIAL_OPTIONS.map((material) => (
                              <button key={material.name} type="button" disabled={!material.available} aria-pressed={material.name === "PLA"} className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border px-2 py-2.5 text-sm font-semibold ${material.available ? "border-rose-400/45 bg-gradient-to-br from-rose-500/15 to-rose-950/40 text-white shadow-[inset_0_0_14px_rgba(244,63,94,0.06)]" : "cursor-not-allowed border-white/[0.07] bg-white/[0.025] text-neutral-500"}`}>
                                <span className={`flex h-4 w-4 shrink-0 items-center justify-center ${material.available ? "text-rose-200" : "text-neutral-600"}`}>
                                  {material.available ? <Check size={14} /> : <LockKeyhole size={12} />}
                                </span>
                                <span>{material.name}</span>
                              </button>
                            ))}
                          </div>
                        </section>

                        <section className="min-w-0 rounded-xl border border-white/10 bg-black/20 p-3.5">
                          <div className="mb-3 min-h-10">
                            <h3 className="text-base font-bold text-white">Culoare</h3>
                            <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-neutral-400"><span className="h-3 w-3 shrink-0 rounded-full border border-white/30" style={{ backgroundColor: selectedColor.hex }} />{selectedColor.name} · PLA</p>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {COLORS.map((color) => (
                              <button key={color.name} type="button" disabled={!color.available} onClick={() => setSelectedColor(color)} aria-pressed={selectedColor.name === color.name} aria-label={color.name} title={color.name} className={`flex min-h-11 min-w-0 items-center gap-2 rounded-lg border px-2 py-2 text-left text-xs font-medium ${!color.available ? "cursor-not-allowed border-white/[0.07] bg-white/[0.02] text-neutral-600 opacity-60" : selectedColor.name === color.name ? "border-rose-400/45 bg-rose-950/35 text-white" : "border-white/10 bg-white/[0.02] text-neutral-200 hover:border-white/25"}`}>
                                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-white/30" style={{ backgroundColor: color.hex }}>
                                  {selectedColor.name === color.name && <Check size={10} className={color.name === "Alb" || color.name === "Baby Blue" || color.name === "Galben" ? "text-black" : "text-white"} />}
                                </span>
                                <span className="truncate text-sm">{color.name}</span>
                              </button>
                            ))}
                          </div>
                        </section>

                        <section className="col-span-2 min-w-0 rounded-xl border border-white/10 bg-black/20 p-3.5">
                          <div className="mb-2.5">
                            <h3 className="text-base font-bold text-white">Infill</h3>
                            <p className="mt-1 text-xs text-neutral-400">Densitate: {INFILL_OPTIONS.find((option) => option.value === selectedInfill)?.name}</p>
                          </div>
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            {INFILL_OPTIONS.map((option) => (
                              <button key={option.value} type="button" onClick={() => setSelectedInfill(option.value)} aria-pressed={selectedInfill === option.value} className={`group relative rounded-lg border px-2.5 py-3 text-left text-sm font-semibold transition ${selectedInfill === option.value ? "border-rose-400/40 bg-rose-950/40 text-rose-100" : "border-white/10 text-neutral-200 hover:bg-white/5"}`}>
                                {option.name}
                                <span className="group/tip absolute right-1.5 top-1.5 inline-flex" aria-label={`Despre ${option.name}`}>
                                  <Info size={15} className="text-neutral-400 hover:text-rose-200" />
                                  <span role="tooltip" className="pointer-events-none invisible absolute bottom-full right-0 z-40 mb-2 w-56 rounded-lg border border-white/15 bg-[#1c1519] p-3 text-left text-xs font-normal leading-relaxed text-neutral-100 opacity-0 shadow-xl transition group-hover/tip:visible group-hover/tip:opacity-100 group-focus-within/tip:visible group-focus-within/tip:opacity-100">
                                    {option.description}
                                  </span>
                                </span>
                              </button>
                            ))}
                          </div>
                        </section>
                      </div>
                      <div className="flex justify-start pt-1">
                        <button type="button" onClick={() => setStep(2)} disabled={isCalculating} className="flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-gradient-to-r from-rose-900 to-rose-950 px-5 py-2.5 text-sm font-bold uppercase tracking-wider text-white transition hover:scale-105 disabled:cursor-wait disabled:opacity-50">
                          Continuă <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>
                  )}

                  {step === 2 && (
                    <div className="flex flex-col gap-4 text-sm">
                      <div>
                      <span className="mb-2 block text-sm font-bold text-white">Produse și cantități</span>
                        <div className="overflow-hidden rounded-xl border border-white/10 bg-black/30">
                          {models.map((model, index) => (
                            <div key={`${model.originalName}-${index}`} className="flex items-center gap-2 border-b border-white/5 p-2.5 last:border-b-0">
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-white">{model.originalName}</p>
                              </div>
                              <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] p-1">
                                <button type="button" onClick={() => changeModelQuantity(index, model.quantity - 1)} disabled={model.quantity <= 1} className="flex h-6 w-6 items-center justify-center rounded text-neutral-300 hover:bg-white/10 disabled:cursor-default disabled:opacity-30" aria-label={`Scade cantitatea pentru ${model.originalName}`}>−</button>
                                <span className="w-6 text-center text-sm font-bold text-white" aria-label={`Cantitate ${model.quantity}`}>{model.quantity}</span>
                                <button type="button" onClick={() => changeModelQuantity(index, model.quantity + 1)} disabled={model.quantity >= 999} className="flex h-6 w-6 items-center justify-center rounded text-neutral-300 hover:bg-white/10 disabled:cursor-default disabled:opacity-30" aria-label={`Crește cantitatea pentru ${model.originalName}`}>+</button>
                              </div>
                              <button type="button" onClick={() => removeModel(index)} disabled={isCalculating} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-red-500/15 hover:text-red-200 disabled:cursor-default disabled:opacity-40" aria-label={`Elimină ${model.originalName}`} title="Elimină produsul">
                                <X size={15} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      <fieldset>
                        <legend className="mb-2 text-sm font-bold text-white">Preferință de orientare la printare</legend>
                        <div className="flex flex-col gap-2">
                          <label className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 ${orientationPreference === "estimator" ? "border-rose-500/50 bg-rose-950/30" : "border-white/10 bg-white/[0.02]"}`}>
                            <input type="radio" name="orientationPreference" value="estimator" checked={orientationPreference === "estimator"} onChange={() => setOrientationPreference("estimator")} className="mt-0.5 accent-rose-500" />
                            <span className="block text-sm font-semibold text-white">Păstrează orientarea din estimator</span>
                          </label>
                          <label className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 ${orientationPreference === "slicer" ? "border-rose-500/50 bg-rose-950/30" : "border-white/10 bg-white/[0.02]"}`}>
                            <input type="radio" name="orientationPreference" value="slicer" checked={orientationPreference === "slicer"} onChange={() => setOrientationPreference("slicer")} className="mt-0.5 accent-rose-500" />
                            <span className="block text-sm font-semibold text-white">Optimizare completă</span>
                          </label>
                        </div>
                      </fieldset>

                      <label className="block">
                        <span className="mb-2 block text-sm font-bold text-white">Note pentru comandă <span className="font-normal text-neutral-400">(opțional)</span></span>
                        <textarea value={orderNotes} onChange={(event) => setOrderNotes(event.target.value.slice(0, 1000))} maxLength={1000} rows={3} placeholder="Detalii sau instrucțiuni pentru printare..." className="w-full resize-y rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none placeholder:text-neutral-500 focus:border-rose-500/50" />
                        <span className="mt-1 block text-right text-xs text-neutral-400">{orderNotes.length}/1000</span>
                      </label>
                      <div className="flex justify-start gap-2 pt-1">
                        <button type="button" onClick={() => setStep(3)} disabled={!models.length} className="flex items-center gap-1 rounded-full border border-rose-500/30 bg-gradient-to-r from-rose-900 to-rose-950 px-5 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">Sumar ofertă <ChevronRight size={16} /></button>
                      </div>
                    </div>
                  )}

                  {step === 3 && (
                    <div className="flex flex-col gap-4 text-sm">
                      <div className="space-y-3 rounded-xl border border-white/10 bg-black/40 p-4 text-sm">
                        <div className="flex justify-between gap-3"><span className="text-neutral-400">Produse:</span><b className="max-w-[65%] text-right text-white">{models.map((model) => `${model.originalName} × ${model.quantity}`).join(", ")}</b></div>
                        <div className="flex justify-between"><span className="text-neutral-400">Culoare:</span><b className="text-white">{selectedColor.name}</b></div>
                        <div className="flex justify-between"><span className="text-neutral-400">Infill:</span><b className="text-white">{INFILL_OPTIONS.find((option) => option.value === selectedInfill)?.name ?? "Standard"}</b></div>
                        <div className="flex justify-between gap-3"><span className="text-neutral-400">Orientare:</span><b className="max-w-[65%] text-right text-white">{orientationPreference === "estimator" ? "Estimator" : "Optimizare în Bambu Studio"}</b></div>
                        <div className="flex justify-between"><span className="text-neutral-400">Scalare piese:</span><b className="max-w-[65%] text-right text-white">{models.map((model) => `${model.originalName}: ${formatScale(model.scalePct)}%`).join(", ")}</b></div>
                        <div className="flex justify-between"><span className="text-neutral-400">Volum modele:</span><b className="text-white">{quote.volumeCm3.toFixed(2)} cm³</b></div>
                        <div className="flex justify-between"><span className="text-neutral-400">Greutate estimată:</span><b className="text-white">{quote.grams.toFixed(1)} g</b></div>
                        <div className="flex justify-between"><span className="text-neutral-400">Timp estimat:</span><b className="text-white">{quote.printTimeMin} min</b></div>
                        <div className="flex justify-between"><span className="text-neutral-400">Dimensiuni piesă activă:</span><b className="text-white">{dimensionsText}</b></div>
                        {orderNotes.trim() && <div className="border-t border-white/10 pt-2"><span className="text-neutral-400">Note:</span><p className="mt-1 whitespace-pre-wrap break-words text-white">{orderNotes.trim()}</p></div>}
                        <div className="flex justify-between border-t border-white/10 pt-2"><span className="font-bold text-white">Total estimativ:</span><span className="text-xl font-black text-rose-300">{quote.totalRounded} Lei</span></div>
                      </div>
                      {!fitsBed && <p className="rounded-lg border border-red-400/30 bg-red-950/40 p-3 text-sm text-red-200">Micșorează modelele până încap pe patul de printare pentru a trimite comanda.</p>}
                      <div className="flex justify-start gap-2 pt-1">
                        <button type="button" onClick={() => void handleSendOrder()} disabled={isSubmitting || orderSuccess || !fitsBed || models.some((model) => !model.serverStoredFileName)} className="flex items-center gap-1.5 rounded-full border border-rose-500/40 bg-gradient-to-r from-rose-900 to-rose-950 px-5 py-3 text-sm font-bold text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-50">
                          <ShoppingCart size={16} />{isSubmitting ? "Se trimite..." : orderSuccess ? "Comandă trimisă" : "Trimite comanda"}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </aside>
        </div>
      </main>
    <FeaturedProducts />
    <CategoriesGrid />
    <Footer />
    </DarkRoseNoirBackground>
  );
}

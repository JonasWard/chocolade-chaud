import React from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { CellData } from '../geometry/grid';
import { DEFAULT_COLOR, IGeometrySettings, ITriangularMesh } from '../geometry/createMesh';
import { BarPart, REF_SIZE, createBarLayout, createSupportRaise } from '../geometry/barLayout';
import { INSET, START_LENGTH, GRADIENT, fanOffset, sideNormals, supportColumns } from '../geometry/barMath';
import { bakeTopSurface, createTopSurface, disposeTopSurface, fanGLSL, readTopSurface } from './shaders/bake';

/** bars with the same key can share their geometry */
export const barGeometryKey = ({ geometrySettings: g, withSupports }: CellData): string =>
  JSON.stringify([g.horizontalDivisions, g.verticalDivisions, g.innerWidth, g.innerLength, g.height, g.inset, withSupports]);

/**
 * The split up bar: its vertices have no location, only a reference to the vertex of the top surface they belong to.
 * The bounding box is the bar without its pattern, relative to its base position
 */
export const createBarGeometry = ({ geometrySettings, withSupports }: CellData): THREE.BufferGeometry => {
  const { horizontalDivisions, verticalDivisions, innerWidth, innerLength, height, inset } = geometrySettings;
  const layout = createBarLayout(horizontalDivisions, verticalDivisions);
  const raise = createSupportRaise(layout, supportColumns(horizontalDivisions, verticalDivisions, innerWidth / horizontalDivisions, withSupports));

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('aRef', new THREE.BufferAttribute(layout.refs, REF_SIZE));
  geometry.setAttribute('aRaise', new THREE.BufferAttribute(raise, 1));
  geometry.setIndex(new THREE.BufferAttribute(layout.faces, 1));

  const xs = [0, innerWidth, -fanOffset(0, horizontalDivisions, inset), innerWidth - fanOffset(horizontalDivisions, horizontalDivisions, inset)];
  const zs = [0, innerLength, -fanOffset(0, verticalDivisions, inset), innerLength - fanOffset(verticalDivisions, verticalDivisions, inset)];
  geometry.boundingBox = new THREE.Box3(new THREE.Vector3(Math.min(...xs), 0, Math.min(...zs)), new THREE.Vector3(Math.max(...xs), height, Math.max(...zs)));
  geometry.boundingSphere = geometry.boundingBox.getBoundingSphere(new THREE.Sphere());
  return geometry;
};

const vertexPars = /* glsl */ `
${fanGLSL}
attribute vec4 aRef;
attribute float aRaise;
uniform sampler2D uPositions;
uniform sampler2D uNormals;
uniform vec3 uSideNormals[4];
uniform vec2 uStep;
uniform vec2 uDivisions;
uniform float uInset;

varying float vBarFaceted;

vec3 barPosition;
vec3 barNormal;

// all the pattern work is baked into the two textures, a vertex only looks up its place on the top surface
void bar() {
  ivec2 ij = ivec2(aRef.xy);
  int part = int(aRef.z);
  barPosition = texelFetch(uPositions, ij, 0).xyz;

  if (aRef.w > 0.5) {
    vec2 foot = aRef.xy * uStep - fanOffset(aRef.xy, uDivisions, uInset);
    vec3 base = vec3(foot.x, 0.0, foot.y);
    // back support: move towards the top vertex, leaving at least INSET of material
    if (aRaise > 0.5) {
      vec3 d = barPosition - base;
      float dL = length(d);
      float l = aRef.y * uStep.y;
      float innerLength = uDivisions.y * uStep.y;
      float maxH = max(0.0, (innerLength / 2.0 - abs(l - innerLength / 2.0) - ${START_LENGTH.toFixed(4)}) * ${GRADIENT.toFixed(4)});
      float h = min(maxH, dL - ${INSET.toFixed(4)});
      if (aRaise > 1.5) h += min(maxH, dL - h - ${INSET.toFixed(4)});
      base += d * (h / dL);
    }
    barPosition = base;
  }

  if (part == ${BarPart.Top}) barNormal = texelFetch(uNormals, ij, 0).xyz;
  else if (part == ${BarPart.Bottom}) barNormal = vec3(0.0, -1.0, 0.0);
  else barNormal = uSideNormals[part - ${BarPart.WallIStart}];
  vBarFaceted = part == ${BarPart.Bottom} ? 1.0 : 0.0;
}
`;

// the bottom has no normals of its own, its triangles are shaded as they are so the back support still shows
const facetedNormal = /* glsl */ `
#include <normal_fragment_begin>
if (vBarFaceted > 0.5) normal = normalize(cross(dFdx(vViewPosition), dFdy(vViewPosition)));
`;

const createBarMaterial = () => {
  const uniforms = {
    uPositions: { value: null as THREE.Texture | null },
    uNormals: { value: null as THREE.Texture | null },
    uSideNormals: { value: [0, 1, 2, 3].map(() => new THREE.Vector3()) },
    uStep: { value: new THREE.Vector2() },
    uDivisions: { value: new THREE.Vector2() },
    uInset: { value: 0 },
  };

  const material = new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0 });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${vertexPars}`)
      .replace('#include <beginnormal_vertex>', 'bar();\nvec3 objectNormal = barNormal;')
      .replace('#include <begin_vertex>', 'vec3 transformed = barPosition;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vBarFaceted;')
      .replace('#include <normal_fragment_begin>', facetedNormal);
  };
  return { material, uniforms };
};

const setBarUniforms = (uniforms: ReturnType<typeof createBarMaterial>['uniforms'], settings: IGeometrySettings) => {
  const { innerWidth, innerLength, inset, horizontalDivisions, verticalDivisions } = settings;
  sideNormals(settings).forEach((n, w) => uniforms.uSideNormals.value[w].fromArray(n));
  uniforms.uStep.value.set(innerWidth / horizontalDivisions, innerLength / verticalDivisions);
  uniforms.uDivisions.value.set(horizontalDivisions, verticalDivisions);
  uniforms.uInset.value = inset;
};

// compares the baked top surface with the top vertices of the mesh that is exported
const logParity = (gl: THREE.WebGLRenderer, surface: Parameters<typeof readTopSurface>[1], reference: ITriangularMesh, settings: IGeometrySettings) => {
  const { horizontalDivisions, verticalDivisions, basePosition } = settings;
  const pixels = readTopSurface(gl, surface);
  let max = 0;
  for (let i = 0; i <= horizontalDivisions; i++) {
    for (let j = 0; j <= verticalDivisions; j++) {
      const p = (j * (horizontalDivisions + 1) + i) * 4;
      const v = (i * (verticalDivisions + 1) + j) * 3;
      max = Math.max(
        max,
        Math.abs(pixels[p] + basePosition.x - reference.vertices[v]),
        Math.abs(pixels[p + 1] - reference.vertices[v + 1]),
        Math.abs(pixels[p + 2] + basePosition.z - reference.vertices[v + 2])
      );
    }
  }
  console.debug(`top surface: gpu bake differs at most ${max.toExponential(2)} mm from the cpu mesh`);
};

/**
 * A bar drawn from its baked top surface: the top takes location and normal from it, the bottom and the sides refer to it.
 * reference is the exported mesh of the same bar, only used to check the bake against in development
 */
export const BarMesh: React.FC<{ cell: CellData; geometry: THREE.BufferGeometry; textTexture?: THREE.Texture; reference?: ITriangularMesh }> = ({
  cell,
  geometry,
  textTexture,
  reference,
}) => {
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  const { geometrySettings } = cell;
  const { horizontalDivisions, verticalDivisions, basePosition } = geometrySettings;

  const surface = React.useMemo(() => createTopSurface(horizontalDivisions, verticalDivisions), [horizontalDivisions, verticalDivisions]);
  React.useEffect(() => () => disposeTopSurface(surface), [surface]);

  const { material, uniforms } = React.useMemo(createBarMaterial, []);
  React.useEffect(() => () => material.dispose(), [material]);

  React.useLayoutEffect(() => {
    bakeTopSurface(gl, surface, cell, textTexture);
    uniforms.uPositions.value = surface.positions.texture;
    uniforms.uNormals.value = surface.normals.texture;
    setBarUniforms(uniforms, cell.geometrySettings);
    invalidate();
  }, [gl, surface, cell, textTexture, uniforms, invalidate]);

  React.useLayoutEffect(() => {
    material.color.set(geometrySettings.color ?? DEFAULT_COLOR);
    material.wireframe = !!geometrySettings.displayWireframe;
    invalidate();
  }, [material, geometrySettings.color, geometrySettings.displayWireframe, invalidate]);

  React.useEffect(() => {
    if (import.meta.env.DEV && reference) logParity(gl, surface, reference, cell.geometrySettings);
  }, [gl, surface, cell, textTexture, reference]);

  // the pattern is not part of the bounding box, so don't cull on it
  return <mesh geometry={geometry} material={material} position={[basePosition.x, 0, basePosition.z]} frustumCulled={false} />;
};

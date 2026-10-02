import * as THREE from 'three';
import { CellData } from '../../geometry/grid';
import { MAX_FIELD_SLOTS, fieldGLSL, sdfShaderPlan, sdfUniformValues } from './sdfCodegen';
import { IDistanceField, IFieldLevel } from '../../geometry/field';

// Bakes the top surface of a bar into two float textures of one texel per grid vertex:
// the location of the vertex (relative to the base position of the bar) and its normal.
// The pattern is only evaluated here, when the settings change, not when the bar is drawn.

/** horizontal part of the direction in which the pattern moves the surface, see fanOffset in geometry/barMath.ts */
export const fanGLSL = /* glsl */ `
vec2 fanOffset(vec2 ij, vec2 divisions, float inset) {
  return (ij * inset * 2.0) / (divisions + 1.0) - inset;
}
`;

const vertexShader = /* glsl */ `
void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

// the sdf is generated from the tree of the pattern, see sdfCodegen.ts
const positionShader = (sdfGLSL: string) => /* glsl */ `
${fieldGLSL}
${sdfGLSL}
${fanGLSL}
uniform vec2 uOrigin;
uniform vec2 uStep;
uniform vec2 uDivisions;
uniform float uHeight;
uniform float uInset;
uniform float uAmplitude;

void main() {
  vec2 ij = floor(gl_FragCoord.xy);
  vec2 local = ij * uStep;
  vec2 d = fanOffset(ij, uDivisions, uInset);
  float s = sdf(vec3(uOrigin.x + local.x, uHeight, uOrigin.y + local.y)) * uAmplitude / uHeight;
  gl_FragColor = vec4(local.x + d.x * s, uHeight + uHeight * s, local.y + d.y * s, 1.0);
}
`;

// from the neighbouring vertices, so the normals always match the baked surface, whatever went into it
const normalShader = /* glsl */ `
uniform sampler2D uPositions;

void main() {
  ivec2 ij = ivec2(gl_FragCoord.xy);
  ivec2 last = textureSize(uPositions, 0) - 1;
  vec3 di = texelFetch(uPositions, min(ij + ivec2(1, 0), last), 0).xyz - texelFetch(uPositions, max(ij - ivec2(1, 0), ivec2(0)), 0).xyz;
  vec3 dj = texelFetch(uPositions, min(ij + ivec2(0, 1), last), 0).xyz - texelFetch(uPositions, max(ij - ivec2(0, 1), ivec2(0)), 0).xyz;
  gl_FragColor = vec4(normalize(cross(dj, di)), 0.0);
}
`;

export interface ITopSurface {
  positions: THREE.WebGLRenderTarget;
  normals: THREE.WebGLRenderTarget;
}

export const createTopSurface = (horizontalDivisions: number, verticalDivisions: number): ITopSurface => {
  const target = () =>
    new THREE.WebGLRenderTarget(horizontalDivisions + 1, verticalDivisions + 1, {
      type: THREE.FloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthBuffer: false,
      generateMipmaps: false,
    });
  return { positions: target(), normals: target() };
};

export const disposeTopSurface = ({ positions, normals }: ITopSurface) => {
  positions.dispose();
  normals.dispose();
};

/** rendering to float textures is an extension of webgl2 */
export const canBakeTopSurface = (gl: THREE.WebGLRenderer): boolean => gl.extensions.has('EXT_color_buffer_float');

const createPositionMaterial = (sdfGLSL: string) =>
  new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader: positionShader(sdfGLSL),
    uniforms: {
      uParams: { value: new Float32Array(4) },
      uCenter: { value: [0, 0, 0] },
      uRotation: { value: [1, 0] },
      ...Object.fromEntries([...Array(MAX_FIELD_SLOTS).keys()].map((j) => [`uField${j}`, { value: null }])),
      uOrigin: { value: new THREE.Vector2() },
      uStep: { value: new THREE.Vector2() },
      uDivisions: { value: new THREE.Vector2() },
      uHeight: { value: 1 },
      uInset: { value: 0 },
      uAmplitude: { value: 0 },
    },
  });

// one triangle covering the whole target
const createBaker = () => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));

  const normalMaterial = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader: normalShader,
    uniforms: { uPositions: { value: null } },
  });

  const mesh = new THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>(geometry, normalMaterial);
  mesh.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(mesh);

  return { scene, mesh, camera: new THREE.Camera(), normalMaterial };
};

let baker: ReturnType<typeof createBaker> | undefined;

// a shader per structure of the pattern tree, the least recently used ones are dropped
const MAX_MATERIALS = 16;
const positionMaterials = new Map<string, THREE.ShaderMaterial>();

const positionMaterial = (sdfGLSL: string): THREE.ShaderMaterial => {
  let material = positionMaterials.get(sdfGLSL);
  if (material) positionMaterials.delete(sdfGLSL);
  else material = createPositionMaterial(sdfGLSL);
  positionMaterials.set(sdfGLSL, material);
  if (positionMaterials.size > MAX_MATERIALS) {
    const [oldest, old] = positionMaterials.entries().next().value!;
    positionMaterials.delete(oldest);
    old.dispose();
  }
  return material;
};

/** the size of the texture of a field: its finest level on top, the coarser ones side by side below it */
export const fieldTextureSize = ({ width, height, levels = [] }: IDistanceField): [number, number] =>
  levels.length ? [Math.max(width, levels.length * levels[0].width), height + levels[0].height] : [width, height];

/** a distance field as a texture for the bake, to be disposed by the caller. See fieldLevel in shaders/sdfCodegen.ts */
export const createFieldTexture = (field: IDistanceField): THREE.DataTexture => {
  const [width, height] = fieldTextureSize(field);
  const atlas = new Float32Array(width * height);
  const put = ({ width: w, height: h, distances }: IFieldLevel, x: number, y: number) => {
    for (let row = 0; row < h; row++) atlas.set(distances.subarray(row * w, (row + 1) * w), (y + row) * width + x);
  };
  put(field, 0, 0);
  field.levels?.forEach((level, k) => put(level, k * level.width, field.height));
  const texture = new THREE.DataTexture(atlas, width, height, THREE.RedFormat, THREE.FloatType);
  texture.needsUpdate = true;
  return texture;
};

/** fieldTextures holds the distance fields of the svg and text nodes of the pattern, by field key */
export const bakeTopSurface = (
  gl: THREE.WebGLRenderer,
  { positions, normals }: ITopSurface,
  { geometrySettings, sdfSettings, fields = new Map() }: CellData,
  fieldTextures: ReadonlyMap<string, THREE.Texture> = new Map()
) => {
  baker ??= createBaker();
  const { scene, mesh, camera, normalMaterial } = baker;
  const { innerWidth, innerLength, height, inset, amplitude, horizontalDivisions, verticalDivisions, basePosition } = geometrySettings;

  const plan = sdfShaderPlan(sdfSettings);
  const material = positionMaterial(plan.glsl);
  const uniforms = material.uniforms;
  Object.entries(sdfUniformValues(sdfSettings, fields)).forEach(([name, value]) => (uniforms[name].value = value));
  plan.fieldKeys.slice(0, MAX_FIELD_SLOTS).forEach((key, j) => (uniforms[`uField${j}`].value = fieldTextures.get(key) ?? null));
  uniforms.uOrigin.value.set(basePosition.x, basePosition.z);
  uniforms.uStep.value.set(innerWidth / horizontalDivisions, innerLength / verticalDivisions);
  uniforms.uDivisions.value.set(horizontalDivisions, verticalDivisions);
  uniforms.uHeight.value = height;
  uniforms.uInset.value = inset;
  uniforms.uAmplitude.value = amplitude;

  const previousTarget = gl.getRenderTarget();

  mesh.material = material;
  gl.setRenderTarget(positions);
  gl.render(scene, camera);

  normalMaterial.uniforms.uPositions.value = positions.texture;
  mesh.material = normalMaterial;
  gl.setRenderTarget(normals);
  gl.render(scene, camera);

  gl.setRenderTarget(previousTarget);
};

/** the baked top vertices as x, y, z, 1 per texel, j (the length of the bar) being the row */
export const readTopSurface = (gl: THREE.WebGLRenderer, { positions }: ITopSurface): Float32Array => {
  const pixels = new Float32Array(positions.width * positions.height * 4);
  gl.readRenderTargetPixels(positions, 0, 0, positions.width, positions.height, pixels);
  return pixels;
};

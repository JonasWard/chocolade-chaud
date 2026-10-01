import * as THREE from 'three';
import { CellData } from '../../geometry/grid';
import { sdfGLSL, sdfUniformValues } from './sdf';
import { ITextField, MIN_BEVEL_WIDTH } from '../../geometry/text/textField';

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

const positionShader = /* glsl */ `
${sdfGLSL}
${fanGLSL}
uniform vec2 uOrigin;
uniform vec2 uStep;
uniform vec2 uDivisions;
uniform float uHeight;
uniform float uInset;
uniform float uAmplitude;

// the relief of the text, see geometry/text/textField.ts
uniform sampler2D uText;
uniform bool uHasText;
uniform float uTextPixelSize;
uniform float uTextDepth;
uniform float uTextBevelWidth;
uniform float uTextPatternFade;

float textTexel(ivec2 p) {
  return texelFetch(uText, clamp(p, ivec2(0), textureSize(uText, 0) - 1), 0).r;
}

// bilinear by hand: float textures don't filter everywhere, and this way it is the same sample the exported mesh takes
float textDistance(vec2 local) {
  vec2 f = local / uTextPixelSize - 0.5;
  vec2 f0 = floor(f);
  vec2 t = f - f0;
  ivec2 p = ivec2(f0);
  float near = mix(textTexel(p), textTexel(p + ivec2(1, 0)), t.x);
  float far = mix(textTexel(p + ivec2(0, 1)), textTexel(p + ivec2(1, 1)), t.x);
  return mix(near, far, t.y);
}

float reliefHeight(float pattern, vec2 local) {
  if (!uHasText) return pattern * uAmplitude;
  float t = clamp(0.5 - textDistance(local) / max(uTextBevelWidth, ${MIN_BEVEL_WIDTH.toFixed(6)}), 0.0, 1.0);
  float mask = t * t * (3.0 - 2.0 * t);
  return pattern * uAmplitude * (1.0 - uTextPatternFade * mask) + uTextDepth * mask;
}

void main() {
  vec2 ij = floor(gl_FragCoord.xy);
  vec2 local = ij * uStep;
  vec2 d = fanOffset(ij, uDivisions, uInset);
  float s = reliefHeight(sdf(vec3(uOrigin.x + local.x, uHeight, uOrigin.y + local.y)), local) / uHeight;
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

// one triangle covering the whole target
const createBaker = () => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));

  const positionMaterial = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader: positionShader,
    uniforms: {
      uMethods: { value: [] },
      uMethodCount: { value: 0 },
      uScale: { value: 1 },
      uCenter: { value: [0, 0, 0] },
      uOrigin: { value: new THREE.Vector2() },
      uStep: { value: new THREE.Vector2() },
      uDivisions: { value: new THREE.Vector2() },
      uHeight: { value: 1 },
      uInset: { value: 0 },
      uAmplitude: { value: 0 },
      uText: { value: null },
      uHasText: { value: false },
      uTextPixelSize: { value: 1 },
      uTextDepth: { value: 0 },
      uTextBevelWidth: { value: 0 },
      uTextPatternFade: { value: 0 },
    },
  });
  const normalMaterial = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader: normalShader,
    uniforms: { uPositions: { value: null } },
  });

  const mesh = new THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>(geometry, positionMaterial);
  mesh.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(mesh);

  return { scene, mesh, camera: new THREE.Camera(), positionMaterial, normalMaterial };
};

let baker: ReturnType<typeof createBaker> | undefined;

/** the distance field of a text as a texture for the bake, to be disposed by the caller */
export const createTextTexture = ({ width, height, distances }: ITextField): THREE.DataTexture => {
  const texture = new THREE.DataTexture(distances, width, height, THREE.RedFormat, THREE.FloatType);
  texture.needsUpdate = true;
  return texture;
};

/** textTexture holds the distance field of the text of the cell, when it has one */
export const bakeTopSurface = (
  gl: THREE.WebGLRenderer,
  { positions, normals }: ITopSurface,
  { geometrySettings, sdfSettings, text }: CellData,
  textTexture?: THREE.Texture
) => {
  baker ??= createBaker();
  const { scene, mesh, camera, positionMaterial, normalMaterial } = baker;
  const { innerWidth, innerLength, height, inset, amplitude, horizontalDivisions, verticalDivisions, basePosition } = geometrySettings;

  const uniforms = positionMaterial.uniforms;
  Object.entries(sdfUniformValues(sdfSettings)).forEach(([name, value]) => (uniforms[name].value = value));
  uniforms.uOrigin.value.set(basePosition.x, basePosition.z);
  uniforms.uStep.value.set(innerWidth / horizontalDivisions, innerLength / verticalDivisions);
  uniforms.uDivisions.value.set(horizontalDivisions, verticalDivisions);
  uniforms.uHeight.value = height;
  uniforms.uInset.value = inset;
  uniforms.uAmplitude.value = amplitude;
  uniforms.uHasText.value = !!text && !!textTexture;
  uniforms.uText.value = textTexture ?? null;
  if (text) {
    uniforms.uTextPixelSize.value = text.field.pixelSize;
    uniforms.uTextDepth.value = text.depth;
    uniforms.uTextBevelWidth.value = text.bevelWidth;
    uniforms.uTextPatternFade.value = text.patternFade;
  }

  const previousTarget = gl.getRenderTarget();

  mesh.material = positionMaterial;
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

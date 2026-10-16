export const vert = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

// Simplex noise 2D (Ashima Arts, MIT)
const noise = /* glsl */ `
vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m; m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}`;

const head = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float u_time;
uniform float u_freeze;
uniform vec2 u_res;
uniform vec2 u_mouse;
`;

// Sfondo: blu scuro fisso (#1C2541 in basso, #0B132B in alto), nessun effetto acqua.
export const bgFrag = head + /* glsl */ `
void main() {
  vec3 col = mix(vec3(0.110, 0.145, 0.255), vec3(0.043, 0.075, 0.169), vUv.y);
  col *= 1.0 - 0.3 * length(vUv - 0.5);
  gl_FragColor = vec4(col, 1.0);
}`;

// Brina da vetro appannato: nebbia e venature di cristalli che crescono dai bordi con u_freeze.
export const frostFrag = head + noise + /* glsl */ `
void main() {
  float k = u_freeze;
  vec2 asp = vec2(u_res.x / u_res.y, 1.0);
  vec2 p = vUv * asp;
  float e = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
  vec2 w = vec2(snoise(p * 3.0 + 7.0), snoise(p * 3.0 - 5.0));
  float n = snoise(p * 6.0 + w * 0.6) * 0.5 + snoise(p * 13.0 + w) * 0.25;
  float reach = 0.015 + k * 0.05;
  float f = 1.0 - smoothstep(reach * 0.35, reach, e + n * 0.07 * k);
  float fog = (1.0 - smoothstep(0.0, reach * 1.8, e)) * 0.18 * k;
  float ridge = pow(1.0 - abs(snoise(p * 28.0 + w * 1.5)), 4.0);
  vec3 col = mix(vec3(0.70, 0.86, 0.96), vec3(0.97, 0.99, 1.0), ridge);
  float a = (f * (0.45 + 0.55 * ridge) + fog) * smoothstep(0.02, 0.12, k);
  a *= smoothstep(0.04, 0.16, distance(p, u_mouse * asp));
  gl_FragColor = vec4(col, clamp(a, 0.0, 0.7));
}`;

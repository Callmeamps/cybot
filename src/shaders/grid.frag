precision mediump float;

uniform vec3 uGridColor;
uniform float uGridScale;
uniform float uGridThickness;
uniform float uFadeNear;
uniform float uFadeFar;
uniform float uOpacity;

varying vec3 vWorldPos;

void main() {
  float grid = abs(fract(vWorldPos.x * uGridScale) - 0.5) + abs(fract(vWorldPos.z * uGridScale) - 0.5);
  float line = 1.0 - smoothstep(0.0, uGridThickness, grid - 0.48);
  float dist = length(vWorldPos.xz);
  float fade = 1.0 - smoothstep(uFadeNear, uFadeFar, dist);
  gl_FragColor = vec4(uGridColor, line * fade * uOpacity);
}
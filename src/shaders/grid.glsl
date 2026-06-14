vec3 gridColor = uGridColor;
float grid = abs(fract(vWorldPos.x * uGridScale) - 0.5) + abs(fract(vWorldPos.z * uGridScale) - 0.5);
float line = 1.0 - smoothstep(0.0, uGridThickness, grid - 0.48);
float dist = length(vWorldPos.xz);
float fade = 1.0 - smoothstep(uFadeNear, uFadeFar, dist);
vec4 finalColor = vec4(gridColor, line * fade * uOpacity);
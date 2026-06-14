/**
 * Detects GPU tier and returns performance settings.
 * Tier 0 = no WebGL, Tier 1 = low-end (Intel HD), Tier 2 = mid, Tier 3 = high
 */
export function detectGpuTier() {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  if (!gl) return { tier: 0, label: 'none' };

  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
  const vendor = debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : 'unknown';
  const renderer = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'unknown';

  // Low-end indicators
  const lowEnd = /intel.*hd|intel.*graphics|mesa|llvmpipe|swiftshader|virtualbox/i;
  const highEnd = /nvidia.*rtx|nvidia.*gtx.*(10|20|30|40)|amd.*rx|apple.*m(1|2|3|4)/i;

  let tier = 2;
  if (lowEnd.test(renderer) || lowEnd.test(vendor)) tier = 1;
  if (highEnd.test(renderer)) tier = 3;

  // Check max texture size as additional signal
  const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
  if (maxTextureSize < 4096) tier = Math.min(tier, 1);

  return { tier, vendor, renderer, maxTextureSize };
}

export function getPerformanceSettings(gpuTier) {
  const settings = {
    0: {
      pixelRatio: 1,
      enableBloom: false,
      enableFxaa: false,
      shapeCount: 0,
      shapeSegments: { torus: [8, 16], icosa: 0, octa: 0, dodeca: 0, knot: [24, 4] },
      platformSegments: 32,
      bloomStrength: 0,
      bloomResolution: 0.5,
      animationFps: 15,
    },
    1: {
      pixelRatio: 1,
      enableBloom: true,
      enableFxaa: false,
      shapeCount: 4,
      shapeSegments: { torus: [8, 16], icosa: 0, octa: 0, dodeca: 0, knot: [24, 6] },
      platformSegments: 32,
      bloomStrength: 0.15,
      bloomResolution: 0.5,
      animationFps: 30,
    },
    2: {
      pixelRatio: 2,
      enableBloom: true,
      enableFxaa: true,
      shapeCount: 5,
      shapeSegments: { torus: [8, 24], icosa: 0, octa: 0, dodeca: 0, knot: [48, 8] },
      platformSegments: 64,
      bloomStrength: 0.35,
      bloomResolution: 1.0,
      animationFps: 60,
    },
    3: {
      pixelRatio: 2,
      enableBloom: true,
      enableFxaa: true,
      shapeCount: 5,
      shapeSegments: { torus: [8, 32], icosa: 0, octa: 0, dodeca: 0, knot: [64, 12] },
      platformSegments: 64,
      bloomStrength: 0.5,
      bloomResolution: 1.0,
      animationFps: 60,
    },
  };

  return settings[gpuTier] || settings[1];
}
import { Effect, BlendFunction } from 'postprocessing';
import * as THREE from 'three';

const fragmentShader = `
// Basic uniforms
uniform float cellSize;
uniform bool invert;
uniform bool colorMode;
uniform int asciiStyle;

// PostFX uniforms
uniform float time;
uniform vec2 resolution;
uniform float scanlineIntensity;
uniform float scanlineCount;
uniform float vignetteIntensity;
uniform float vignetteRadius;
uniform float curvature;
uniform float aberrationStrength;
uniform float noiseIntensity;
uniform float noiseScale;
uniform float noiseSpeed;
uniform float glitchIntensity;
uniform float glitchFrequency;
uniform float brightnessAdjust;
uniform float contrastAdjust;
uniform float bloomMix;

// Helper functions
float random(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

float noise(vec2 st) {
  vec2 i = floor(st);
  vec2 f = fract(st);
  float a = random(i);
  float b = random(i + vec2(1.0, 0.0));
  float c = random(i + vec2(0.0, 1.0));
  float d = random(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

float getChar(float brightness, vec2 p, int style) {
  vec2 grid = floor(p * 4.0);
  float val = 0.0;

  if (style == 0) { // Standard ASCII-like blocks
    if (brightness < 0.1) val = 0.0;
    else if (brightness < 0.2) val = (grid.x == 1.0 && grid.y == 1.0) ? 0.3 : 0.0;
    else if (brightness < 0.35) val = (grid.x == 1.0 || grid.x == 2.0) && (grid.y == 1.0 || grid.y == 2.0) ? 1.0 : 0.0;
    else if (brightness < 0.5) val = (grid.y == 1.0 || grid.y == 2.0) ? 1.0 : 0.0;
    else if (brightness < 0.65) val = (grid.y == 0.0 || grid.y == 3.0) ? 1.0 : (grid.y == 1.0 || grid.y == 2.0) ? 0.5 : 0.0;
    else if (brightness < 0.8) val = (grid.x == 0.0 || grid.x == 2.0 || grid.y == 0.0 || grid.y == 2.0) ? 1.0 : 0.3;
    else val = 1.0;
  } else if (style == 1) { // Dense blocks
    if (brightness < 0.15) val = 0.0;
    else if (brightness < 0.3) val = mod(grid.x + grid.y, 2.0) < 1.0 ? 0.5 : 0.0;
    else if (brightness < 0.5) val = mod(grid.x + grid.y, 2.0) < 1.0 ? 1.0 : 0.3;
    else if (brightness < 0.7) val = 0.7;
    else val = 1.0;
  } else if (style == 2) { // Minimal
    if (brightness < 0.25) val = 0.0;
    else if (brightness < 0.5) val = grid.x == 2.0 && grid.y == 2.0 ? 1.0 : 0.0;
    else if (brightness < 0.75) val = (grid.x == 1.0 || grid.x == 2.0) ? 0.8 : 0.0;
    else val = 1.0;
  } else { // Blocks (style 3) - solid blocks for reference image look
    if (brightness < 0.1) val = 0.0;
    else if (brightness < 0.25) val = 0.25;
    else if (brightness < 0.5) val = 0.5;
    else if (brightness < 0.75) val = 0.75;
    else val = 1.0;
  }

  return val;
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 workUV = uv;

  // Screen curvature (CRT barrel distortion)
  if (curvature > 0.0) {
    vec2 centered = workUV * 2.0 - 1.0;
    centered *= 1.0 + curvature * dot(centered, centered);
    workUV = centered * 0.5 + 0.5;
    if (workUV.x < 0.0 || workUV.x > 1.0 || workUV.y < 0.0 || workUV.y > 1.0) {
      outputColor = vec4(0.0);
      return;
    }
  }

  // Chromatic aberration
  vec4 sampledColor;
  if (aberrationStrength > 0.0) {
    float offset = aberrationStrength;
    vec2 uvR = workUV + vec2(offset, 0.0);
    vec2 uvG = workUV;
    vec2 uvB = workUV - vec2(offset, 0.0);
    float r = texture2D(inputBuffer, uvR).r;
    float g = texture2D(inputBuffer, uvG).g;
    float b = texture2D(inputBuffer, uvB).b;
    sampledColor = vec4(r, g, b, 1.0);
  } else {
    sampledColor = texture2D(inputBuffer, workUV);
  }

  // Contrast and brightness
  sampledColor.rgb = (sampledColor.rgb - 0.5) * contrastAdjust + 0.5 + brightnessAdjust;

  // Time-based noise
  if (noiseIntensity > 0.0) {
    float noiseVal = noise(workUV * noiseScale + time * noiseSpeed);
    sampledColor.rgb += (noiseVal - 0.5) * noiseIntensity;
  }

  // Calculate cell position for ASCII effect
  vec2 cellCount = resolution / cellSize;
  vec2 cellCoord = floor(uv * cellCount);

  // RGB Glitch
  if (glitchIntensity > 0.0 && glitchFrequency > 0.0) {
    float glitchTime = floor(time * glitchFrequency);
    float glitchRand = random(vec2(glitchTime, cellCoord.y));
    if (glitchRand < glitchIntensity) {
      float shift = (random(vec2(glitchTime + 1.0, cellCoord.y)) - 0.5) * 20.0;
      cellCoord.x += shift;
    }
  }

  vec2 cellUV = (cellCoord + 0.5) / cellCount;

  // Apply chromatic aberration to ASCII cell sampling
  vec4 cellColor;
  if (aberrationStrength > 0.0) {
    float offset = aberrationStrength;
    vec2 uvR = cellUV + vec2(offset, 0.0);
    vec2 uvB = cellUV - vec2(offset, 0.0);
    float r = texture2D(inputBuffer, uvR).r;
    float g = texture2D(inputBuffer, cellUV).g;
    float b = texture2D(inputBuffer, uvB).b;
    cellColor = vec4(r, g, b, 1.0);
  } else {
    cellColor = texture2D(inputBuffer, cellUV);
  }
  float brightness = dot(cellColor.rgb, vec3(0.299, 0.587, 0.114));

  if (invert) brightness = 1.0 - brightness;

  vec2 localUV = fract(uv * cellCount);
  float charValue = getChar(brightness, localUV, asciiStyle);

  vec3 finalColor;
  if (colorMode) {
    finalColor = cellColor.rgb * charValue;
  } else {
    finalColor = vec3(brightness * charValue);
  }

  // Scanlines
  if (scanlineIntensity > 0.0) {
    float scanline = sin(uv.y * scanlineCount * 3.14159) * 0.5 + 0.5;
    finalColor *= 1.0 - (scanline * scanlineIntensity);
  }

  // Vignette
  if (vignetteIntensity > 0.0) {
    vec2 centered = uv * 2.0 - 1.0;
    float vignette = 1.0 - dot(centered, centered) / vignetteRadius;
    finalColor *= mix(1.0, vignette, vignetteIntensity);
  }

  // Mix with bloom (brighter areas)
  if (bloomMix > 0.0) {
    finalColor += sampledColor.rgb * bloomMix * brightness;
  }

  outputColor = vec4(finalColor, cellColor.a);
}
`;

export class CrtAsciiEffect extends Effect {
  constructor(options = {}) {
    const {
      cellSize = 6,
      invert = false,
      colorMode = true,
      asciiStyle = 0,
      scanlineIntensity = 0.3,
      scanlineCount = 200,
      vignetteIntensity = 0.3,
      vignetteRadius = 0.8,
      curvature = 0.05,
      aberrationStrength = 0.003,
      noiseIntensity = 0.02,
      noiseScale = 100,
      noiseSpeed = 1,
      glitchIntensity = 0,
      glitchFrequency = 0,
      brightnessAdjust = 0,
      contrastAdjust = 1,
      bloomMix = 0.2
    } = options;

    super('CrtAsciiEffect', fragmentShader, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map([
        ['cellSize', new THREE.Uniform(cellSize)],
        ['invert', new THREE.Uniform(invert)],
        ['colorMode', new THREE.Uniform(colorMode)],
        ['asciiStyle', new THREE.Uniform(asciiStyle)],
        ['time', new THREE.Uniform(0)],
        ['resolution', new THREE.Uniform(new THREE.Vector2(1920, 1080))],
        ['scanlineIntensity', new THREE.Uniform(scanlineIntensity)],
        ['scanlineCount', new THREE.Uniform(scanlineCount)],
        ['vignetteIntensity', new THREE.Uniform(vignetteIntensity)],
        ['vignetteRadius', new THREE.Uniform(vignetteRadius)],
        ['curvature', new THREE.Uniform(curvature)],
        ['aberrationStrength', new THREE.Uniform(aberrationStrength)],
        ['noiseIntensity', new THREE.Uniform(noiseIntensity)],
        ['noiseScale', new THREE.Uniform(noiseScale)],
        ['noiseSpeed', new THREE.Uniform(noiseSpeed)],
        ['glitchIntensity', new THREE.Uniform(glitchIntensity)],
        ['glitchFrequency', new THREE.Uniform(glitchFrequency)],
        ['brightnessAdjust', new THREE.Uniform(brightnessAdjust)],
        ['contrastAdjust', new THREE.Uniform(contrastAdjust)],
        ['bloomMix', new THREE.Uniform(bloomMix)]
      ])
    });

    this._time = 0;
  }

  update(renderer, inputBuffer, deltaTime) {
    this._time += deltaTime;
    this.uniforms.get('time').value = this._time;
  }

  setSize(width, height) {
    this.uniforms.get('resolution').value.set(width, height);
  }

  // Getters and setters for reactive updates
  get cellSize() { return this.uniforms.get('cellSize').value; }
  set cellSize(v) { this.uniforms.get('cellSize').value = v; }

  get invert() { return this.uniforms.get('invert').value; }
  set invert(v) { this.uniforms.get('invert').value = v; }

  get colorMode() { return this.uniforms.get('colorMode').value; }
  set colorMode(v) { this.uniforms.get('colorMode').value = v; }

  get asciiStyle() { return this.uniforms.get('asciiStyle').value; }
  set asciiStyle(v) { this.uniforms.get('asciiStyle').value = v; }

  get scanlineIntensity() { return this.uniforms.get('scanlineIntensity').value; }
  set scanlineIntensity(v) { this.uniforms.get('scanlineIntensity').value = v; }

  get scanlineCount() { return this.uniforms.get('scanlineCount').value; }
  set scanlineCount(v) { this.uniforms.get('scanlineCount').value = v; }

  get vignetteIntensity() { return this.uniforms.get('vignetteIntensity').value; }
  set vignetteIntensity(v) { this.uniforms.get('vignetteIntensity').value = v; }

  get vignetteRadius() { return this.uniforms.get('vignetteRadius').value; }
  set vignetteRadius(v) { this.uniforms.get('vignetteRadius').value = v; }

  get curvature() { return this.uniforms.get('curvature').value; }
  set curvature(v) { this.uniforms.get('curvature').value = v; }

  get aberrationStrength() { return this.uniforms.get('aberrationStrength').value; }
  set aberrationStrength(v) { this.uniforms.get('aberrationStrength').value = v; }

  get noiseIntensity() { return this.uniforms.get('noiseIntensity').value; }
  set noiseIntensity(v) { this.uniforms.get('noiseIntensity').value = v; }

  get glitchIntensity() { return this.uniforms.get('glitchIntensity').value; }
  set glitchIntensity(v) { this.uniforms.get('glitchIntensity').value = v; }

  get glitchFrequency() { return this.uniforms.get('glitchFrequency').value; }
  set glitchFrequency(v) { this.uniforms.get('glitchFrequency').value = v; }

  get brightnessAdjust() { return this.uniforms.get('brightnessAdjust').value; }
  set brightnessAdjust(v) { this.uniforms.get('brightnessAdjust').value = v; }

  get contrastAdjust() { return this.uniforms.get('contrastAdjust').value; }
  set contrastAdjust(v) { this.uniforms.get('contrastAdjust').value = v; }

  get bloomMix() { return this.uniforms.get('bloomMix').value; }
  set bloomMix(v) { this.uniforms.get('bloomMix').value = v; }
}

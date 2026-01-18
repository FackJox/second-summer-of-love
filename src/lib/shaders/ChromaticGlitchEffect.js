import { Effect, BlendFunction } from 'postprocessing';
import * as THREE from 'three';

const fragmentShader = `
// Basic uniforms
uniform float time;
uniform vec2 resolution;

// Chromatic aberration
uniform float aberrationAmount;
uniform float aberrationAngle;
uniform bool aberrationAnimated;
uniform float aberrationSpeed;

// Glitch uniforms
uniform float glitchIntensity;
uniform float glitchFrequency;
uniform float blockGlitchIntensity;
uniform float blockGlitchSize;
uniform float rgbShiftIntensity;

// Scan lines
uniform float scanlineIntensity;
uniform float scanlineCount;
uniform float scanlineSpeed;

// Distortion
uniform float waveDistortion;
uniform float waveFrequency;
uniform float waveSpeed;

// Color effects
uniform float saturation;
uniform float brightness;
uniform float contrast;
uniform float vignetteIntensity;
uniform float vignetteRadius;

// Noise
uniform float noiseIntensity;
uniform float noiseSpeed;

// Hash functions for randomness
float hash(float n) {
  return fract(sin(n) * 43758.5453123);
}

float hash2(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);

  float a = hash2(i);
  float b = hash2(i + vec2(1.0, 0.0));
  float c = hash2(i + vec2(0.0, 1.0));
  float d = hash2(i + vec2(1.0, 1.0));

  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// Chromatic aberration with animated offset
vec3 chromaticAberration(vec2 uv, float amount, float angle) {
  float actualAmount = amount;
  float actualAngle = angle;

  if (aberrationAnimated) {
    // Animate the aberration
    actualAmount *= 1.0 + 0.5 * sin(time * aberrationSpeed);
    actualAngle += time * aberrationSpeed * 0.5;
  }

  vec2 dir = vec2(cos(actualAngle), sin(actualAngle)) * actualAmount;

  float r = texture2D(inputBuffer, uv + dir).r;
  float g = texture2D(inputBuffer, uv).g;
  float b = texture2D(inputBuffer, uv - dir).b;

  return vec3(r, g, b);
}

// Block-based glitch effect
vec2 blockGlitch(vec2 uv, float intensity, float blockSize) {
  if (intensity <= 0.0) return uv;

  float glitchTime = floor(time * glitchFrequency);
  float blockY = floor(uv.y * blockSize);
  float randomVal = hash(blockY + glitchTime * 100.0);

  // Only glitch some blocks
  if (randomVal < intensity) {
    float offset = (hash(blockY + glitchTime * 200.0) - 0.5) * intensity * 0.1;
    uv.x += offset;
  }

  return uv;
}

// RGB channel shift glitch
vec3 rgbShiftGlitch(vec2 uv, float intensity) {
  if (intensity <= 0.0) return texture2D(inputBuffer, uv).rgb;

  float glitchTime = floor(time * glitchFrequency);
  float trigger = hash(glitchTime);

  if (trigger < 0.3) {
    // Horizontal RGB shift
    float shiftAmount = intensity * 0.02 * (hash(glitchTime + 1.0) - 0.5);
    float r = texture2D(inputBuffer, uv + vec2(shiftAmount, 0.0)).r;
    float g = texture2D(inputBuffer, uv).g;
    float b = texture2D(inputBuffer, uv - vec2(shiftAmount, 0.0)).b;
    return vec3(r, g, b);
  }

  return texture2D(inputBuffer, uv).rgb;
}

// Random line glitch
float lineGlitch(vec2 uv) {
  float glitchTime = floor(time * glitchFrequency);
  float lineY = floor(uv.y * 100.0);
  float randomVal = hash(lineY + glitchTime * 50.0);

  if (randomVal < glitchIntensity * 0.1) {
    return (hash(lineY + glitchTime * 51.0) - 0.5) * 2.0;
  }

  return 0.0;
}

// Wave distortion
vec2 waveDistort(vec2 uv) {
  if (waveDistortion <= 0.0) return uv;

  float wave = sin(uv.y * waveFrequency + time * waveSpeed) * waveDistortion * 0.01;
  return uv + vec2(wave, 0.0);
}

// Scanlines
float scanline(vec2 uv) {
  if (scanlineIntensity <= 0.0) return 1.0;

  float y = uv.y * scanlineCount + time * scanlineSpeed;
  float line = sin(y * 3.14159) * 0.5 + 0.5;
  return 1.0 - line * scanlineIntensity;
}

// Vignette
float vignette(vec2 uv) {
  if (vignetteIntensity <= 0.0) return 1.0;

  vec2 centered = uv * 2.0 - 1.0;
  float dist = length(centered);
  float vig = 1.0 - smoothstep(vignetteRadius * 0.5, vignetteRadius, dist);
  return mix(1.0, vig, vignetteIntensity);
}

// Color adjustments
vec3 adjustColor(vec3 color) {
  // Brightness
  color += brightness;

  // Contrast
  color = (color - 0.5) * contrast + 0.5;

  // Saturation
  float luminance = dot(color, vec3(0.299, 0.587, 0.114));
  color = mix(vec3(luminance), color, saturation);

  return clamp(color, 0.0, 1.0);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 workUV = uv;

  // Apply wave distortion
  workUV = waveDistort(workUV);

  // Apply block glitch to UV
  workUV = blockGlitch(workUV, blockGlitchIntensity, blockGlitchSize);

  // Apply random line offset
  float lineOffset = lineGlitch(workUV);
  workUV.x += lineOffset * glitchIntensity * 0.05;

  // Sample with chromatic aberration - preserve alpha
  vec4 sampledColor;
  if (aberrationAmount > 0.0) {
    vec3 rgb = chromaticAberration(workUV, aberrationAmount, aberrationAngle);
    float alpha = texture2D(inputBuffer, workUV).a;
    sampledColor = vec4(rgb, alpha);
  } else {
    sampledColor = texture2D(inputBuffer, workUV);
  }

  vec3 color = sampledColor.rgb;
  float alpha = sampledColor.a;

  // Apply RGB shift glitch on top
  if (rgbShiftIntensity > 0.0 && glitchFrequency > 0.0) {
    vec3 shifted = rgbShiftGlitch(workUV, rgbShiftIntensity);
    color = mix(color, shifted, 0.5);
  }

  // Add noise
  if (noiseIntensity > 0.0) {
    float n = noise(workUV * 500.0 + time * noiseSpeed) * 2.0 - 1.0;
    color += n * noiseIntensity;
  }

  // Apply color adjustments
  color = adjustColor(color);

  // Apply scanlines
  color *= scanline(uv);

  // Apply vignette
  color *= vignette(uv);

  outputColor = vec4(color, alpha);
}
`;

export class ChromaticGlitchEffect extends Effect {
  constructor(options = {}) {
    const {
      // Chromatic aberration
      aberrationAmount = 0.005,
      aberrationAngle = 0,
      aberrationAnimated = true,
      aberrationSpeed = 2,

      // Glitch
      glitchIntensity = 0.1,
      glitchFrequency = 4,
      blockGlitchIntensity = 0.1,
      blockGlitchSize = 20,
      rgbShiftIntensity = 0.5,

      // Scanlines
      scanlineIntensity = 0.1,
      scanlineCount = 200,
      scanlineSpeed = 0,

      // Distortion
      waveDistortion = 0,
      waveFrequency = 10,
      waveSpeed = 1,

      // Color
      saturation = 1,
      brightness = 0,
      contrast = 1,
      vignetteIntensity = 0.2,
      vignetteRadius = 1.2,

      // Noise
      noiseIntensity = 0.02,
      noiseSpeed = 10
    } = options;

    super('ChromaticGlitchEffect', fragmentShader, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map([
        ['time', new THREE.Uniform(0)],
        ['resolution', new THREE.Uniform(new THREE.Vector2(1920, 1080))],

        // Chromatic aberration
        ['aberrationAmount', new THREE.Uniform(aberrationAmount)],
        ['aberrationAngle', new THREE.Uniform(aberrationAngle)],
        ['aberrationAnimated', new THREE.Uniform(aberrationAnimated)],
        ['aberrationSpeed', new THREE.Uniform(aberrationSpeed)],

        // Glitch
        ['glitchIntensity', new THREE.Uniform(glitchIntensity)],
        ['glitchFrequency', new THREE.Uniform(glitchFrequency)],
        ['blockGlitchIntensity', new THREE.Uniform(blockGlitchIntensity)],
        ['blockGlitchSize', new THREE.Uniform(blockGlitchSize)],
        ['rgbShiftIntensity', new THREE.Uniform(rgbShiftIntensity)],

        // Scanlines
        ['scanlineIntensity', new THREE.Uniform(scanlineIntensity)],
        ['scanlineCount', new THREE.Uniform(scanlineCount)],
        ['scanlineSpeed', new THREE.Uniform(scanlineSpeed)],

        // Distortion
        ['waveDistortion', new THREE.Uniform(waveDistortion)],
        ['waveFrequency', new THREE.Uniform(waveFrequency)],
        ['waveSpeed', new THREE.Uniform(waveSpeed)],

        // Color
        ['saturation', new THREE.Uniform(saturation)],
        ['brightness', new THREE.Uniform(brightness)],
        ['contrast', new THREE.Uniform(contrast)],
        ['vignetteIntensity', new THREE.Uniform(vignetteIntensity)],
        ['vignetteRadius', new THREE.Uniform(vignetteRadius)],

        // Noise
        ['noiseIntensity', new THREE.Uniform(noiseIntensity)],
        ['noiseSpeed', new THREE.Uniform(noiseSpeed)]
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

  // Chromatic aberration getters/setters
  get aberrationAmount() { return this.uniforms.get('aberrationAmount').value; }
  set aberrationAmount(v) { this.uniforms.get('aberrationAmount').value = v; }

  get aberrationAngle() { return this.uniforms.get('aberrationAngle').value; }
  set aberrationAngle(v) { this.uniforms.get('aberrationAngle').value = v; }

  get aberrationAnimated() { return this.uniforms.get('aberrationAnimated').value; }
  set aberrationAnimated(v) { this.uniforms.get('aberrationAnimated').value = v; }

  get aberrationSpeed() { return this.uniforms.get('aberrationSpeed').value; }
  set aberrationSpeed(v) { this.uniforms.get('aberrationSpeed').value = v; }

  // Glitch getters/setters
  get glitchIntensity() { return this.uniforms.get('glitchIntensity').value; }
  set glitchIntensity(v) { this.uniforms.get('glitchIntensity').value = v; }

  get glitchFrequency() { return this.uniforms.get('glitchFrequency').value; }
  set glitchFrequency(v) { this.uniforms.get('glitchFrequency').value = v; }

  get blockGlitchIntensity() { return this.uniforms.get('blockGlitchIntensity').value; }
  set blockGlitchIntensity(v) { this.uniforms.get('blockGlitchIntensity').value = v; }

  get blockGlitchSize() { return this.uniforms.get('blockGlitchSize').value; }
  set blockGlitchSize(v) { this.uniforms.get('blockGlitchSize').value = v; }

  get rgbShiftIntensity() { return this.uniforms.get('rgbShiftIntensity').value; }
  set rgbShiftIntensity(v) { this.uniforms.get('rgbShiftIntensity').value = v; }

  // Scanline getters/setters
  get scanlineIntensity() { return this.uniforms.get('scanlineIntensity').value; }
  set scanlineIntensity(v) { this.uniforms.get('scanlineIntensity').value = v; }

  get scanlineCount() { return this.uniforms.get('scanlineCount').value; }
  set scanlineCount(v) { this.uniforms.get('scanlineCount').value = v; }

  get scanlineSpeed() { return this.uniforms.get('scanlineSpeed').value; }
  set scanlineSpeed(v) { this.uniforms.get('scanlineSpeed').value = v; }

  // Distortion getters/setters
  get waveDistortion() { return this.uniforms.get('waveDistortion').value; }
  set waveDistortion(v) { this.uniforms.get('waveDistortion').value = v; }

  get waveFrequency() { return this.uniforms.get('waveFrequency').value; }
  set waveFrequency(v) { this.uniforms.get('waveFrequency').value = v; }

  get waveSpeed() { return this.uniforms.get('waveSpeed').value; }
  set waveSpeed(v) { this.uniforms.get('waveSpeed').value = v; }

  // Color getters/setters
  get saturation() { return this.uniforms.get('saturation').value; }
  set saturation(v) { this.uniforms.get('saturation').value = v; }

  get brightness() { return this.uniforms.get('brightness').value; }
  set brightness(v) { this.uniforms.get('brightness').value = v; }

  get contrast() { return this.uniforms.get('contrast').value; }
  set contrast(v) { this.uniforms.get('contrast').value = v; }

  get vignetteIntensity() { return this.uniforms.get('vignetteIntensity').value; }
  set vignetteIntensity(v) { this.uniforms.get('vignetteIntensity').value = v; }

  get vignetteRadius() { return this.uniforms.get('vignetteRadius').value; }
  set vignetteRadius(v) { this.uniforms.get('vignetteRadius').value = v; }

  // Noise getters/setters
  get noiseIntensity() { return this.uniforms.get('noiseIntensity').value; }
  set noiseIntensity(v) { this.uniforms.get('noiseIntensity').value = v; }

  get noiseSpeed() { return this.uniforms.get('noiseSpeed').value; }
  set noiseSpeed(v) { this.uniforms.get('noiseSpeed').value = v; }
}

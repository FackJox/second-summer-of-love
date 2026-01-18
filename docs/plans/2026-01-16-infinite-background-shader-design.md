# Infinite Background Shader Design

**Created:** 2026-01-16T16:06:17Z

## Overview

WebGL shader-based background effect for the wedding invite that creates an infinite, dreamy panning effect with the gradient background image.

## Requirements

1. Show only a small snippet (~30%) of the background image
2. Idle state: slow, hypnotic drift (barely perceptible)
3. Mouse/touch: responsive parallax effect following cursor
4. Infinite movement without hitting edges (mirror tiling)
5. Subtle wave distortion for liquid/dreamy feel

## Architecture

```
+page.svelte
└── <main>
    ├── BackgroundShader.svelte  ← New (WebGL canvas, z-index: 0)
    ├── Poster.svelte            ← Existing (z-index: 1)
    └── modals/overlays...
```

## Shader Design

### Vertex Shader
Simple fullscreen quad passing UV coordinates.

### Fragment Shader
```glsl
uniform sampler2D uTexture;
uniform float uTime;
uniform vec2 uOffset;
uniform vec2 uResolution;

void main() {
    vec2 uv = gl_FragCoord.xy / uResolution;

    // 1. Distortion (gentle sine wave ripple)
    float distortStrength = 0.008;
    float waveSpeed = 0.3;
    float waveFreq = 3.0;
    uv.x += sin(uv.y * waveFreq + uTime * waveSpeed) * distortStrength;
    uv.y += cos(uv.x * waveFreq + uTime * waveSpeed * 0.7) * distortStrength;

    // 2. Pan offset (drift + mouse)
    uv += uOffset;

    // 3. Scale to show ~30% of image
    uv *= 0.3;

    // 4. Mirror tiling for seamless infinite scroll
    vec2 t = mod(uv, 2.0);
    vec2 mirroredUV = 1.0 - abs(t - 1.0);

    gl_FragColor = texture2D(uTexture, mirroredUV);
}
```

## Animation Logic

### Idle Drift
```typescript
// Per frame, very slow diagonal drift
idleOffset.x += 0.00008;
idleOffset.y += 0.00005;
```

### Mouse/Touch Response
- Map cursor position to offset range (-0.1 to +0.1)
- Smooth interpolation with 0.03 lerp factor
- Return to idle after 2 seconds of no movement

### Final Offset
```typescript
uOffset = idleOffset + currentMouseOffset;
```

## Implementation Steps

1. Create `BackgroundShader.svelte` component
2. Implement WebGL context and shader compilation
3. Load texture with GL_REPEAT (though we use mirror logic)
4. Implement animation loop with time/offset uniforms
5. Add mouse/touch event listeners
6. Integrate into `+page.svelte` behind poster
7. Handle resize and cleanup

## Technical Notes

- Mirror formula: `1.0 - abs(mod(uv, 2.0) - 1.0)` creates triangle wave
- Texture uses LINEAR filtering for smooth sampling
- Canvas sized to full viewport, updates on resize
- requestAnimationFrame for smooth 60fps animation

<script>
	import { onMount, onDestroy, tick } from 'svelte';
	import { browser } from '$app/environment';

	// Accept container element for sizing (optional, falls back to parent)
	export let container = null;

	// Exported params that can be controlled externally
	export let params = {
		// Rotation
		rotationSpeed: 0.03,
		// Time scale
		timeScale: 0.16,
		// Blob distortion
		blobStrength: 0.095,
		blobFreqX: 8.8,
		blobFreqY: 1.2,
		// Swirl vortexes
		swirlStrength: 0.75,
		swirlFalloff: 3.0,
		swirlFreq: 10.0,
		swirlSpeed: 2.0,
		// Flow
		flowStrength: 0.11,
		flowFreq: 3.0,
		// Ripples
		rippleStrength: 0.014,
		rippleFreq: 17.5,
		// Breathing/scale
		breatheAmount: 0.22,
		breatheSpeed: 0.05,
		baseScale: 0.5,
		// Pan speed
		panSpeed: 0.001,
		// Blur
		blur: 0,
		// Color adjustments
		saturation: 1.15,
		contrast: 1.1,
		// Film grain - retrowave analog aesthetic
		grainIntensity: 0.25,
		grainSize: 2.7,
		grainSpeed: 15,
		grainChroma: 0,
		// Black & white speckles - film dust/dirt
		speckleIntensity: 0.01,
		speckleSize: 0.1,
		speckleDensity: 0.791,
		speckleSpeed: 5
	};

	// Image source
	export let imageSrc = '/assets/background.png';

	// Callback when image changes
	export let onImageChange = null;

	let canvas;
	let gl;
	let mainProgram;
	let blurProgram;
	let finalProgram;
	let animationId;
	let textureLoaded = false;
	let mounted = false;
	let currentImageSrc = imageSrc;

	// Framebuffer objects
	let framebuffer;
	let framebufferTexture;
	let blurFramebuffer;
	let blurFramebufferTexture;

	// Source texture (background image)
	let sourceTexture;

	// Main program uniform locations
	let uTextureLoc, uTimeLoc, uAnimTimeLoc, uOffsetLoc, uResolutionLoc;
	let uRotationSpeedLoc, uTimeScaleLoc;
	let uBlobStrengthLoc, uBlobFreqLoc;
	let uSwirlStrengthLoc, uSwirlFalloffLoc, uSwirlFreqLoc, uSwirlSpeedLoc;
	let uFlowStrengthLoc, uFlowFreqLoc;
	let uRippleStrengthLoc, uRippleFreqLoc;
	let uBreatheAmountLoc, uBreatheSpeedLoc, uBaseScaleLoc;
	let uSaturationLoc, uContrastLoc;
	let uGrainIntensityLoc, uGrainSizeLoc, uGrainSpeedLoc, uGrainChromaLoc;

	// Blur program uniform locations
	let blurTextureLoc, blurResolutionLoc, blurDirectionLoc, blurAmountLoc;

	// Final program uniform locations
	let finalTextureLoc, finalResolutionLoc, finalTimeLoc;
	let finalSpeckleIntensityLoc, finalSpeckleSizeLoc, finalSpeckleDensityLoc, finalSpeckleSpeedLoc;

	// Geometry buffer (shared)
	let positionBuffer;

	// Animation state
	let startTime = 0;
	let panOffset = { x: 0, y: 0 };
	let panDirection = { x: 0.894, y: 0.447 };

	// Accumulated animation time (integrates speedMod properly)
	let accumulatedAnimTime = 0;

	// Frame timing
	let lastTimestamp = 0;
	let slowFrameCount = 0;

	const VERTEX_SHADER = `
		attribute vec2 aPosition;
		varying vec2 vUv;
		void main() {
			vUv = aPosition * 0.5 + 0.5;
			gl_Position = vec4(aPosition, 0.0, 1.0);
		}
	`;

	// Main effect shader (renders to framebuffer)
	const MAIN_FRAGMENT_SHADER = `
		precision highp float;
		varying vec2 vUv;

		uniform sampler2D uTexture;
		uniform float uTime;
		uniform float uAnimTime;  // Pre-accumulated animation time (integrates speedMod properly)
		uniform vec2 uOffset;
		uniform vec2 uResolution;

		uniform float uRotationSpeed;
		uniform float uTimeScale;
		uniform float uBlobStrength;
		uniform vec2 uBlobFreq;
		uniform float uSwirlStrength;
		uniform float uSwirlFalloff;
		uniform float uSwirlFreq;
		uniform float uSwirlSpeed;
		uniform float uFlowStrength;
		uniform float uFlowFreq;
		uniform float uRippleStrength;
		uniform float uRippleFreq;
		uniform float uBreatheAmount;
		uniform float uBreatheSpeed;
		uniform float uBaseScale;

		uniform float uSaturation;
		uniform float uContrast;

		uniform float uGrainIntensity;
		uniform float uGrainSize;
		uniform float uGrainSpeed;
		uniform float uGrainChroma;

		vec2 rotate(vec2 p, float angle) {
			float c = cos(angle);
			float s = sin(angle);
			return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
		}

		float hash12(vec2 p) {
			vec3 p3 = fract(vec3(p.xyx) * 0.1031);
			p3 += dot(p3, p3.yzx + 33.33);
			return fract((p3.x + p3.y) * p3.z);
		}

		vec3 hash32(vec2 p) {
			vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
			p3 += dot(p3, p3.yxz + 33.33);
			return fract((p3.xxy + p3.yzz) * p3.zyx);
		}

		vec3 filmGrain(vec2 fragCoord, float time, float intensity, float size, float chromaAmount) {
			vec2 grainCoord = fragCoord / size;
			float t = floor(time * uGrainSpeed);
			vec2 seed1 = grainCoord + t * 1.37;
			vec2 seed2 = grainCoord * 1.1 + t * 2.41;
			vec2 seed3 = grainCoord * 0.9 + t * 0.73;
			float luma1 = hash12(seed1) - 0.5;
			float luma2 = hash12(seed2) - 0.5;
			float luma3 = hash12(seed3) - 0.5;
			float luminanceNoise = (luma1 * 0.5 + luma2 * 0.35 + luma3 * 0.15) * 2.0;
			vec3 chromaNoise = hash32(seed1 + 100.0) - 0.5;
			chromaNoise += (hash32(seed2 + 200.0) - 0.5) * 0.5;
			chromaNoise = chromaNoise * chromaAmount;
			vec3 grain = vec3(luminanceNoise) + chromaNoise;
			return grain * intensity;
		}

		void main() {
			vec2 uv = vUv;

			// Use pre-accumulated animation time (speedMod integration done on CPU)
			// This fixes the bug where t = uTime * speedMod would cause acceleration
			// because instantaneous speedMod was multiplied by total elapsed time
			float rotationAngle = uAnimTime * uRotationSpeed;
			uv = rotate(uv - 0.5, rotationAngle) + 0.5;

			float t = uAnimTime * uTimeScale;

			float blob1 = sin(uv.x * uBlobFreq.x + t * 0.7) * cos(uv.y * uBlobFreq.y + t * 0.5);
			float blob2 = cos(uv.x * uBlobFreq.x * 1.2 - t * 0.6) * sin(uv.y * uBlobFreq.y * 1.17 + t * 0.8);

			vec2 center1 = vec2(0.3 + sin(t * 0.5) * 0.2, 0.4 + cos(t * 0.4) * 0.2);
			vec2 center2 = vec2(0.7 + cos(t * 0.6) * 0.2, 0.6 + sin(t * 0.3) * 0.2);

			float dist1 = length(uv - center1);
			float dist2 = length(uv - center2);

			float swirl1 = exp(-dist1 * uSwirlFalloff) * sin(dist1 * uSwirlFreq - t * uSwirlSpeed) * uSwirlStrength;
			float swirl2 = exp(-dist2 * uSwirlFalloff) * sin(dist2 * uSwirlFreq * 0.8 + t * uSwirlSpeed * 0.75) * uSwirlStrength * 0.8;

			vec2 toCenter1 = uv - center1;
			vec2 toCenter2 = uv - center2;
			uv += rotate(toCenter1, swirl1) - toCenter1;
			uv += rotate(toCenter2, swirl2) - toCenter2;

			float flow = sin(uv.x * uFlowFreq + uv.y * uFlowFreq * 0.67 + t * 1.2) * 0.5;
			flow += cos(uv.y * uFlowFreq * 0.83 - uv.x * uFlowFreq * 0.5 + t * 0.9) * 0.5;

			float ripple1 = sin(uv.x * uRippleFreq + t * 2.0) * cos(uv.y * uRippleFreq * 0.83 - t * 1.5);
			float ripple2 = cos(uv.x * uRippleFreq * 0.83 - t * 1.8) * sin(uv.y * uRippleFreq * 1.17 + t * 2.2);

			vec2 distort;
			distort.x = blob1 * uBlobStrength + flow * uFlowStrength + ripple1 * uRippleStrength;
			distort.y = blob2 * uBlobStrength + flow * uFlowStrength * 0.8 + ripple2 * uRippleStrength;

			uv += distort;
			uv += uOffset;

			float breathe = sin(uAnimTime * uBreatheSpeed) * uBreatheAmount;
			float scale = uBaseScale + breathe;
			uv = (uv - 0.5) * scale + 0.5;

			vec4 color = texture2D(uTexture, uv);

			// Apply saturation
			float luminance = dot(color.rgb, vec3(0.299, 0.587, 0.114));
			color.rgb = mix(vec3(luminance), color.rgb, uSaturation);

			// Apply contrast
			color.rgb = (color.rgb - 0.5) * uContrast + 0.5;

			// Apply grain (before blur)
			vec3 grain = filmGrain(gl_FragCoord.xy, uTime, uGrainIntensity, uGrainSize, uGrainChroma);
			color.rgb += grain;
			color.rgb = clamp(color.rgb, 0.0, 1.0);

			gl_FragColor = color;
		}
	`;

	// Separable gaussian blur shader
	const BLUR_FRAGMENT_SHADER = `
		precision highp float;
		varying vec2 vUv;

		uniform sampler2D uTexture;
		uniform vec2 uResolution;
		uniform vec2 uDirection;
		uniform float uBlurAmount;

		void main() {
			vec2 texelSize = 1.0 / uResolution;
			vec3 result = vec3(0.0);

			// 9-tap gaussian blur
			float weights[5];
			weights[0] = 0.227027;
			weights[1] = 0.1945946;
			weights[2] = 0.1216216;
			weights[3] = 0.054054;
			weights[4] = 0.016216;

			result += texture2D(uTexture, vUv).rgb * weights[0];

			for (int i = 1; i < 5; i++) {
				vec2 offset = uDirection * texelSize * float(i) * uBlurAmount;
				result += texture2D(uTexture, vUv + offset).rgb * weights[i];
				result += texture2D(uTexture, vUv - offset).rgb * weights[i];
			}

			gl_FragColor = vec4(result, 1.0);
		}
	`;

	// Final composite shader (adds speckles after blur)
	const FINAL_FRAGMENT_SHADER = `
		precision highp float;
		varying vec2 vUv;

		uniform sampler2D uTexture;
		uniform vec2 uResolution;
		uniform float uTime;

		uniform float uSpeckleIntensity;
		uniform float uSpeckleSize;
		uniform float uSpeckleDensity;
		uniform float uSpeckleSpeed;

		float hash12(vec2 p) {
			vec3 p3 = fract(vec3(p.xyx) * 0.1031);
			p3 += dot(p3, p3.yzx + 33.33);
			return fract((p3.x + p3.y) * p3.z);
		}

		vec3 filmSpeckles(vec2 fragCoord, float time) {
			vec2 blockCoord = floor(fragCoord / uSpeckleSize);
			float t = floor(time * uSpeckleSpeed);

			float rand = hash12(blockCoord + t * 7.31);

			vec3 speckle = vec3(0.0);

			if (rand > uSpeckleDensity) {
				speckle = vec3(uSpeckleIntensity);
			}

			return speckle;
		}

		void main() {
			vec4 color = texture2D(uTexture, vUv);

			// Apply speckles AFTER blur
			vec3 speckles = filmSpeckles(gl_FragCoord.xy, uTime);
			color.rgb += speckles;
			color.rgb = clamp(color.rgb, 0.0, 1.0);

			gl_FragColor = color;
		}
	`;

	function createShader(type, source) {
		const shader = gl.createShader(type);
		gl.shaderSource(shader, source);
		gl.compileShader(shader);
		if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
			console.error('Shader compile error:', gl.getShaderInfoLog(shader));
			gl.deleteShader(shader);
			return null;
		}
		return shader;
	}

	function createProgramFromShaders(vertexSource, fragmentSource) {
		const vertexShader = createShader(gl.VERTEX_SHADER, vertexSource);
		const fragmentShader = createShader(gl.FRAGMENT_SHADER, fragmentSource);
		if (!vertexShader || !fragmentShader) return null;

		const prog = gl.createProgram();
		gl.attachShader(prog, vertexShader);
		gl.attachShader(prog, fragmentShader);
		gl.linkProgram(prog);

		if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
			console.error('Program link error:', gl.getProgramInfoLog(prog));
			return null;
		}
		return prog;
	}

	function createFramebuffer(width, height) {
		const fbo = gl.createFramebuffer();
		gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);

		const texture = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		return { fbo, texture };
	}

	function resizeFramebuffers(width, height) {
		if (framebufferTexture) {
			gl.deleteTexture(framebufferTexture);
			gl.deleteFramebuffer(framebuffer);
		}
		if (blurFramebufferTexture) {
			gl.deleteTexture(blurFramebufferTexture);
			gl.deleteFramebuffer(blurFramebuffer);
		}

		const fb1 = createFramebuffer(width, height);
		framebuffer = fb1.fbo;
		framebufferTexture = fb1.texture;

		const fb2 = createFramebuffer(width, height);
		blurFramebuffer = fb2.fbo;
		blurFramebufferTexture = fb2.texture;
	}

	function initWebGL() {
		gl = canvas.getContext('webgl');
		if (!gl) {
			console.error('WebGL not supported');
			return false;
		}

		// Create all three programs
		mainProgram = createProgramFromShaders(VERTEX_SHADER, MAIN_FRAGMENT_SHADER);
		blurProgram = createProgramFromShaders(VERTEX_SHADER, BLUR_FRAGMENT_SHADER);
		finalProgram = createProgramFromShaders(VERTEX_SHADER, FINAL_FRAGMENT_SHADER);

		if (!mainProgram || !blurProgram || !finalProgram) return false;

		// Shared geometry
		const positions = new Float32Array([
			-1, -1,  1, -1,  -1, 1,
			-1,  1,  1, -1,   1, 1
		]);

		positionBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

		// Get main program uniforms
		gl.useProgram(mainProgram);
		const aPositionLoc = gl.getAttribLocation(mainProgram, 'aPosition');
		gl.enableVertexAttribArray(aPositionLoc);
		gl.vertexAttribPointer(aPositionLoc, 2, gl.FLOAT, false, 0, 0);

		uTextureLoc = gl.getUniformLocation(mainProgram, 'uTexture');
		uTimeLoc = gl.getUniformLocation(mainProgram, 'uTime');
		uAnimTimeLoc = gl.getUniformLocation(mainProgram, 'uAnimTime');
		uOffsetLoc = gl.getUniformLocation(mainProgram, 'uOffset');
		uResolutionLoc = gl.getUniformLocation(mainProgram, 'uResolution');
		uRotationSpeedLoc = gl.getUniformLocation(mainProgram, 'uRotationSpeed');
		uTimeScaleLoc = gl.getUniformLocation(mainProgram, 'uTimeScale');
		uBlobStrengthLoc = gl.getUniformLocation(mainProgram, 'uBlobStrength');
		uBlobFreqLoc = gl.getUniformLocation(mainProgram, 'uBlobFreq');
		uSwirlStrengthLoc = gl.getUniformLocation(mainProgram, 'uSwirlStrength');
		uSwirlFalloffLoc = gl.getUniformLocation(mainProgram, 'uSwirlFalloff');
		uSwirlFreqLoc = gl.getUniformLocation(mainProgram, 'uSwirlFreq');
		uSwirlSpeedLoc = gl.getUniformLocation(mainProgram, 'uSwirlSpeed');
		uFlowStrengthLoc = gl.getUniformLocation(mainProgram, 'uFlowStrength');
		uFlowFreqLoc = gl.getUniformLocation(mainProgram, 'uFlowFreq');
		uRippleStrengthLoc = gl.getUniformLocation(mainProgram, 'uRippleStrength');
		uRippleFreqLoc = gl.getUniformLocation(mainProgram, 'uRippleFreq');
		uBreatheAmountLoc = gl.getUniformLocation(mainProgram, 'uBreatheAmount');
		uBreatheSpeedLoc = gl.getUniformLocation(mainProgram, 'uBreatheSpeed');
		uBaseScaleLoc = gl.getUniformLocation(mainProgram, 'uBaseScale');
		uSaturationLoc = gl.getUniformLocation(mainProgram, 'uSaturation');
		uContrastLoc = gl.getUniformLocation(mainProgram, 'uContrast');
		uGrainIntensityLoc = gl.getUniformLocation(mainProgram, 'uGrainIntensity');
		uGrainSizeLoc = gl.getUniformLocation(mainProgram, 'uGrainSize');
		uGrainSpeedLoc = gl.getUniformLocation(mainProgram, 'uGrainSpeed');
		uGrainChromaLoc = gl.getUniformLocation(mainProgram, 'uGrainChroma');

		// Get blur program uniforms
		gl.useProgram(blurProgram);
		blurTextureLoc = gl.getUniformLocation(blurProgram, 'uTexture');
		blurResolutionLoc = gl.getUniformLocation(blurProgram, 'uResolution');
		blurDirectionLoc = gl.getUniformLocation(blurProgram, 'uDirection');
		blurAmountLoc = gl.getUniformLocation(blurProgram, 'uBlurAmount');

		// Get final program uniforms
		gl.useProgram(finalProgram);
		finalTextureLoc = gl.getUniformLocation(finalProgram, 'uTexture');
		finalResolutionLoc = gl.getUniformLocation(finalProgram, 'uResolution');
		finalTimeLoc = gl.getUniformLocation(finalProgram, 'uTime');
		finalSpeckleIntensityLoc = gl.getUniformLocation(finalProgram, 'uSpeckleIntensity');
		finalSpeckleSizeLoc = gl.getUniformLocation(finalProgram, 'uSpeckleSize');
		finalSpeckleDensityLoc = gl.getUniformLocation(finalProgram, 'uSpeckleDensity');
		finalSpeckleSpeedLoc = gl.getUniformLocation(finalProgram, 'uSpeckleSpeed');

		return true;
	}

	function loadTexture(src) {
		sourceTexture = gl.createTexture();
		const image = new Image();

		image.onload = () => {
			gl.bindTexture(gl.TEXTURE_2D, sourceTexture);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
			textureLoaded = true;
			currentImageSrc = src;
		};

		image.src = src;
	}

	$: if (gl && imageSrc !== currentImageSrc) {
		textureLoaded = false;
		loadTexture(imageSrc);
	}

	function handleResize() {
		if (!canvas || !gl) return;

		const target = container || canvas.parentElement;
		if (!target) return;

		const rect = target.getBoundingClientRect();
		canvas.width = rect.width;
		canvas.height = rect.height;

		resizeFramebuffers(canvas.width, canvas.height);
	}

	function handleMouseMove(e) {
		if (!canvas) return;

		const rect = canvas.getBoundingClientRect();
		const centerX = rect.left + rect.width / 2;
		const centerY = rect.top + rect.height / 2;

		const dx = e.clientX - centerX;
		const dy = e.clientY - centerY;

		const length = Math.sqrt(dx * dx + dy * dy);

		if (length > 1) {
			panDirection.x = dx / length;
			panDirection.y = dy / length;
		}
	}

	function handleTouchMove(e) {
		if (e.touches.length > 0) {
			const touch = e.touches[0];
			handleMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
		}
	}

	function setupProgram(prog) {
		gl.useProgram(prog);
		gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
		const aPositionLoc = gl.getAttribLocation(prog, 'aPosition');
		gl.enableVertexAttribArray(aPositionLoc);
		gl.vertexAttribPointer(aPositionLoc, 2, gl.FLOAT, false, 0, 0);
	}

	function render(timestamp) {
		if (!textureLoaded || !gl) {
			animationId = requestAnimationFrame(render);
			return;
		}

		// Performance tracking
		const renderStart = performance.now();

		// Calculate frame delta in seconds for time-based animation
		const frameDeltaMs = lastTimestamp > 0 ? timestamp - lastTimestamp : 16.67;
		const deltaTime = Math.min(frameDeltaMs / 1000, 0.1); // Cap at 100ms to prevent jumps
		lastTimestamp = timestamp;

		// Log slow frames (>50ms = <20fps)
		if (frameDeltaMs > 50) {
			slowFrameCount++;
			console.warn(`[BG] SLOW FRAME #${slowFrameCount}: ${frameDeltaMs.toFixed(1)}ms gap`);
		}

		const time = ((timestamp - startTime) / 1000) % 628;

		// Calculate speedMod (oscillates between 0.333 and 1.0 over 8-second cycles)
		const speedMod = 0.333 + (1.0 - 0.333) * (0.5 + 0.5 * Math.sin(time * Math.PI / 4.0));

		// Accumulate animation time properly
		accumulatedAnimTime += deltaTime * speedMod;

		// Time-based pan movement (frame-rate independent)
		// panSpeed is now units per second, not per frame
		// Multiply by 60 to maintain similar visual speed (assuming original was ~60fps)
		panOffset.x += panDirection.x * params.panSpeed * deltaTime * 60;
		panOffset.y += panDirection.y * params.panSpeed * deltaTime * 60;
		panOffset.x = ((panOffset.x % 4) + 4) % 4;
		panOffset.y = ((panOffset.y % 4) + 4) % 4;

		const width = canvas.width;
		const height = canvas.height;

		// PASS 1: Render main effect to framebuffer
		gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
		gl.viewport(0, 0, width, height);

		setupProgram(mainProgram);

		// Bind source texture (background image)
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, sourceTexture);
		gl.uniform1i(uTextureLoc, 0);

		gl.uniform1f(uTimeLoc, time);
		gl.uniform1f(uAnimTimeLoc, accumulatedAnimTime);
		gl.uniform2f(uOffsetLoc, panOffset.x, panOffset.y);
		gl.uniform2f(uResolutionLoc, width, height);
		gl.uniform1f(uRotationSpeedLoc, params.rotationSpeed);
		gl.uniform1f(uTimeScaleLoc, params.timeScale);
		gl.uniform1f(uBlobStrengthLoc, params.blobStrength);
		gl.uniform2f(uBlobFreqLoc, params.blobFreqX, params.blobFreqY);
		gl.uniform1f(uSwirlStrengthLoc, params.swirlStrength);
		gl.uniform1f(uSwirlFalloffLoc, params.swirlFalloff);
		gl.uniform1f(uSwirlFreqLoc, params.swirlFreq);
		gl.uniform1f(uSwirlSpeedLoc, params.swirlSpeed);
		gl.uniform1f(uFlowStrengthLoc, params.flowStrength);
		gl.uniform1f(uFlowFreqLoc, params.flowFreq);
		gl.uniform1f(uRippleStrengthLoc, params.rippleStrength);
		gl.uniform1f(uRippleFreqLoc, params.rippleFreq);
		gl.uniform1f(uBreatheAmountLoc, params.breatheAmount);
		gl.uniform1f(uBreatheSpeedLoc, params.breatheSpeed);
		gl.uniform1f(uBaseScaleLoc, params.baseScale);
		gl.uniform1f(uSaturationLoc, params.saturation);
		gl.uniform1f(uContrastLoc, params.contrast);
		gl.uniform1f(uGrainIntensityLoc, params.grainIntensity);
		gl.uniform1f(uGrainSizeLoc, params.grainSize);
		gl.uniform1f(uGrainSpeedLoc, params.grainSpeed);
		gl.uniform1f(uGrainChromaLoc, params.grainChroma);

		gl.drawArrays(gl.TRIANGLES, 0, 6);

		// PASS 2: Horizontal blur
		gl.bindFramebuffer(gl.FRAMEBUFFER, blurFramebuffer);
		setupProgram(blurProgram);

		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, framebufferTexture);
		gl.uniform1i(blurTextureLoc, 0);
		gl.uniform2f(blurResolutionLoc, width, height);
		gl.uniform2f(blurDirectionLoc, 1.0, 0.0);
		gl.uniform1f(blurAmountLoc, params.blur);

		gl.drawArrays(gl.TRIANGLES, 0, 6);

		// PASS 3: Vertical blur
		gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
		gl.bindTexture(gl.TEXTURE_2D, blurFramebufferTexture);
		gl.uniform2f(blurDirectionLoc, 0.0, 1.0);

		gl.drawArrays(gl.TRIANGLES, 0, 6);

		// PASS 4: Final composite with speckles (to screen)
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.viewport(0, 0, width, height);

		setupProgram(finalProgram);

		gl.bindTexture(gl.TEXTURE_2D, framebufferTexture);
		gl.uniform1i(finalTextureLoc, 0);
		gl.uniform2f(finalResolutionLoc, width, height);
		gl.uniform1f(finalTimeLoc, time);
		gl.uniform1f(finalSpeckleIntensityLoc, params.speckleIntensity);
		gl.uniform1f(finalSpeckleSizeLoc, params.speckleSize);
		gl.uniform1f(finalSpeckleDensityLoc, params.speckleDensity);
		gl.uniform1f(finalSpeckleSpeedLoc, params.speckleSpeed);

		gl.drawArrays(gl.TRIANGLES, 0, 6);

		// Log render time if slow
		const renderTime = performance.now() - renderStart;
		if (renderTime > 16) {
			console.warn(`[BG] Render took ${renderTime.toFixed(1)}ms`);
		}

		animationId = requestAnimationFrame(render);
	}

	onMount(async () => {
		mounted = true;
		await tick();

		if (!initWebGL()) {
			console.error('Failed to initialize WebGL');
			return;
		}

		loadTexture(imageSrc);
		handleResize();

		startTime = performance.now();
		animationId = requestAnimationFrame(render);

		window.addEventListener('resize', handleResize);
		window.addEventListener('mousemove', handleMouseMove);
		window.addEventListener('touchmove', handleTouchMove, { passive: true });
	});

	onDestroy(() => {
		if (!browser) return;

		if (animationId) {
			cancelAnimationFrame(animationId);
		}
		window.removeEventListener('resize', handleResize);
		window.removeEventListener('mousemove', handleMouseMove);
		window.removeEventListener('touchmove', handleTouchMove);
	});
</script>

{#if mounted}
	<canvas bind:this={canvas} class="background-shader"></canvas>
{/if}

<style>
	.background-shader {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		z-index: 0;
		pointer-events: none;
		border-radius: inherit;
	}
</style>

<script>
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import { browser } from '$app/environment';
	import * as THREE from 'three';
	import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
	import { Line2 } from 'three/addons/lines/Line2.js';
	import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
	import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
	import { EffectComposer, RenderPass, EffectPass, BloomEffect, BlendFunction } from 'postprocessing';
	import { CrtAsciiEffect } from '$lib/shaders/CrtAsciiEffect.js';
	import { ChromaticGlitchEffect } from '$lib/shaders/ChromaticGlitchEffect.js';

	const dispatch = createEventDispatcher();

	// Effect parameters - passed from parent (no default to avoid creating separate object)
	export let effectParams;

	// Interaction state
	let isActivated = false;
	let activatedSpinSpeed = 0;
	let isDragging = false;
	let dragStartX = 0;
	let dragStartY = 0;
	let dragVelocityX = 0;
	let lastDragX = 0;
	let lastDragTime = 0;
	let hasTriggeredRsvp = false;

	// Activation parameters
	const ACTIVATED_SPIN_SPEED = 2.0; // Fast spin when activated
	const SPIN_DECAY = 0.97; // How quickly spin decays back to normal
	const DRAG_SENSITIVITY = 0.01; // How much drag affects spin
	const MIN_DRAG_DISTANCE = 20; // Minimum pixels to count as a drag vs click

	// Current rotation angle (tracked incrementally for smooth interaction)
	let currentRotationY = 0;

	// Disco ball color - matching reference red/coral
	const DISCO_COLOR = 0xe05050;
	const SPARKLE_COLOR = 0xe05050;
	const LINE_WIDTH = 3; // Adjustable line thickness

	let canvas;
	let mounted = false;
	let renderer;
	let scene;
	let camera;
	let composer;
	let discoBallModel;
	let decorations = [];
	let animationId;
	let lineMaterials = []; // Track LineMaterials for resolution/width updates
	let shadowMaterials = []; // Track shadow shader materials for uniform updates

	// Effect references
	let crtAsciiEffect = null;
	let chromaticGlitchEffect = null;
	let bloomEffect = null;
	let asciiPass = null;
	let glitchPass = null;
	let currentEffectMode = null;

	// Clipping plane to hide back half of disco ball and rings
	const clippingPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

	// Interaction handlers
	function handlePointerDown(e) {
		const clientX = e.touches ? e.touches[0].clientX : e.clientX;
		const clientY = e.touches ? e.touches[0].clientY : e.clientY;

		isDragging = true;
		dragStartX = clientX;
		dragStartY = clientY;
		lastDragX = clientX;
		lastDragTime = performance.now();
		dragVelocityX = 0;
		hasTriggeredRsvp = false;
	}

	function handlePointerMove(e) {
		if (!isDragging) return;

		const clientX = e.touches ? e.touches[0].clientX : e.clientX;
		const now = performance.now();
		const dt = now - lastDragTime;

		if (dt > 0) {
			// Calculate velocity (pixels per ms, then scale up)
			const dx = clientX - lastDragX;
			dragVelocityX = (dx / dt) * 16; // Normalize to ~60fps

			// Apply drag velocity to spin
			activatedSpinSpeed += dx * DRAG_SENSITIVITY;
			isActivated = true;
		}

		lastDragX = clientX;
		lastDragTime = now;
	}

	function handlePointerUp(e) {
		if (!isDragging) return;

		const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
		const clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;

		const dragDistance = Math.sqrt(
			Math.pow(clientX - dragStartX, 2) +
			Math.pow(clientY - dragStartY, 2)
		);

		isDragging = false;

		// Determine if this was a click or a drag
		if (dragDistance < MIN_DRAG_DISTANCE) {
			// Click - activate fast spin
			activatedSpinSpeed = ACTIVATED_SPIN_SPEED;
			isActivated = true;
		} else {
			// Drag - add momentum from final velocity
			activatedSpinSpeed += dragVelocityX * DRAG_SENSITIVITY * 5;
			isActivated = true;
		}

		// Trigger RSVP modal
		if (!hasTriggeredRsvp) {
			hasTriggeredRsvp = true;
			dispatch('activated');
		}
	}

	function handlePointerLeave() {
		if (isDragging) {
			isDragging = false;
			// Still trigger if we were dragging
			if (isActivated && !hasTriggeredRsvp) {
				hasTriggeredRsvp = true;
				dispatch('activated');
			}
		}
	}

	function initThree() {
		scene = new THREE.Scene();
		scene.background = null; // Transparent

		// Orthographic camera for flat poster look
		const aspect = canvas.width / canvas.height;
		const frustumSize = 3;
		camera = new THREE.OrthographicCamera(
			-frustumSize * aspect / 2,
			frustumSize * aspect / 2,
			frustumSize / 2,
			-frustumSize / 2,
			0.1,
			100
		);
		camera.position.z = 5;

		// Renderer
		renderer = new THREE.WebGLRenderer({
			canvas,
			alpha: true,
			antialias: true,
			powerPreference: 'high-performance'
		});
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.outputColorSpace = THREE.SRGBColorSpace;
		renderer.toneMapping = THREE.ACESFilmicToneMapping;
		renderer.toneMappingExposure = 1.2;
		renderer.localClippingEnabled = true;
		renderer.setClearColor(0x000000, 0); // Transparent background
		renderer.autoClearAlpha = true;

		// Lighting
		const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
		scene.add(ambientLight);

		const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
		directionalLight.position.set(2, 3, 5);
		scene.add(directionalLight);

		const rimLight = new THREE.DirectionalLight(0xff6666, 0.6);
		rimLight.position.set(-2, -1, 3);
		scene.add(rimLight);

		// Post-processing setup with alpha support
		// HalfFloatType better preserves alpha channel during processing
		composer = new EffectComposer(renderer, {
			frameBufferType: THREE.HalfFloatType
		});
		const renderPass = new RenderPass(scene, camera);
		renderPass.clearAlpha = 0;
		composer.addPass(renderPass);

		// Bloom FIRST - applied to raw render for glow effect around disco ball
		// Use ADD blend mode to preserve transparency (only adds glow, doesn't fill transparent areas)
		bloomEffect = new BloomEffect({
			blendFunction: BlendFunction.ADD,
			intensity: effectParams.bloomIntensity ?? 2,
			luminanceThreshold: effectParams.bloomThreshold ?? 0.1,
			luminanceSmoothing: 0.3,
			mipmapBlur: true,
			radius: 0.85
		});
		const bloomPass = new EffectPass(camera, bloomEffect);
		composer.addPass(bloomPass);

		// Create both effects
		crtAsciiEffect = new CrtAsciiEffect({
			cellSize: effectParams.cellSize,
			invert: effectParams.invert,
			colorMode: effectParams.colorMode,
			asciiStyle: effectParams.asciiStyle,
			scanlineIntensity: effectParams.scanlineIntensity,
			scanlineCount: effectParams.scanlineCount,
			curvature: effectParams.curvature,
			aberrationStrength: effectParams.aberrationStrength,
			vignetteIntensity: effectParams.vignetteIntensity,
			vignetteRadius: effectParams.vignetteRadius,
			noiseIntensity: effectParams.noiseIntensity,
			glitchIntensity: effectParams.glitchIntensity,
			glitchFrequency: effectParams.glitchFrequency,
			brightnessAdjust: effectParams.brightnessAdjust,
			contrastAdjust: effectParams.contrastAdjust,
			bloomMix: effectParams.bloomMix
		});

		chromaticGlitchEffect = new ChromaticGlitchEffect({
			aberrationAmount: effectParams.aberrationAmount ?? 0.005,
			aberrationAngle: effectParams.aberrationAngle ?? 0,
			aberrationAnimated: effectParams.aberrationAnimated ?? true,
			aberrationSpeed: effectParams.aberrationSpeed ?? 2,
			glitchIntensity: effectParams.cgGlitchIntensity ?? 0.1,
			glitchFrequency: effectParams.cgGlitchFrequency ?? 4,
			blockGlitchIntensity: effectParams.blockGlitchIntensity ?? 0.1,
			blockGlitchSize: effectParams.blockGlitchSize ?? 20,
			rgbShiftIntensity: effectParams.rgbShiftIntensity ?? 0.5,
			scanlineIntensity: effectParams.cgScanlineIntensity ?? 0.1,
			scanlineCount: effectParams.cgScanlineCount ?? 200,
			scanlineSpeed: effectParams.scanlineSpeed ?? 0,
			waveDistortion: effectParams.waveDistortion ?? 0,
			waveFrequency: effectParams.waveFrequency ?? 10,
			waveSpeed: effectParams.waveSpeed ?? 1,
			saturation: effectParams.cgSaturation ?? 1,
			brightness: effectParams.cgBrightness ?? 0,
			contrast: effectParams.cgContrast ?? 1,
			vignetteIntensity: effectParams.cgVignetteIntensity ?? 0.2,
			vignetteRadius: effectParams.cgVignetteRadius ?? 1.2,
			noiseIntensity: effectParams.cgNoiseIntensity ?? 0.02,
			noiseSpeed: effectParams.cgNoiseSpeed ?? 10
		});

		// Create passes for both effects
		asciiPass = new EffectPass(camera, crtAsciiEffect);
		glitchPass = new EffectPass(camera, chromaticGlitchEffect);

		// Add the appropriate pass based on effect mode
		const effectMode = effectParams.effectMode ?? 'ascii';
		if (effectMode === 'glitch') {
			composer.addPass(glitchPass);
		} else {
			composer.addPass(asciiPass);
		}
		currentEffectMode = effectMode;

		return true;
	}

	function loadDiscoBall() {
		const loader = new GLTFLoader();

		loader.load(
			'/discoball.glb',
			(gltf) => {
				discoBallModel = gltf.scene;

				// Edge rendering with fading + tile shadows for depth
				const edgesToAdd = [];
				discoBallModel.traverse((child) => {
					if (child.isMesh) {
						// TILE SHADOWS: Apply directional shading material
						// Create custom shader material for directional shadow effect
						const shadowMaterial = new THREE.ShaderMaterial({
							uniforms: {
								uColor: { value: new THREE.Color(DISCO_COLOR) },
								uShadowStrength: { value: 0.45 },
								uHighlightStrength: { value: 0.8 },
								uLightX: { value: 0.5 },
								uLightY: { value: 0.5 },
								uBaseOpacity: { value: 0.0 }
							},
							vertexShader: `
								varying vec3 vNormal;
								varying vec3 vPosition;
								void main() {
									vNormal = normalize(normalMatrix * normal);
									vPosition = position;
									gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
								}
							`,
							fragmentShader: `
								uniform vec3 uColor;
								uniform float uShadowStrength;
								uniform float uHighlightStrength;
								uniform float uLightX;
								uniform float uLightY;
								uniform float uBaseOpacity;
								varying vec3 vNormal;
								varying vec3 vPosition;
								void main() {
									// Shadow: opposite of light direction
									float shadowDist = length(vec2(vPosition.x + uLightX, vPosition.y + uLightY));
									float shadow = (1.0 - smoothstep(0.0, 1.5, shadowDist)) * uShadowStrength;

									// Highlight: aligned with light direction
									float highlightDist = length(vec2(vPosition.x - uLightX, vPosition.y - uLightY));
									float highlight = (1.0 - smoothstep(0.0, 1.5, highlightDist)) * uHighlightStrength;

									// Combine: shadow adds opacity, highlight removes it
									float alpha = uBaseOpacity + shadow - highlight;
									alpha = clamp(alpha, 0.0, 1.0);

									gl_FragColor = vec4(uColor, alpha);
								}
							`,
							transparent: true,
							side: THREE.FrontSide,
							clippingPlanes: [clippingPlane],
							clipIntersection: false
						});
						child.material = shadowMaterial;
						child.visible = true;
						shadowMaterials.push(shadowMaterial);

						// LINE FADING: Create edges with LineMaterial + custom fade injection
						const edges = new THREE.EdgesGeometry(child.geometry, 1);
						const positions = edges.attributes.position.array;

						const lineGeometry = new LineSegmentsGeometry();
						lineGeometry.setPositions(positions);

						// Create LineMaterial with shader injection for position-based alpha fading
						const lineMaterial = new LineMaterial({
							color: DISCO_COLOR,
							linewidth: effectParams.lineWidth ?? 3,
							clippingPlanes: [clippingPlane],
							clipIntersection: false,
							resolution: new THREE.Vector2(canvas.width, canvas.height),
							transparent: true,
							opacity: 1.0,
							alphaToCoverage: false
						});

						// Add custom uniforms for fade control
						lineMaterial.uniforms.lineFadeStart = { value: effectParams.lineFadeStart ?? 0.75 };
						lineMaterial.uniforms.lineFadeEnd = { value: effectParams.lineFadeEnd ?? 1.1 };
						lineMaterial.uniforms.lightX = { value: effectParams.lightX ?? 0.5 };
						lineMaterial.uniforms.lightY = { value: effectParams.lightY ?? 0.5 };

						// Inject custom fade logic into the shader
						lineMaterial.onBeforeCompile = (shader) => {
							// Add our custom uniforms
							shader.uniforms.lineFadeStart = lineMaterial.uniforms.lineFadeStart;
							shader.uniforms.lineFadeEnd = lineMaterial.uniforms.lineFadeEnd;
							shader.uniforms.lightX = lineMaterial.uniforms.lightX;
							shader.uniforms.lightY = lineMaterial.uniforms.lightY;

							// Add varying for world position to vertex shader
							shader.vertexShader = shader.vertexShader.replace(
								'void main() {',
								`varying vec3 vWorldPos;
								void main() {`
							);
							// Calculate and pass world position
							shader.vertexShader = shader.vertexShader.replace(
								'#include <fog_vertex>',
								`#include <fog_vertex>
								vec3 worldStart = (modelMatrix * vec4(instanceStart, 1.0)).xyz;
								vec3 worldEnd = (modelMatrix * vec4(instanceEnd, 1.0)).xyz;
								vWorldPos = ( position.y < 0.5 ) ? worldStart : worldEnd;`
							);

							// Add uniforms and varying to fragment shader
							shader.fragmentShader = shader.fragmentShader.replace(
								'void main() {',
								`uniform float lineFadeStart;
								uniform float lineFadeEnd;
								uniform float lightX;
								uniform float lightY;
								varying vec3 vWorldPos;
								void main() {`
							);
							// Apply position-based alpha fade along light direction
							shader.fragmentShader = shader.fragmentShader.replace(
								'gl_FragColor = vec4( diffuseColor.rgb, alpha );',
								`// Position-based fading along light direction
								vec2 lightDir = normalize(vec2(lightX, lightY));
								float projPos = dot(vec2(vWorldPos.x, vWorldPos.y), lightDir);
								float fadeFactor = 1.0;
								if (projPos > lineFadeStart) {
									fadeFactor = 1.0 - clamp((projPos - lineFadeStart) / (lineFadeEnd - lineFadeStart), 0.0, 1.0);
								} else if (projPos < -lineFadeStart) {
									fadeFactor = clamp((projPos + lineFadeEnd) / (lineFadeEnd - lineFadeStart), 0.0, 1.0);
								}
								gl_FragColor = vec4( diffuseColor.rgb, alpha * fadeFactor );`
							);
						};
						lineMaterials.push(lineMaterial);

						const edgeLines = new Line2(lineGeometry, lineMaterial);
						edgeLines.computeLineDistances();
						edgeLines.position.copy(child.position);
						edgeLines.rotation.copy(child.rotation);
						edgeLines.scale.copy(child.scale);
						edgesToAdd.push(edgeLines);
					}
				});
				// Add edges after traversal to avoid modifying during iteration
				edgesToAdd.forEach(edge => discoBallModel.add(edge));

				discoBallModel.scale.setScalar(1.2);
				discoBallModel.position.set(0, 0, 0);
				scene.add(discoBallModel);

				addDecorations();
			},
			undefined,
			(error) => {
				console.error('Error loading disco ball:', error);
				createFallbackBall();
			}
		);
	}

	function createFallbackBall() {
		const geometry = new THREE.IcosahedronGeometry(0.8, 2);

		// Create group to hold both mesh and lines
		discoBallModel = new THREE.Group();

		// Add shaded mesh for tile shadows
		const shadowMaterial = new THREE.ShaderMaterial({
			uniforms: {
				uColor: { value: new THREE.Color(DISCO_COLOR) },
				uShadowStrength: { value: 0.45 },
				uHighlightStrength: { value: 0.8 },
				uLightX: { value: 0.5 },
				uLightY: { value: 0.5 },
				uBaseOpacity: { value: 0.0 }
			},
			vertexShader: `
				varying vec3 vNormal;
				varying vec3 vPosition;
				void main() {
					vNormal = normalize(normalMatrix * normal);
					vPosition = position;
					gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
				}
			`,
			fragmentShader: `
				uniform vec3 uColor;
				uniform float uShadowStrength;
				uniform float uHighlightStrength;
				uniform float uLightX;
				uniform float uLightY;
				uniform float uBaseOpacity;
				varying vec3 vNormal;
				varying vec3 vPosition;
				void main() {
					float shadowDist = length(vec2(vPosition.x + uLightX, vPosition.y + uLightY));
					float shadow = (1.0 - smoothstep(0.0, 1.5, shadowDist)) * uShadowStrength;
					float highlightDist = length(vec2(vPosition.x - uLightX, vPosition.y - uLightY));
					float highlight = (1.0 - smoothstep(0.0, 1.5, highlightDist)) * uHighlightStrength;
					float alpha = clamp(uBaseOpacity + shadow - highlight, 0.0, 1.0);
					gl_FragColor = vec4(uColor, alpha);
				}
			`,
			transparent: true,
			side: THREE.FrontSide
		});
		shadowMaterials.push(shadowMaterial);
		const mesh = new THREE.Mesh(geometry, shadowMaterial);
		discoBallModel.add(mesh);

		// Edge rendering with fading using LineMaterial + custom fade injection
		const edges = new THREE.EdgesGeometry(geometry, 15);
		const positions = edges.attributes.position.array;

		const lineGeometry = new LineSegmentsGeometry();
		lineGeometry.setPositions(positions);

		const lineMaterial = new LineMaterial({
			color: DISCO_COLOR,
			linewidth: effectParams.lineWidth ?? 3,
			resolution: new THREE.Vector2(canvas.width, canvas.height),
			transparent: true,
			opacity: 1.0
		});

		// Add custom uniforms for fade control
		lineMaterial.uniforms.lineFadeStart = { value: effectParams.lineFadeStart ?? 0.75 };
		lineMaterial.uniforms.lineFadeEnd = { value: effectParams.lineFadeEnd ?? 1.1 };
		lineMaterial.uniforms.lightX = { value: effectParams.lightX ?? 0.5 };
		lineMaterial.uniforms.lightY = { value: effectParams.lightY ?? 0.5 };

		// Inject custom fade logic into the shader
		lineMaterial.onBeforeCompile = (shader) => {
			shader.uniforms.lineFadeStart = lineMaterial.uniforms.lineFadeStart;
			shader.uniforms.lineFadeEnd = lineMaterial.uniforms.lineFadeEnd;
			shader.uniforms.lightX = lineMaterial.uniforms.lightX;
			shader.uniforms.lightY = lineMaterial.uniforms.lightY;

			shader.vertexShader = shader.vertexShader.replace(
				'void main() {',
				`varying vec3 vWorldPos;
				void main() {`
			);
			shader.vertexShader = shader.vertexShader.replace(
				'#include <fog_vertex>',
				`#include <fog_vertex>
				vec3 worldStart = (modelMatrix * vec4(instanceStart, 1.0)).xyz;
				vec3 worldEnd = (modelMatrix * vec4(instanceEnd, 1.0)).xyz;
				vWorldPos = ( position.y < 0.5 ) ? worldStart : worldEnd;`
			);

			shader.fragmentShader = shader.fragmentShader.replace(
				'void main() {',
				`uniform float lineFadeStart;
				uniform float lineFadeEnd;
				uniform float lightX;
				uniform float lightY;
				varying vec3 vWorldPos;
				void main() {`
			);
			shader.fragmentShader = shader.fragmentShader.replace(
				'gl_FragColor = vec4( diffuseColor.rgb, alpha );',
				`vec2 lightDir = normalize(vec2(lightX, lightY));
				float projPos = dot(vec2(vWorldPos.x, vWorldPos.y), lightDir);
				float fadeFactor = 1.0;
				if (projPos > lineFadeStart) {
					fadeFactor = 1.0 - clamp((projPos - lineFadeStart) / (lineFadeEnd - lineFadeStart), 0.0, 1.0);
				} else if (projPos < -lineFadeStart) {
					fadeFactor = clamp((projPos + lineFadeEnd) / (lineFadeEnd - lineFadeStart), 0.0, 1.0);
				}
				gl_FragColor = vec4( diffuseColor.rgb, alpha * fadeFactor );`
			);
		};
		lineMaterials.push(lineMaterial);

		const edgeLines = new Line2(lineGeometry, lineMaterial);
		edgeLines.computeLineDistances();
		discoBallModel.add(edgeLines);

		scene.add(discoBallModel);
		addDecorations();
	}

	function addDecorations() {
		// Ring around the ball (with clipping)
		const ringGeometry = new THREE.TorusGeometry(1.1, 0.02, 16, 100);
		const ringMaterial = new THREE.MeshBasicMaterial({
			color: DISCO_COLOR,
			clippingPlanes: [clippingPlane],
			clipIntersection: false
		});
		const ring = new THREE.Mesh(ringGeometry, ringMaterial);
		ring.rotation.x = Math.PI / 2;
		scene.add(ring);
		decorations.push(ring);

		// Second tilted ring
		const ring2Material = new THREE.MeshBasicMaterial({
			color: DISCO_COLOR,
			clippingPlanes: [clippingPlane],
			clipIntersection: false
		});
		const ring2 = new THREE.Mesh(ringGeometry, ring2Material);
		ring2.rotation.x = Math.PI / 2;
		ring2.rotation.z = Math.PI / 6;
		scene.add(ring2);
		decorations.push(ring2);

		// Sparkle stars
		const sparkleTexture = createSparkleTexture();
		const sparklePositions = [
			{ x: 1.3, y: 0.8, scale: 0.15 },
			{ x: 1.5, y: 0.5, scale: 0.1 },
			{ x: -1.3, y: 0.9, scale: 0.12 },
			{ x: -1.4, y: -0.6, scale: 0.08 },
			{ x: 1.2, y: -0.7, scale: 0.1 },
			{ x: -1.1, y: 0.3, scale: 0.06 },
			{ x: 0.9, y: 1.1, scale: 0.08 }
		];

		sparklePositions.forEach(pos => {
			const sparkleMaterial = new THREE.SpriteMaterial({
				map: sparkleTexture,
				color: SPARKLE_COLOR,
				transparent: true,
				blending: THREE.AdditiveBlending
			});
			const sparkle = new THREE.Sprite(sparkleMaterial);
			sparkle.position.set(pos.x, pos.y, 0.1);
			sparkle.scale.setScalar(pos.scale);
			sparkle.userData.baseScale = pos.scale;
			sparkle.userData.phase = Math.random() * Math.PI * 2;
			scene.add(sparkle);
			decorations.push(sparkle);
		});

		// Wave decorations
		addWaveDecoration(0, 1.4, 1);
		addWaveDecoration(0, -1.4, -1);
	}

	function createSparkleTexture() {
		const offscreen = document.createElement('canvas');
		offscreen.width = 64;
		offscreen.height = 64;
		const ctx = offscreen.getContext('2d');

		ctx.fillStyle = 'white';
		ctx.beginPath();
		const cx = 32, cy = 32;
		const points = 4;
		const outerRadius = 30;
		const innerRadius = 8;

		for (let i = 0; i < points * 2; i++) {
			const radius = i % 2 === 0 ? outerRadius : innerRadius;
			const angle = (i * Math.PI) / points - Math.PI / 2;
			const x = cx + Math.cos(angle) * radius;
			const y = cy + Math.sin(angle) * radius;
			if (i === 0) ctx.moveTo(x, y);
			else ctx.lineTo(x, y);
		}
		ctx.closePath();
		ctx.fill();

		const texture = new THREE.CanvasTexture(offscreen);
		texture.needsUpdate = true;
		return texture;
	}

	function addWaveDecoration(x, y, direction) {
		const points = [];
		const segments = 40;
		const width = 1.8;
		const amplitude = 0.12;
		const frequency = 4;

		for (let i = 0; i <= segments; i++) {
			const t = (i / segments) - 0.5;
			const px = x + t * width;
			const py = y + Math.sin(t * Math.PI * frequency) * amplitude * direction;
			points.push(new THREE.Vector3(px, py, 0));
		}

		const geometry = new THREE.BufferGeometry().setFromPoints(points);
		const material = new THREE.LineBasicMaterial({ color: DISCO_COLOR, linewidth: 2 });
		const wave = new THREE.Line(geometry, material);
		scene.add(wave);
		decorations.push(wave);
	}

	function handleResize() {
		if (!canvas || !renderer || !camera) return;

		const parent = canvas.parentElement;
		if (!parent) return;

		// Use offsetWidth/Height to get pre-transform CSS dimensions
		// (getBoundingClientRect returns post-transform scaled dimensions)
		const width = parent.offsetWidth;
		const height = parent.offsetHeight;

		canvas.width = width;
		canvas.height = height;

		renderer.setSize(width, height);
		composer.setSize(width, height);

		if (crtAsciiEffect) {
			crtAsciiEffect.setSize(width, height);
		}
		if (chromaticGlitchEffect) {
			chromaticGlitchEffect.setSize(width, height);
		}

		// Update LineMaterial resolutions (required for proper line width)
		lineMaterials.forEach(mat => {
			mat.resolution.set(width, height);
		});

		// Update orthographic camera
		const aspect = width / height;
		const frustumSize = 3;
		camera.left = -frustumSize * aspect / 2;
		camera.right = frustumSize * aspect / 2;
		camera.top = frustumSize / 2;
		camera.bottom = -frustumSize / 2;
		camera.updateProjectionMatrix();
	}

	let lastTimestamp = 0;
	let slowFrameCount = 0;

	function animate(timestamp) {
		if (!renderer || !scene || !camera) return;

		// Performance tracking
		const renderStart = performance.now();

		// Calculate delta time for frame-rate independent animation
		const deltaMs = lastTimestamp > 0 ? timestamp - lastTimestamp : 16.67;
		const deltaTime = Math.min(deltaMs / 1000, 0.1); // Cap at 100ms
		lastTimestamp = timestamp;

		// Log slow frames (>50ms = <20fps)
		if (deltaMs > 50) {
			slowFrameCount++;
			console.warn(`[DISCO] SLOW FRAME #${slowFrameCount}: ${deltaMs.toFixed(1)}ms gap`);
		}

		const time = timestamp * 0.001;

		// Transform and rotate disco ball
		if (discoBallModel) {
			discoBallModel.position.set(effectParams.positionX || 0, effectParams.positionY || 0, 0);
			discoBallModel.scale.setScalar(effectParams.scale || 1.2);
			const baseSpinSpeed = effectParams.spinSpeed ?? 0.1;
			const tilt = effectParams.tilt ?? 0.3;
			discoBallModel.rotation.x = tilt;

			// Apply base rotation
			currentRotationY += baseSpinSpeed * deltaTime;

			// Apply activated spin speed with decay
			if (isActivated) {
				currentRotationY += activatedSpinSpeed * deltaTime;

				// Decay the activated speed back toward zero
				activatedSpinSpeed *= SPIN_DECAY;

				// Stop activation when speed is negligible
				if (Math.abs(activatedSpinSpeed) < 0.01) {
					activatedSpinSpeed = 0;
					isActivated = false;
				}
			}

			discoBallModel.rotation.y = currentRotationY;
		}

		// Animate sparkles
		decorations.forEach(dec => {
			if (dec.isSprite && dec.userData.baseScale) {
				const twinkle = 1 + Math.sin(time * 3 + dec.userData.phase) * 0.3;
				dec.scale.setScalar(dec.userData.baseScale * twinkle);
			}
		});

		// Animate rings with tilt and size
		const ringTilt = effectParams.ringTilt ?? 0.5;
		const ringTilt2 = effectParams.ringTilt2 ?? 0.3;
		const ringSize = effectParams.ringSize ?? 1.1;
		const ringRotationSpeed = 0.12; // radians per second (0.002 * 60fps = 0.12)
		decorations.forEach((dec, i) => {
			if (dec.geometry && dec.geometry.type === 'TorusGeometry') {
				dec.rotation.x = Math.PI / 2 + ringTilt;
				dec.rotation.y = ringTilt2;
				dec.rotation.z += ringRotationSpeed * deltaTime * (i % 2 === 0 ? 1 : -1);
				dec.scale.setScalar(ringSize);
			}
		});

		// Handle effect mode switching
		const effectMode = effectParams.effectMode ?? 'ascii';
		if (effectMode !== currentEffectMode && composer) {
			// Remove current effect pass and add the new one
			if (currentEffectMode === 'ascii' && asciiPass) {
				composer.removePass(asciiPass);
			} else if (currentEffectMode === 'glitch' && glitchPass) {
				composer.removePass(glitchPass);
			}

			if (effectMode === 'glitch' && glitchPass) {
				composer.addPass(glitchPass);
			} else if (effectMode === 'ascii' && asciiPass) {
				composer.addPass(asciiPass);
			}
			currentEffectMode = effectMode;
		}

		// Update effect params every frame based on active effect
		if (effectMode === 'ascii' && crtAsciiEffect) {
			crtAsciiEffect.cellSize = effectParams.cellSize;
			crtAsciiEffect.invert = effectParams.invert;
			crtAsciiEffect.colorMode = effectParams.colorMode;
			crtAsciiEffect.asciiStyle = effectParams.asciiStyle;
			crtAsciiEffect.scanlineIntensity = effectParams.scanlineIntensity;
			crtAsciiEffect.scanlineCount = effectParams.scanlineCount;
			crtAsciiEffect.curvature = effectParams.curvature;
			crtAsciiEffect.aberrationStrength = effectParams.aberrationStrength;
			crtAsciiEffect.vignetteIntensity = effectParams.vignetteIntensity;
			crtAsciiEffect.vignetteRadius = effectParams.vignetteRadius;
			crtAsciiEffect.noiseIntensity = effectParams.noiseIntensity;
			crtAsciiEffect.glitchIntensity = effectParams.glitchIntensity;
			crtAsciiEffect.glitchFrequency = effectParams.glitchFrequency;
			crtAsciiEffect.brightnessAdjust = effectParams.brightnessAdjust;
			crtAsciiEffect.contrastAdjust = effectParams.contrastAdjust;
			crtAsciiEffect.bloomMix = effectParams.bloomMix;
		} else if (effectMode === 'glitch' && chromaticGlitchEffect) {
			chromaticGlitchEffect.aberrationAmount = effectParams.aberrationAmount ?? 0.005;
			chromaticGlitchEffect.aberrationAngle = effectParams.aberrationAngle ?? 0;
			chromaticGlitchEffect.aberrationAnimated = effectParams.aberrationAnimated ?? true;
			chromaticGlitchEffect.aberrationSpeed = effectParams.aberrationSpeed ?? 2;
			chromaticGlitchEffect.glitchIntensity = effectParams.cgGlitchIntensity ?? 0.1;
			chromaticGlitchEffect.glitchFrequency = effectParams.cgGlitchFrequency ?? 4;
			chromaticGlitchEffect.blockGlitchIntensity = effectParams.blockGlitchIntensity ?? 0.1;
			chromaticGlitchEffect.blockGlitchSize = effectParams.blockGlitchSize ?? 20;
			chromaticGlitchEffect.rgbShiftIntensity = effectParams.rgbShiftIntensity ?? 0.5;
			chromaticGlitchEffect.scanlineIntensity = effectParams.cgScanlineIntensity ?? 0.1;
			chromaticGlitchEffect.scanlineCount = effectParams.cgScanlineCount ?? 200;
			chromaticGlitchEffect.scanlineSpeed = effectParams.scanlineSpeed ?? 0;
			chromaticGlitchEffect.waveDistortion = effectParams.waveDistortion ?? 0;
			chromaticGlitchEffect.waveFrequency = effectParams.waveFrequency ?? 10;
			chromaticGlitchEffect.waveSpeed = effectParams.waveSpeed ?? 1;
			chromaticGlitchEffect.saturation = effectParams.cgSaturation ?? 1;
			chromaticGlitchEffect.brightness = effectParams.cgBrightness ?? 0;
			chromaticGlitchEffect.contrast = effectParams.cgContrast ?? 1;
			chromaticGlitchEffect.vignetteIntensity = effectParams.cgVignetteIntensity ?? 0.2;
			chromaticGlitchEffect.vignetteRadius = effectParams.cgVignetteRadius ?? 1.2;
			chromaticGlitchEffect.noiseIntensity = effectParams.cgNoiseIntensity ?? 0.02;
			chromaticGlitchEffect.noiseSpeed = effectParams.cgNoiseSpeed ?? 10;
		}
		if (bloomEffect) {
			bloomEffect.intensity = effectParams.bloomIntensity ?? 2;
			bloomEffect.luminanceThreshold = effectParams.bloomThreshold ?? 0.1;
		}

		// Update shadow material uniforms
		const lightX = effectParams.lightX ?? 0.5;
		const lightY = effectParams.lightY ?? 0.5;
		shadowMaterials.forEach(mat => {
			if (mat.uniforms) {
				mat.uniforms.uShadowStrength.value = effectParams.shadowStrength ?? 0.45;
				mat.uniforms.uHighlightStrength.value = effectParams.highlightStrength ?? 0.8;
				mat.uniforms.uLightX.value = lightX;
				mat.uniforms.uLightY.value = lightY;
			}
		});

		// Update line materials (width, fade, and light direction uniforms)
		const lineWidth = effectParams.lineWidth ?? 3;
		const lineFadeStart = effectParams.lineFadeStart ?? 0.75;
		const lineFadeEnd = effectParams.lineFadeEnd ?? 1.1;
		lineMaterials.forEach(mat => {
			mat.linewidth = lineWidth;
			if (mat.uniforms.lineFadeStart) {
				mat.uniforms.lineFadeStart.value = lineFadeStart;
			}
			if (mat.uniforms.lineFadeEnd) {
				mat.uniforms.lineFadeEnd.value = lineFadeEnd;
			}
			if (mat.uniforms.lightX) {
				mat.uniforms.lightX.value = lightX;
			}
			if (mat.uniforms.lightY) {
				mat.uniforms.lightY.value = lightY;
			}
		});

		// Render
		composer.render();

		// Log render time if slow
		const renderTime = performance.now() - renderStart;
		if (renderTime > 16) {
			console.warn(`[DISCO] Render took ${renderTime.toFixed(1)}ms`);
		}

		animationId = requestAnimationFrame(animate);
	}

	onMount(async () => {
		if (!browser) return;
		mounted = true;

		await new Promise(r => setTimeout(r, 0));

		if (!initThree()) {
			console.error('Failed to initialize Three.js');
			return;
		}

		loadDiscoBall();
		handleResize();

		animationId = requestAnimationFrame(animate);
		window.addEventListener('resize', handleResize);
	});

	onDestroy(() => {
		if (!browser) return;

		if (animationId) {
			cancelAnimationFrame(animationId);
		}
		window.removeEventListener('resize', handleResize);

		if (renderer) renderer.dispose();
		if (composer) composer.dispose();
		decorations.forEach(dec => {
			if (dec.geometry) dec.geometry.dispose();
			if (dec.material) dec.material.dispose();
		});
		lineMaterials.forEach(mat => mat.dispose());
		lineMaterials = [];
		shadowMaterials.forEach(mat => mat.dispose());
		shadowMaterials = [];
	});
</script>

{#if mounted}
	<canvas
		bind:this={canvas}
		class="disco-ball-canvas"
		on:mousedown={handlePointerDown}
		on:mousemove={handlePointerMove}
		on:mouseup={handlePointerUp}
		on:mouseleave={handlePointerLeave}
		on:touchstart|preventDefault={handlePointerDown}
		on:touchmove|preventDefault={handlePointerMove}
		on:touchend|preventDefault={handlePointerUp}
		role="button"
		tabindex="0"
		aria-label="Spin the disco ball to RSVP"
	></canvas>
{/if}

<style>
	.disco-ball-canvas {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		display: block;
		cursor: grab;
		touch-action: none;
	}

	.disco-ball-canvas:active {
		cursor: grabbing;
	}
</style>

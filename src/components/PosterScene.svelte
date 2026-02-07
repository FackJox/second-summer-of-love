<script>
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import { browser } from '$app/environment';
	import * as THREE from 'three';
	import { Text } from 'troika-three-text';
	import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
	import { Line2 } from 'three/addons/lines/Line2.js';
	import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
	import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
	import { EffectComposer, RenderPass, EffectPass, BloomEffect, BlendFunction } from 'postprocessing';
	import { CrtAsciiEffect } from '$lib/shaders/CrtAsciiEffect.js';
	import { ChromaticGlitchEffect } from '$lib/shaders/ChromaticGlitchEffect.js';

	const dispatch = createEventDispatcher();

	export let effectParams;
	export let eventTime = '17:30PM';
	export let discoContainer = null;

	// Font URLs (TTF for troika-three-text)
	const HORIZON_FONT = '/fonts/horizon.c7c834b7fe209bdc0a30119a6b1d26ae.b3ebf62f8ff8ae950dea860d56c49d1b.ttf';
	const CONDENSED_FONT = '/fonts/scr-nsev-reg.039ecb79bbf7e9fd5981a06a01c.28e686f1a1e6846cf246683ff0cd3181.ttf';

	// Colors
	const ORANGE = '#e58632';
	const WHITE = '#ffffff';
	const DISCO_COLOR = 0xe05050;
	const SPARKLE_COLOR = 0xe05050;

	// Reference dimensions (matching poster)
	const REF_WIDTH = 1133;
	const REF_HEIGHT = 1600;

	// Disco group transform constants (maps 3-unit disco space into 1600-unit poster space)
	const DISCO_GROUP_Y = -215;
	const DISCO_GROUP_SCALE = 312;

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
	const ACTIVATED_SPIN_SPEED = 2.0;
	const SPIN_DECAY = 0.97;
	const DRAG_SENSITIVITY = 0.01;
	const MIN_DRAG_DISTANCE = 20;
	const RSVP_DELAY_MS = 1500;

	let currentRotationY = 0;

	let canvas;
	let mounted = false;
	let renderer;
	let scene;
	let camera;
	let composer;
	let animationId;

	// Disco ball objects
	let discoBallModel;
	let discoGroup; // Group positioned in 1600-unit space
	let decorations = [];
	let lineMaterials = [];
	let shadowMaterials = [];

	// Text objects
	let textObjects = [];

	// Effect references
	let crtAsciiEffect = null;
	let chromaticGlitchEffect = null;
	let bloomEffect = null;
	let asciiPass = null;
	let glitchPass = null;
	let currentEffectMode = null;

	let canvasHeight = 800;

	// Mobile detection
	const isMobile = browser && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

	// Clipping plane for disco ball (in local disco group space)
	const clippingPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

	// ===== INTERACTION HANDLERS =====
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
			const dx = clientX - lastDragX;
			dragVelocityX = (dx / dt) * 16;
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

		if (dragDistance < MIN_DRAG_DISTANCE) {
			activatedSpinSpeed = ACTIVATED_SPIN_SPEED;
			isActivated = true;
		} else {
			activatedSpinSpeed += dragVelocityX * DRAG_SENSITIVITY * 5;
			isActivated = true;
		}

		if (!hasTriggeredRsvp) {
			hasTriggeredRsvp = true;
			setTimeout(() => {
				dispatch('activated');
			}, RSVP_DELAY_MS);
		}
	}

	function handlePointerLeave() {
		if (isDragging) {
			isDragging = false;
			if (isActivated && !hasTriggeredRsvp) {
				hasTriggeredRsvp = true;
				setTimeout(() => {
					dispatch('activated');
				}, RSVP_DELAY_MS);
			}
		}
	}

	function attachInteractionHandlers(el) {
		if (!el) return;
		el.addEventListener('mousedown', handlePointerDown);
		el.addEventListener('mousemove', handlePointerMove);
		el.addEventListener('mouseup', handlePointerUp);
		el.addEventListener('mouseleave', handlePointerLeave);
		el.addEventListener('touchstart', handlePointerDown, { passive: false });
		el.addEventListener('touchmove', handlePointerMove, { passive: false });
		el.addEventListener('touchend', handlePointerUp, { passive: false });
	}

	function detachInteractionHandlers(el) {
		if (!el) return;
		el.removeEventListener('mousedown', handlePointerDown);
		el.removeEventListener('mousemove', handlePointerMove);
		el.removeEventListener('mouseup', handlePointerUp);
		el.removeEventListener('mouseleave', handlePointerLeave);
		el.removeEventListener('touchstart', handlePointerDown);
		el.removeEventListener('touchmove', handlePointerMove);
		el.removeEventListener('touchend', handlePointerUp);
	}

	// ===== TEXT CREATION =====
	function createTextMesh(text, options = {}) {
		const {
			font = HORIZON_FONT,
			fontSize = 43,
			color = ORANGE,
			y = 0,
			letterSpacing = 0.1,
			lineHeight = 1.0,
			anchorX = 'center',
			anchorY = 'middle',
			textAlign = 'center'
		} = options;

		const textMesh = new Text();
		textMesh.text = text;
		textMesh.font = font;
		textMesh.fontSize = fontSize;
		textMesh.color = color;
		textMesh.anchorX = anchorX;
		textMesh.anchorY = anchorY;
		textMesh.textAlign = textAlign;
		textMesh.letterSpacing = letterSpacing;
		textMesh.lineHeight = lineHeight;
		textMesh.position.y = y;
		textMesh.position.z = 0;

		// Disable tone mapping on text materials so colors render exactly
		textMesh.material.toneMapped = false;

		textMesh.sync();
		return textMesh;
	}

	function createTextElements() {
		textObjects.forEach(obj => {
			scene.remove(obj);
			obj.dispose();
		});
		textObjects = [];

		// Layout in 1600-unit coords (y=0 = center of poster)
		const nameY = 620;
		const name1 = createTextMesh('COBIE COPE', {
			font: HORIZON_FONT, fontSize: 43, color: ORANGE, y: nameY, letterSpacing: 0.12
		});
		scene.add(name1);
		textObjects.push(name1);

		const ampersand = createTextMesh('&', {
			font: CONDENSED_FONT, fontSize: 39, color: WHITE, y: nameY - 50
		});
		scene.add(ampersand);
		textObjects.push(ampersand);

		const name2 = createTextMesh('SOPHIE COPE', {
			font: HORIZON_FONT, fontSize: 43, color: ORANGE, y: nameY - 100, letterSpacing: 0.12
		});
		scene.add(name2);
		textObjects.push(name2);

		const subtitle = createTextMesh('INVITE YOU TO', {
			font: CONDENSED_FONT, fontSize: 26, color: WHITE, y: nameY - 200, letterSpacing: 0.12
		});
		scene.add(subtitle);
		textObjects.push(subtitle);

		const headlineY = nameY - 340;
		const headline1 = createTextMesh('THE SECOND', {
			font: HORIZON_FONT, fontSize: 87, color: ORANGE, y: headlineY, letterSpacing: 0.05
		});
		scene.add(headline1);
		textObjects.push(headline1);

		const headline2 = createTextMesh('SUMMER OF', {
			font: HORIZON_FONT, fontSize: 87, color: ORANGE, y: headlineY - 108, letterSpacing: 0.05
		});
		scene.add(headline2);
		textObjects.push(headline2);

		const headline3 = createTextMesh('LOVE', {
			font: HORIZON_FONT, fontSize: 89, color: ORANGE, y: headlineY - 216, letterSpacing: 0.05
		});
		scene.add(headline3);
		textObjects.push(headline3);

		// Event details
		const detailY = -420;
		const detailSpacing = 38;

		const detail1 = createTextMesh('SATURDAY 19 SEPTEMBER', {
			font: CONDENSED_FONT, fontSize: 26, color: WHITE, y: detailY, letterSpacing: 0.15
		});
		scene.add(detail1);
		textObjects.push(detail1);

		const detail2 = createTextMesh('FAITH IN STRANGERS', {
			font: CONDENSED_FONT, fontSize: 26, color: WHITE, y: detailY - detailSpacing, letterSpacing: 0.15
		});
		scene.add(detail2);
		textObjects.push(detail2);

		const detail3 = createTextMesh('MARGATE', {
			font: CONDENSED_FONT, fontSize: 26, color: WHITE, y: detailY - detailSpacing * 2, letterSpacing: 0.15
		});
		scene.add(detail3);
		textObjects.push(detail3);

		const detail4 = createTextMesh(eventTime, {
			font: CONDENSED_FONT, fontSize: 26, color: WHITE, y: detailY - detailSpacing * 3, letterSpacing: 0.15
		});
		scene.add(detail4);
		textObjects.push(detail4);

		// CTA Button text
		const cta = createTextMesh('SPIN THE GLOBE TO RSVP', {
			font: CONDENSED_FONT, fontSize: 29, color: WHITE, y: -620, letterSpacing: 0
		});
		scene.add(cta);
		textObjects.push(cta);
	}

	// ===== DISCO BALL =====
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

	function addDecorations() {
		// Ring around the ball
		const ringGeometry = new THREE.TorusGeometry(1.1, 0.02, 16, 100);
		const ringMaterial = new THREE.MeshBasicMaterial({
			color: DISCO_COLOR,
			clippingPlanes: [clippingPlane],
			clipIntersection: false,
			depthWrite: false
		});
		const ring = new THREE.Mesh(ringGeometry, ringMaterial);
		ring.rotation.x = Math.PI / 2;
		discoGroup.add(ring);
		decorations.push(ring);

		// Second tilted ring
		const ring2Material = new THREE.MeshBasicMaterial({
			color: DISCO_COLOR,
			clippingPlanes: [clippingPlane],
			clipIntersection: false,
			depthWrite: false
		});
		const ring2 = new THREE.Mesh(ringGeometry, ring2Material);
		ring2.rotation.x = Math.PI / 2;
		ring2.rotation.z = Math.PI / 6;
		discoGroup.add(ring2);
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
			discoGroup.add(sparkle);
			decorations.push(sparkle);
		});

		// Wave decorations
		addWaveDecoration(0, 1.4, 1);
		addWaveDecoration(0, -1.4, -1);
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
		const material = new THREE.LineBasicMaterial({ color: DISCO_COLOR, linewidth: 2, depthWrite: false });
		const wave = new THREE.Line(geometry, material);
		discoGroup.add(wave);
		decorations.push(wave);
	}

	function loadDiscoBall() {
		const loader = new GLTFLoader();

		loader.load(
			'/discoball.glb',
			(gltf) => {
				discoBallModel = gltf.scene;

				const edgesToAdd = [];
				discoBallModel.traverse((child) => {
					if (child.isMesh) {
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
							depthWrite: false,
							side: THREE.FrontSide,
							clippingPlanes: [clippingPlane],
							clipIntersection: false
						});
						child.material = shadowMaterial;
						child.visible = true;
						shadowMaterials.push(shadowMaterial);

						// Edge rendering with LineMaterial + custom fade
						const edges = new THREE.EdgesGeometry(child.geometry, 1);
						const positions = edges.attributes.position.array;

						const lineGeometry = new LineSegmentsGeometry();
						lineGeometry.setPositions(positions);

						const lineMaterial = new LineMaterial({
							color: DISCO_COLOR,
							linewidth: effectParams.lineWidth ?? 3,
							clippingPlanes: [clippingPlane],
							clipIntersection: false,
							resolution: new THREE.Vector2(canvas.width, canvas.height),
							transparent: true,
							depthWrite: false,
							opacity: 1.0,
							alphaToCoverage: false
						});

						lineMaterial.uniforms.lineFadeStart = { value: effectParams.lineFadeStart ?? 0.75 };
						lineMaterial.uniforms.lineFadeEnd = { value: effectParams.lineFadeEnd ?? 1.1 };
						lineMaterial.uniforms.lightX = { value: effectParams.lightX ?? 0.5 };
						lineMaterial.uniforms.lightY = { value: effectParams.lightY ?? 0.5 };
						lineMaterial.uniforms.groupScale = { value: DISCO_GROUP_SCALE };
						lineMaterial.uniforms.groupOffsetY = { value: DISCO_GROUP_Y };

						lineMaterial.onBeforeCompile = (shader) => {
							shader.uniforms.lineFadeStart = lineMaterial.uniforms.lineFadeStart;
							shader.uniforms.lineFadeEnd = lineMaterial.uniforms.lineFadeEnd;
							shader.uniforms.lightX = lineMaterial.uniforms.lightX;
							shader.uniforms.lightY = lineMaterial.uniforms.lightY;
							shader.uniforms.groupScale = lineMaterial.uniforms.groupScale;
							shader.uniforms.groupOffsetY = lineMaterial.uniforms.groupOffsetY;

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
								uniform float groupScale;
								uniform float groupOffsetY;
								varying vec3 vWorldPos;
								void main() {`
							);
							shader.fragmentShader = shader.fragmentShader.replace(
								'gl_FragColor = vec4( diffuseColor.rgb, alpha );',
								`// Undo discoGroup transform to get original local-space positions
								vec2 localPos = vec2(vWorldPos.x / groupScale, (vWorldPos.y - groupOffsetY) / groupScale);
								vec2 lightDir = normalize(vec2(lightX, lightY));
								float projPos = dot(localPos, lightDir);
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
				edgesToAdd.forEach(edge => discoBallModel.add(edge));

				discoBallModel.scale.setScalar(1.2);
				discoBallModel.position.set(0, 0, 0);
				discoGroup.add(discoBallModel);

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
		discoBallModel = new THREE.Group();

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
			depthWrite: false,
			side: THREE.FrontSide
		});
		shadowMaterials.push(shadowMaterial);
		const mesh = new THREE.Mesh(geometry, shadowMaterial);
		discoBallModel.add(mesh);

		const edges = new THREE.EdgesGeometry(geometry, 15);
		const positions = edges.attributes.position.array;
		const lineGeometry = new LineSegmentsGeometry();
		lineGeometry.setPositions(positions);

		const lineMaterial = new LineMaterial({
			color: DISCO_COLOR,
			linewidth: effectParams.lineWidth ?? 3,
			resolution: new THREE.Vector2(canvas.width, canvas.height),
			transparent: true,
			depthWrite: false,
			opacity: 1.0
		});

		lineMaterial.uniforms.lineFadeStart = { value: effectParams.lineFadeStart ?? 0.75 };
		lineMaterial.uniforms.lineFadeEnd = { value: effectParams.lineFadeEnd ?? 1.1 };
		lineMaterial.uniforms.lightX = { value: effectParams.lightX ?? 0.5 };
		lineMaterial.uniforms.lightY = { value: effectParams.lightY ?? 0.5 };
		lineMaterial.uniforms.groupScale = { value: DISCO_GROUP_SCALE };
		lineMaterial.uniforms.groupOffsetY = { value: DISCO_GROUP_Y };

		lineMaterial.onBeforeCompile = (shader) => {
			shader.uniforms.lineFadeStart = lineMaterial.uniforms.lineFadeStart;
			shader.uniforms.lineFadeEnd = lineMaterial.uniforms.lineFadeEnd;
			shader.uniforms.lightX = lineMaterial.uniforms.lightX;
			shader.uniforms.lightY = lineMaterial.uniforms.lightY;
			shader.uniforms.groupScale = lineMaterial.uniforms.groupScale;
			shader.uniforms.groupOffsetY = lineMaterial.uniforms.groupOffsetY;

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
				uniform float groupScale;
				uniform float groupOffsetY;
				varying vec3 vWorldPos;
				void main() {`
			);
			shader.fragmentShader = shader.fragmentShader.replace(
				'gl_FragColor = vec4( diffuseColor.rgb, alpha );',
				`// Undo discoGroup transform to get original local-space positions
				vec2 localPos = vec2(vWorldPos.x / groupScale, (vWorldPos.y - groupOffsetY) / groupScale);
				vec2 lightDir = normalize(vec2(lightX, lightY));
				float projPos = dot(localPos, lightDir);
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

		discoGroup.add(discoBallModel);
		addDecorations();
	}

	// ===== THREE.JS INIT =====
	function initThree() {
		scene = new THREE.Scene();
		scene.background = null;

		// Orthographic camera using GlitchText's 1600-unit coordinate system
		const aspect = canvas.width / canvas.height;
		const frustumSize = REF_HEIGHT;
		camera = new THREE.OrthographicCamera(
			-frustumSize * aspect / 2,
			frustumSize * aspect / 2,
			frustumSize / 2,
			-frustumSize / 2,
			0.1,
			1000
		);
		camera.position.z = 500;

		// Renderer with mobile optimizations
		const pixelRatio = isMobile
			? Math.min(window.devicePixelRatio, 1.5)
			: Math.min(window.devicePixelRatio, 2);

		renderer = new THREE.WebGLRenderer({
			canvas,
			alpha: true,
			antialias: !isMobile,
			powerPreference: 'high-performance'
		});
		renderer.setPixelRatio(pixelRatio);
		renderer.outputColorSpace = THREE.SRGBColorSpace;
		renderer.toneMapping = THREE.ACESFilmicToneMapping;
		renderer.toneMappingExposure = 1.2;
		renderer.localClippingEnabled = true;
		renderer.setClearColor(0x000000, 0);
		renderer.autoClearAlpha = true;

		// Create text elements (directly in scene, in 1600-unit space)
		createTextElements();

		// Create disco ball group positioned in 1600-unit space
		// The disco container center is ~y=-215 in the 1600-unit system
		// Scale: discoContainer is ~935px tall in 1600-unit space, disco ball frustum is 3 units
		// so scale factor ~= 935/3 ≈ 312
		discoGroup = new THREE.Group();
		discoGroup.position.set(0, DISCO_GROUP_Y, 0);
		discoGroup.scale.setScalar(DISCO_GROUP_SCALE);
		scene.add(discoGroup);

		// Lighting (as children of disco group so they stay in local coords)
		const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
		discoGroup.add(ambientLight);

		const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
		directionalLight.position.set(2, 3, 5);
		discoGroup.add(directionalLight);

		const rimLight = new THREE.DirectionalLight(0xff6666, 0.6);
		rimLight.position.set(-2, -1, 3);
		discoGroup.add(rimLight);

		// Post-processing
		composer = new EffectComposer(renderer, {
			frameBufferType: THREE.HalfFloatType
		});

		const renderPass = new RenderPass(scene, camera);
		renderPass.clearAlpha = 0;
		composer.addPass(renderPass);

		// Bloom
		const bloomRadius = isMobile ? 0.5 : 0.85;
		bloomEffect = new BloomEffect({
			blendFunction: BlendFunction.ADD,
			intensity: effectParams.bloomIntensity ?? 8.5,
			luminanceThreshold: effectParams.bloomThreshold ?? 1,
			luminanceSmoothing: 0.3,
			mipmapBlur: true,
			radius: bloomRadius
		});
		const bloomPass = new EffectPass(camera, bloomEffect);
		composer.addPass(bloomPass);

		// Create both effect types
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
			aberrationAmount: effectParams.aberrationAmount ?? 0.008,
			aberrationAngle: effectParams.aberrationAngle ?? 0,
			aberrationAnimated: effectParams.aberrationAnimated ?? true,
			aberrationSpeed: effectParams.aberrationSpeed ?? 2,
			glitchIntensity: effectParams.cgGlitchIntensity ?? 0.27,
			glitchFrequency: effectParams.cgGlitchFrequency ?? 4,
			blockGlitchIntensity: effectParams.blockGlitchIntensity ?? 0.19,
			blockGlitchSize: effectParams.blockGlitchSize ?? 20,
			rgbShiftIntensity: effectParams.rgbShiftIntensity ?? 0.5,
			scanlineIntensity: effectParams.cgScanlineIntensity ?? 0.75,
			scanlineCount: effectParams.cgScanlineCount ?? 200,
			scanlineSpeed: effectParams.scanlineSpeed ?? 0,
			waveDistortion: effectParams.waveDistortion ?? 0.2,
			waveFrequency: effectParams.waveFrequency ?? 10,
			waveSpeed: effectParams.waveSpeed ?? 1,
			saturation: effectParams.cgSaturation ?? 0.8,
			brightness: effectParams.cgBrightness ?? 0.02,
			contrast: effectParams.cgContrast ?? 1.15,
			vignetteIntensity: effectParams.cgVignetteIntensity ?? 0.4,
			vignetteRadius: effectParams.cgVignetteRadius ?? 1.4,
			noiseIntensity: effectParams.cgNoiseIntensity ?? 0,
			noiseSpeed: effectParams.cgNoiseSpeed ?? 10
		});

		asciiPass = new EffectPass(camera, crtAsciiEffect);
		glitchPass = new EffectPass(camera, chromaticGlitchEffect);

		const effectMode = effectParams.effectMode ?? 'glitch';
		if (effectMode === 'glitch') {
			composer.addPass(glitchPass);
		} else {
			composer.addPass(asciiPass);
		}
		currentEffectMode = effectMode;

		return true;
	}

	// ===== RESIZE =====
	function handleResize() {
		if (!canvas || !renderer || !camera || !composer) return;

		const parent = canvas.parentElement;
		if (!parent) return;

		const width = parent.offsetWidth;
		const height = parent.offsetHeight;

		canvas.width = width;
		canvas.height = height;
		canvasHeight = height;

		renderer.setSize(width, height);
		composer.setSize(width, height);

		if (crtAsciiEffect) crtAsciiEffect.setSize(width, height);
		if (chromaticGlitchEffect) chromaticGlitchEffect.setSize(width, height);

		// Update LineMaterial resolutions
		lineMaterials.forEach(mat => {
			mat.resolution.set(width, height);
		});

		// Update camera
		const aspect = width / height;
		const frustumSize = REF_HEIGHT;
		camera.left = -frustumSize * aspect / 2;
		camera.right = frustumSize * aspect / 2;
		camera.top = frustumSize / 2;
		camera.bottom = -frustumSize / 2;
		camera.updateProjectionMatrix();
	}

	// ===== ANIMATION =====
	let lastTimestamp = 0;
	let slowFrameCount = 0;

	function animate(timestamp) {
		if (!renderer || !scene || !camera) return;

		const renderStart = performance.now();

		const deltaMs = lastTimestamp > 0 ? timestamp - lastTimestamp : 16.67;
		const deltaTime = Math.min(deltaMs / 1000, 0.1);
		lastTimestamp = timestamp;

		if (deltaMs > 50) {
			slowFrameCount++;
			console.warn(`[POSTER] SLOW FRAME #${slowFrameCount}: ${deltaMs.toFixed(1)}ms gap`);
		}

		const time = timestamp * 0.001;

		// ===== DISCO BALL ANIMATION =====
		if (discoBallModel) {
			discoBallModel.position.set(effectParams.positionX || 0, effectParams.positionY || 0, 0);
			discoBallModel.scale.setScalar(effectParams.scale || 1.2);
			const baseSpinSpeed = effectParams.spinSpeed ?? 0.1;
			const tilt = effectParams.tilt ?? 0.3;
			discoBallModel.rotation.x = tilt;

			currentRotationY += baseSpinSpeed * deltaTime;

			if (isActivated) {
				currentRotationY += activatedSpinSpeed * deltaTime;
				activatedSpinSpeed *= SPIN_DECAY;
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

		// Animate rings
		const ringTilt = effectParams.ringTilt ?? 0.5;
		const ringTilt2 = effectParams.ringTilt2 ?? 0.3;
		const ringSize = effectParams.ringSize ?? 1.1;
		const ringRotationSpeed = 0.12;
		decorations.forEach((dec, i) => {
			if (dec.geometry && dec.geometry.type === 'TorusGeometry') {
				dec.rotation.x = Math.PI / 2 + ringTilt;
				dec.rotation.y = ringTilt2;
				dec.rotation.z += ringRotationSpeed * deltaTime * (i % 2 === 0 ? 1 : -1);
				dec.scale.setScalar(ringSize);
			}
		});

		// ===== EFFECT MODE SWITCHING =====
		const effectMode = effectParams.effectMode ?? 'glitch';
		if (effectMode !== currentEffectMode && composer) {
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

		// ===== UPDATE EFFECT PARAMS =====
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
			chromaticGlitchEffect.aberrationAmount = effectParams.aberrationAmount ?? 0.008;
			chromaticGlitchEffect.aberrationAngle = effectParams.aberrationAngle ?? 0;
			chromaticGlitchEffect.aberrationAnimated = effectParams.aberrationAnimated ?? true;
			chromaticGlitchEffect.aberrationSpeed = effectParams.aberrationSpeed ?? 2;
			chromaticGlitchEffect.glitchIntensity = effectParams.cgGlitchIntensity ?? 0.27;
			chromaticGlitchEffect.glitchFrequency = effectParams.cgGlitchFrequency ?? 4;
			chromaticGlitchEffect.blockGlitchIntensity = effectParams.blockGlitchIntensity ?? 0.19;
			chromaticGlitchEffect.blockGlitchSize = effectParams.blockGlitchSize ?? 20;
			chromaticGlitchEffect.rgbShiftIntensity = effectParams.rgbShiftIntensity ?? 0.5;
			chromaticGlitchEffect.scanlineIntensity = effectParams.cgScanlineIntensity ?? 0.75;
			// Scale scanline count based on canvas height (reference ~400px)
			const baseScanlineCount = effectParams.cgScanlineCount ?? 200;
			chromaticGlitchEffect.scanlineCount = Math.round(baseScanlineCount * (canvasHeight / 400));
			chromaticGlitchEffect.scanlineSpeed = effectParams.scanlineSpeed ?? 0;
			chromaticGlitchEffect.waveDistortion = effectParams.waveDistortion ?? 0.2;
			chromaticGlitchEffect.waveFrequency = effectParams.waveFrequency ?? 10;
			chromaticGlitchEffect.waveSpeed = effectParams.waveSpeed ?? 1;
			chromaticGlitchEffect.saturation = effectParams.cgSaturation ?? 0.8;
			chromaticGlitchEffect.brightness = effectParams.cgBrightness ?? 0.02;
			chromaticGlitchEffect.contrast = effectParams.cgContrast ?? 1.15;
			chromaticGlitchEffect.vignetteIntensity = effectParams.cgVignetteIntensity ?? 0.4;
			chromaticGlitchEffect.vignetteRadius = effectParams.cgVignetteRadius ?? 1.4;
			chromaticGlitchEffect.noiseIntensity = effectParams.cgNoiseIntensity ?? 0;
			chromaticGlitchEffect.noiseSpeed = effectParams.cgNoiseSpeed ?? 10;
		}

		if (bloomEffect) {
			bloomEffect.intensity = effectParams.bloomIntensity ?? 8.5;
			bloomEffect.luminanceThreshold = effectParams.bloomThreshold ?? 1;
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

		// Update line materials
		const lineWidth = effectParams.lineWidth ?? 3;
		const lineFadeStart = effectParams.lineFadeStart ?? 0.75;
		const lineFadeEnd = effectParams.lineFadeEnd ?? 1.1;
		lineMaterials.forEach(mat => {
			mat.linewidth = lineWidth;
			if (mat.uniforms.lineFadeStart) mat.uniforms.lineFadeStart.value = lineFadeStart;
			if (mat.uniforms.lineFadeEnd) mat.uniforms.lineFadeEnd.value = lineFadeEnd;
			if (mat.uniforms.lightX) mat.uniforms.lightX.value = lightX;
			if (mat.uniforms.lightY) mat.uniforms.lightY.value = lightY;
		});

		// Render
		composer.render();

		const renderTime = performance.now() - renderStart;
		if (renderTime > 16) {
			console.warn(`[POSTER] Render took ${renderTime.toFixed(1)}ms`);
		}

		animationId = requestAnimationFrame(animate);
	}

	// ===== LIFECYCLE =====
	onMount(async () => {
		if (!browser) return;
		mounted = true;

		await new Promise(r => setTimeout(r, 50));

		if (!initThree()) {
			console.error('Failed to initialize PosterScene');
			return;
		}

		loadDiscoBall();
		handleResize();

		animationId = requestAnimationFrame(animate);
		window.addEventListener('resize', handleResize);

		// Attach interaction to disco container
		if (discoContainer) {
			attachInteractionHandlers(discoContainer);
		}
	});

	onDestroy(() => {
		if (!browser) return;

		if (animationId) cancelAnimationFrame(animationId);
		window.removeEventListener('resize', handleResize);

		if (discoContainer) {
			detachInteractionHandlers(discoContainer);
		}

		textObjects.forEach(obj => {
			if (obj.dispose) obj.dispose();
		});
		textObjects = [];

		decorations.forEach(dec => {
			if (dec.geometry) dec.geometry.dispose();
			if (dec.material) dec.material.dispose();
		});
		decorations = [];

		lineMaterials.forEach(mat => mat.dispose());
		lineMaterials = [];
		shadowMaterials.forEach(mat => mat.dispose());
		shadowMaterials = [];

		if (renderer) renderer.dispose();
		if (composer) composer.dispose();
	});

	// React to discoContainer prop changes
	$: if (browser && mounted && discoContainer) {
		attachInteractionHandlers(discoContainer);
	}
</script>

{#if mounted}
	<canvas bind:this={canvas} class="poster-scene-canvas"></canvas>
{/if}

<style>
	.poster-scene-canvas {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
		z-index: 4;
	}
</style>

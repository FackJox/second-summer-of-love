<script>
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import * as THREE from 'three';
	import { Text } from 'troika-three-text';
	import { EffectComposer, RenderPass, EffectPass, BloomEffect, BlendFunction } from 'postprocessing';
	import { ChromaticGlitchEffect } from '$lib/shaders/ChromaticGlitchEffect.js';

	// Effect parameters - shared with disco ball
	export let effectParams;

	// Font URLs (TTF format required by troika-three-text)
	const HORIZON_FONT = '/fonts/horizon.c7c834b7fe209bdc0a30119a6b1d26ae.b3ebf62f8ff8ae950dea860d56c49d1b.ttf';
	const CONDENSED_FONT = '/fonts/scr-nsev-reg.039ecb79bbf7e9fd5981a06a01c.28e686f1a1e6846cf246683ff0cd3181.ttf';

	// Colors matching the poster
	const ORANGE = '#e58632';
	const WHITE = '#ffffff';
	const SHADOW_COLOR = 'rgba(15, 26, 58, 0.5)';

	let canvas;
	let mounted = false;
	let renderer;
	let scene;
	let camera;
	let composer;
	let animationId;
	let textObjects = [];
	let chromaticGlitchEffect = null;
	let bloomEffect = null;
	let canvasHeight = 800; // Track for scanline scaling

	// Reference dimensions (matching poster)
	const REF_WIDTH = 1133;
	const REF_HEIGHT = 1600;

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

		// Sync to ensure text is ready
		textMesh.sync();

		return textMesh;
	}

	function initThree() {
		scene = new THREE.Scene();
		scene.background = null;

		// Orthographic camera matching poster aspect
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

		renderer = new THREE.WebGLRenderer({
			canvas,
			alpha: true,
			antialias: true,
			powerPreference: 'high-performance'
		});
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.outputColorSpace = THREE.SRGBColorSpace;
		renderer.setClearColor(0x000000, 0);

		// Create text elements
		createTextElements();

		// Post-processing
		composer = new EffectComposer(renderer, {
			frameBufferType: THREE.HalfFloatType
		});

		const renderPass = new RenderPass(scene, camera);
		renderPass.clearAlpha = 0;
		composer.addPass(renderPass);

		// Bloom effect
		bloomEffect = new BloomEffect({
			blendFunction: BlendFunction.ADD,
			intensity: effectParams.bloomIntensity ?? 8.5,
			luminanceThreshold: effectParams.bloomThreshold ?? 1,
			luminanceSmoothing: 0.3,
			mipmapBlur: true,
			radius: 0.85
		});
		const bloomPass = new EffectPass(camera, bloomEffect);
		composer.addPass(bloomPass);

		// Chromatic glitch effect
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

		const glitchPass = new EffectPass(camera, chromaticGlitchEffect);
		composer.addPass(glitchPass);

		return true;
	}

	function createTextElements() {
		// Clear existing text objects
		textObjects.forEach(obj => {
			scene.remove(obj);
			obj.dispose();
		});
		textObjects = [];

		// Layout from top to bottom (y values in poster coordinates, 0 = center)
		// Names section - top area
		const nameY = 620;
		const name1 = createTextMesh('COBIE COPE', {
			font: HORIZON_FONT,
			fontSize: 43,
			color: ORANGE,
			y: nameY,
			letterSpacing: 0.12
		});
		scene.add(name1);
		textObjects.push(name1);

		const ampersand = createTextMesh('&', {
			font: CONDENSED_FONT,
			fontSize: 39,
			color: WHITE,
			y: nameY - 50
		});
		scene.add(ampersand);
		textObjects.push(ampersand);

		const name2 = createTextMesh('SOPHIE COPE', {
			font: HORIZON_FONT,
			fontSize: 43,
			color: ORANGE,
			y: nameY - 100,
			letterSpacing: 0.12
		});
		scene.add(name2);
		textObjects.push(name2);

		// Subtitle
		const subtitle = createTextMesh('INVITE YOU TO', {
			font: CONDENSED_FONT,
			fontSize: 26,
			color: WHITE,
			y: nameY - 200,
			letterSpacing: 0.12
		});
		scene.add(subtitle);
		textObjects.push(subtitle);

		// Headlines
		const headlineY = nameY - 340;
		const headline1 = createTextMesh('THE SECOND', {
			font: HORIZON_FONT,
			fontSize: 87,
			color: ORANGE,
			y: headlineY,
			letterSpacing: 0.05
		});
		scene.add(headline1);
		textObjects.push(headline1);

		const headline2 = createTextMesh('SUMMER OF', {
			font: HORIZON_FONT,
			fontSize: 87,
			color: ORANGE,
			y: headlineY - 108,
			letterSpacing: 0.05
		});
		scene.add(headline2);
		textObjects.push(headline2);

		const headline3 = createTextMesh('LOVE', {
			font: HORIZON_FONT,
			fontSize: 89,
			color: ORANGE,
			y: headlineY - 216,
			letterSpacing: 0.05
		});
		scene.add(headline3);
		textObjects.push(headline3);

		// Event details (bottom section)
		const detailY = -420;
		const detailSpacing = 38;

		const detail1 = createTextMesh('SATURDAY 19 SEPTEMBER', {
			font: CONDENSED_FONT,
			fontSize: 26,
			color: WHITE,
			y: detailY,
			letterSpacing: 0.15
		});
		scene.add(detail1);
		textObjects.push(detail1);

		const detail2 = createTextMesh('FAITH IN STRANGERS', {
			font: CONDENSED_FONT,
			fontSize: 26,
			color: WHITE,
			y: detailY - detailSpacing,
			letterSpacing: 0.15
		});
		scene.add(detail2);
		textObjects.push(detail2);

		const detail3 = createTextMesh('MARGATE', {
			font: CONDENSED_FONT,
			fontSize: 26,
			color: WHITE,
			y: detailY - detailSpacing * 2,
			letterSpacing: 0.15
		});
		scene.add(detail3);
		textObjects.push(detail3);

		const detail4 = createTextMesh('17:30PM', {
			font: CONDENSED_FONT,
			fontSize: 26,
			color: WHITE,
			y: detailY - detailSpacing * 3,
			letterSpacing: 0.15
		});
		scene.add(detail4);
		textObjects.push(detail4);

		// CTA Button text
		const ctaY = -620;
		const cta = createTextMesh('SPIN THE GLOBE TO RSVP', {
			font: CONDENSED_FONT,
			fontSize: 29,
			color: WHITE,
			y: ctaY,
			letterSpacing: 0
		});
		scene.add(cta);
		textObjects.push(cta);
	}

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

		if (chromaticGlitchEffect) {
			chromaticGlitchEffect.setSize(width, height);
		}

		// Update camera
		const aspect = width / height;
		const frustumSize = REF_HEIGHT;
		camera.left = -frustumSize * aspect / 2;
		camera.right = frustumSize * aspect / 2;
		camera.top = frustumSize / 2;
		camera.bottom = -frustumSize / 2;
		camera.updateProjectionMatrix();
	}

	function animate() {
		if (!renderer || !scene || !camera) return;

		// Update effect parameters
		if (chromaticGlitchEffect) {
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
			// Scale scanline count to match disco ball visual density (reference height ~400px)
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

		composer.render();
		animationId = requestAnimationFrame(animate);
	}

	onMount(async () => {
		if (!browser) return;
		mounted = true;

		await new Promise(r => setTimeout(r, 50));

		if (!initThree()) {
			console.error('Failed to initialize GlitchText');
			return;
		}

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

		textObjects.forEach(obj => {
			if (obj.dispose) obj.dispose();
		});
		textObjects = [];

		if (renderer) renderer.dispose();
		if (composer) composer.dispose();
	});
</script>

{#if mounted}
	<canvas bind:this={canvas} class="glitch-text-canvas"></canvas>
{/if}

<style>
	.glitch-text-canvas {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
		z-index: 4;
	}
</style>

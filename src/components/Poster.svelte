<script>
	import { onMount, createEventDispatcher } from 'svelte';
	import BackgroundShader from './BackgroundShader.svelte';
	import DiscoBall from './DiscoBall.svelte';
	import GlitchText from './GlitchText.svelte';

	let posterContainer;
	let discoContainer;
	let scaleFactor = 1;
	let enableTextGlitch = true; // Toggle for the text effect
	const REFERENCE_WIDTH = 1133;
	const REFERENCE_HEIGHT = 1600;

	const dispatch = createEventDispatcher();

	let fontsLoaded = false;

	// Shader parameters - tweak via GUI
	let shaderParams = {
		rotationSpeed: 0.03,
		timeScale: 0.16,
		blobStrength: 0.095,
		blobFreqX: 8.8,
		blobFreqY: 1.2,
		swirlStrength: 0.75,
		swirlFalloff: 3.0,
		swirlFreq: 10.0,
		swirlSpeed: 2.0,
		flowStrength: 0.11,
		flowFreq: 3.0,
		rippleStrength: 0.014,
		rippleFreq: 17.5,
		breatheAmount: 0.22,
		breatheSpeed: 0.05,
		baseScale: 0.5,
		panSpeed: 0.001,
		blur: 1.0,
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

	let imageSrc = '/assets/background.png';

	// Disco ball CRT/ASCII effect params
	let discoBallParams = {
		// Effect mode: 'ascii' or 'glitch'
		effectMode: 'glitch',

		// ===== ASCII EFFECT PARAMS =====
		// ASCII
		cellSize: 2,
		invert: false,
		colorMode: true,
		asciiStyle: 0,
		// CRT
		scanlineIntensity: 0.51,
		scanlineCount: 290,
		curvature: 0,
		aberrationStrength: 0,
		// Post
		vignetteIntensity: 0.3,
		vignetteRadius: 2,
		bloomIntensity: 8.5,
		bloomThreshold: 1,
		bloomMix: 1,
		// Extras
		noiseIntensity: 0.1,
		glitchIntensity: 0.2,
		glitchFrequency: 0.5,
		brightnessAdjust: 0,
		contrastAdjust: 1,

		// ===== CHROMATIC GLITCH EFFECT PARAMS =====
		// Chromatic aberration
		aberrationAmount: 0.008,
		aberrationAngle: 0,
		aberrationAnimated: true,
		aberrationSpeed: 2,
		// Glitch
		cgGlitchIntensity: 0.27,
		cgGlitchFrequency: 4,
		blockGlitchIntensity: 0.19,
		blockGlitchSize: 20,
		rgbShiftIntensity: 0.5,
		// Scanlines
		cgScanlineIntensity: 0.75,
		cgScanlineCount: 200,
		scanlineSpeed: 0,
		// Distortion
		waveDistortion: 0.2,
		waveFrequency: 10,
		waveSpeed: 1,
		// Color
		cgSaturation: 0.8,
		cgBrightness: 0.02,
		cgContrast: 1.15,
		cgVignetteIntensity: 0.4,
		cgVignetteRadius: 1.4,
		// Noise
		cgNoiseIntensity: 0,
		cgNoiseSpeed: 10,

		// ===== SHARED PARAMS =====
		// Transform
		positionX: 0,
		positionY: 0.1,
		scale: 1.4,
		spinSpeed: 0.1,
		tilt: 0.2,
		ringTilt: 0.2,
		ringTilt2: 0.15,
		ringSize: 1.4,
		// Shading
		shadowStrength: 0.05,
		highlightStrength: 0.45,
		lineFadeStart: 0.6,
		lineFadeEnd: 1.05,
		lineWidth: 3.5,
		// Unified lighting direction (shadow opposite, highlight aligned, fade follows)
		lightX: 0.15,
		lightY: 0.45
	};

	function updateScale() {
		if (!posterContainer) return;
		const { height } = posterContainer.getBoundingClientRect();
		scaleFactor = height / REFERENCE_HEIGHT;
	}

	function handleRsvpClick() {
		dispatch('openRsvp');
	}

	onMount(() => {
		// Wait for fonts to load
		document.fonts.ready.then(() => {
			fontsLoaded = true;
			dispatch('loaded');
		});

		updateScale();
		window.addEventListener('resize', updateScale);

		return () => {
			window.removeEventListener('resize', updateScale);
		};
	});
</script>

<div class="poster" bind:this={posterContainer}>
	<BackgroundShader container={posterContainer} params={shaderParams} {imageSrc} />

	<div class="poster-content" style="transform: scale({scaleFactor});">
		<!-- WebGL text with glitch effect -->
		{#if enableTextGlitch}
			<div class="glitch-text-container">
				<GlitchText effectParams={discoBallParams} />
			</div>
		{/if}

		<!-- HTML text fallback (hidden when glitch effect is enabled) -->
		{#if !enableTextGlitch}
			<!-- Names -->
			<div class="names-section">
				<h1 class="name" class:loaded={fontsLoaded}>COBIE COPE</h1>
				<span class="ampersand" class:loaded={fontsLoaded}>&</span>
				<h1 class="name" class:loaded={fontsLoaded}>SOPHIE COPE</h1>
			</div>

			<!-- Subtitle -->
			<p class="subtitle" class:loaded={fontsLoaded}>INVITE YOU TO</p>

			<!-- Main headline -->
			<div class="headline-section">
				<h2 class="headline" class:loaded={fontsLoaded}>THE SECOND</h2>
				<h2 class="headline" class:loaded={fontsLoaded}>SUMMER OF</h2>
				<h2 class="headline headline-love" class:loaded={fontsLoaded}>LOVE</h2>
			</div>
		{:else}
			<!-- Spacer to maintain layout when text is rendered via WebGL -->
			<div class="text-spacer"></div>
		{/if}

		<!-- Disco ball with CRT/ASCII effect -->
		<div class="disco-container" bind:this={discoContainer}>
			<DiscoBall effectParams={discoBallParams} on:activated={handleRsvpClick} />
		</div>

		<!-- Event details (hidden when glitch enabled - rendered in WebGL) -->
		{#if !enableTextGlitch}
			<div class="event-details">
				<p class="detail" class:loaded={fontsLoaded}>SATURDAY 19 SEPTEMBER</p>
				<p class="detail" class:loaded={fontsLoaded}>FAITH IN STRANGERS</p>
				<p class="detail" class:loaded={fontsLoaded}>MARGATE</p>
				<p class="detail" class:loaded={fontsLoaded}>17:30PM</p>
			</div>
		{/if}

		<!-- CTA Button (invisible when glitch enabled, but still clickable) -->
		<button
			class="cta-button"
			class:loaded={fontsLoaded}
			class:glitch-hidden={enableTextGlitch}
			on:click={handleRsvpClick}
		>
			SPIN THE GLOBE TO RSVP
		</button>
	</div>
</div>

<style>
	/* Font faces for the downloaded fonts */
	@font-face {
		font-family: 'Horizon';
		src: url('/fonts/horizon.c7c834b7fe209bdc0a30119a6b1d26ae.b3ebf62f8ff8ae950dea860d56c49d1b.woff2') format('woff2');
		font-display: swap;
	}

	@font-face {
		font-family: 'CondensedBold';
		src: url('/fonts/scr-nsevbd-reg.3f1bb23215a22e898f7272aa2.4e21acea96a3d8e9d18d910b961567bb.woff2') format('woff2');
		font-display: swap;
	}

	@font-face {
		font-family: 'CondensedRegular';
		src: url('/fonts/scr-nsev-reg.039ecb79bbf7e9fd5981a06a01c.28e686f1a1e6846cf246683ff0cd3181.woff2') format('woff2');
		font-display: swap;
	}

	@font-face {
		font-family: 'SerifItalic';
		src: url('/fonts/cff149ee1e9d2be50ac77bcd86769d05.woff2') format('woff2');
		font-display: swap;
	}

	.poster {
		aspect-ratio: 1133 / 1600;
		max-width: 95vw;
		max-height: 95vh;
		position: relative;
		overflow: hidden;
		border-radius: 4px;
		box-shadow: 0 4px 30px rgba(0, 0, 0, 0.4);
	}

	.poster-content {
		width: 1133px;
		height: 1600px;
		transform-origin: top left;
		position: relative;
		z-index: 3;
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: var(--content-padding-top, 45px) var(--content-padding-x, 40px);
		box-sizing: border-box;
	}

	/* Names section */
	.names-section {
		text-align: center;
		margin-top: var(--name-margin-top, 45px);
	}

	.name {
		font-family: 'Horizon', 'Rye', cursive;
		font-size: var(--name-font-size, 43px);
		color: #e58632;
		margin: 0;
		letter-spacing: var(--name-letter-spacing, 5px);
		line-height: var(--name-line-height, 0.7);
		text-transform: uppercase;
		opacity: 0;
		transition: opacity 0.3s ease;
		/* Displaced letterform shadow - 50% transparent */
		text-shadow: 4px 4px 0px rgba(15, 26, 58, 0.5);
	}

	.name.loaded {
		opacity: 1;
	}

	.ampersand {
		font-family: 'CondensedRegular', 'Anton', sans-serif;
		font-size: var(--amp-font-size, 39px);
		color: #ffffff;
		display: block;
		margin: var(--amp-margin, 0px) 0;
		opacity: 0;
		transition: opacity 0.3s ease;
	}

	.ampersand.loaded {
		opacity: 1;
	}

	/* Subtitle */
	.subtitle {
		font-family: 'CondensedRegular', 'Anton', sans-serif;
		font-size: var(--subtitle-font-size, 26px);
		color: #ffffff;
		letter-spacing: var(--subtitle-letter-spacing, 3px);
		margin: var(--subtitle-margin-top, 80px) 0 var(--subtitle-margin-bottom, 72px) 0;
		text-transform: uppercase;
		opacity: 0;
		transition: opacity 0.3s ease;
	}

	.subtitle.loaded {
		opacity: 1;
	}

	/* Headline */
	.headline-section {
		text-align: center;
		margin: 0;
	}

	.headline {
		font-family: 'Horizon', 'Rye', cursive;
		font-size: var(--headline-font-size, 87px);
		color: #e58632;
		margin: 0;
		line-height: var(--headline-line-height, 1.24);
		text-transform: uppercase;
		white-space: nowrap;
		opacity: 0;
		transition: opacity 0.3s ease;
		/* Displaced letterform shadow - 50% transparent */
		text-shadow: 5px 5px 0px rgba(15, 26, 58, 0.5);
	}

	.headline.loaded {
		opacity: 1;
	}

	.headline-love {
		font-size: var(--headline-love-font-size, 89px);
	}

	/* Disco ball container */
	.disco-container {
		flex: 1;
		min-height: var(--disco-spacer-min-height, 320px);
		width: 100%;
		position: relative;
	}

	/* Event details */
	.event-details {
		text-align: center;
		margin: 0;
	}

	.detail {
		font-family: 'CondensedRegular', 'Anton', sans-serif;
		font-size: var(--detail-font-size, 26px);
		color: #ffffff;
		margin: var(--detail-margin, 4px) 0;
		letter-spacing: var(--detail-letter-spacing, 5px);
		line-height: var(--detail-line-height, 1.3);
		text-transform: uppercase;
		opacity: 0;
		transition: opacity 0.3s ease;
	}

	.detail.loaded {
		opacity: 1;
	}

	/* CTA Button */
	.cta-button {
		font-family: 'CondensedBold', 'Anton', sans-serif;
		font-size: var(--cta-font-size, 29px);
		color: #ffffff;
		background: transparent;
		border: none;
		cursor: pointer;
		letter-spacing: var(--cta-letter-spacing, 0px);
		text-transform: uppercase;
		margin-top: var(--cta-margin-top, 18px);
		margin-bottom: var(--cta-margin-bottom, 17px);
		padding: 16px 32px;
		position: relative;
		opacity: 0;
		transition: opacity 0.3s ease, transform 0.2s ease;
	}

	.cta-button.loaded {
		opacity: 1;
	}

	.cta-button:hover {
		transform: scale(1.05);
	}

	/* Hide button text when glitch effect shows it via WebGL */
	.cta-button.glitch-hidden {
		color: transparent;
	}

	/* Container for WebGL glitch text */
	.glitch-text-container {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
		z-index: 4;
	}

	/* Spacer to maintain layout when WebGL text is used */
	.text-spacer {
		height: 480px; /* Approximate height of names + subtitle + headlines */
	}
</style>

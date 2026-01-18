<script>
	import { onMount, onDestroy } from 'svelte';

	export let visible = true;

	let fps = 0;
	let frameTime = 0;
	let avgFrameTime = 0;
	let minFps = Infinity;
	let maxFps = 0;
	let memoryUsed = 0;
	let memoryLimit = 0;

	// Frame timing
	let lastTime = 0;
	let frameCount = 0;
	let frameTimes = [];
	const MAX_SAMPLES = 60;

	// Animation frame ID
	let animationId = null;

	// Performance markers for identifying bottlenecks
	let markers = {};
	let markerHistory = {};

	function updateStats(currentTime) {
		if (lastTime === 0) {
			lastTime = currentTime;
			animationId = requestAnimationFrame(updateStats);
			return;
		}

		const delta = currentTime - lastTime;
		lastTime = currentTime;
		frameCount++;

		// Calculate current frame time and FPS
		frameTime = delta;
		const currentFps = 1000 / delta;

		// Track min/max
		if (currentFps > 0 && currentFps < 1000) {
			minFps = Math.min(minFps, currentFps);
			maxFps = Math.max(maxFps, currentFps);
		}

		// Rolling average
		frameTimes.push(delta);
		if (frameTimes.length > MAX_SAMPLES) {
			frameTimes.shift();
		}

		// Update display every 10 frames
		if (frameCount % 10 === 0) {
			avgFrameTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
			fps = 1000 / avgFrameTime;

			// Memory (Chrome only)
			if (performance.memory) {
				memoryUsed = performance.memory.usedJSHeapSize / (1024 * 1024);
				memoryLimit = performance.memory.jsHeapSizeLimit / (1024 * 1024);
			}

			// Collect marker stats
			markers = { ...window.__perfMarkers || {} };
		}

		animationId = requestAnimationFrame(updateStats);
	}

	function reset() {
		minFps = Infinity;
		maxFps = 0;
		frameTimes = [];
		frameCount = 0;
	}

	// Expose global performance marker API
	function setupMarkerAPI() {
		window.__perfMarkers = {};
		window.__perfMarkerStarts = {};

		window.perfMark = (name) => {
			window.__perfMarkerStarts[name] = performance.now();
		};

		window.perfMeasure = (name) => {
			const start = window.__perfMarkerStarts[name];
			if (start !== undefined) {
				const duration = performance.now() - start;
				if (!window.__perfMarkers[name]) {
					window.__perfMarkers[name] = { total: 0, count: 0, avg: 0 };
				}
				window.__perfMarkers[name].total += duration;
				window.__perfMarkers[name].count++;
				window.__perfMarkers[name].avg =
					window.__perfMarkers[name].total / window.__perfMarkers[name].count;
			}
		};

		window.perfReset = () => {
			window.__perfMarkers = {};
			window.__perfMarkerStarts = {};
		};
	}

	onMount(() => {
		setupMarkerAPI();
		animationId = requestAnimationFrame(updateStats);
	});

	onDestroy(() => {
		if (animationId) {
			cancelAnimationFrame(animationId);
		}
	});

	// Color coding for FPS
	$: fpsColor =
		fps >= 55 ? '#4ade80' : fps >= 30 ? '#fbbf24' : '#ef4444';

	$: frameTimeColor =
		avgFrameTime <= 16.67 ? '#4ade80' : avgFrameTime <= 33.33 ? '#fbbf24' : '#ef4444';
</script>

{#if visible}
	<div class="perf-monitor">
		<div class="perf-header">
			<span class="title">PERF</span>
			<button class="reset-btn" on:click={reset}>↺</button>
		</div>

		<div class="stat-row">
			<span class="label">FPS</span>
			<span class="value" style="color: {fpsColor}">{fps.toFixed(1)}</span>
		</div>

		<div class="stat-row small">
			<span class="label">Min/Max</span>
			<span class="value">{minFps === Infinity ? '-' : minFps.toFixed(0)}/{maxFps === 0 ? '-' : maxFps.toFixed(0)}</span>
		</div>

		<div class="stat-row">
			<span class="label">Frame</span>
			<span class="value" style="color: {frameTimeColor}">{avgFrameTime.toFixed(2)}ms</span>
		</div>

		{#if memoryLimit > 0}
			<div class="stat-row">
				<span class="label">Memory</span>
				<span class="value">{memoryUsed.toFixed(1)}MB</span>
			</div>
		{/if}

		{#if Object.keys(markers).length > 0}
			<div class="markers-section">
				<div class="section-title">Markers</div>
				{#each Object.entries(markers) as [name, data]}
					<div class="stat-row small">
						<span class="label marker-label">{name}</span>
						<span class="value">{data.avg.toFixed(2)}ms</span>
					</div>
				{/each}
			</div>
		{/if}

		<div class="help-text">
			Use perfMark('name') and perfMeasure('name') in console to add markers
		</div>
	</div>
{/if}

<style>
	.perf-monitor {
		position: fixed;
		top: 10px;
		right: 10px;
		background: rgba(0, 0, 0, 0.85);
		color: #fff;
		font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
		font-size: 11px;
		padding: 8px 12px;
		border-radius: 6px;
		z-index: 10000;
		min-width: 120px;
		backdrop-filter: blur(4px);
		border: 1px solid rgba(255, 255, 255, 0.1);
	}

	.perf-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 6px;
		padding-bottom: 4px;
		border-bottom: 1px solid rgba(255, 255, 255, 0.2);
	}

	.title {
		font-weight: 600;
		letter-spacing: 1px;
		color: #a78bfa;
	}

	.reset-btn {
		background: none;
		border: none;
		color: #666;
		cursor: pointer;
		font-size: 12px;
		padding: 0;
	}

	.reset-btn:hover {
		color: #fff;
	}

	.stat-row {
		display: flex;
		justify-content: space-between;
		margin: 3px 0;
	}

	.stat-row.small {
		font-size: 10px;
		opacity: 0.7;
	}

	.label {
		color: #888;
	}

	.value {
		font-weight: 500;
	}

	.markers-section {
		margin-top: 8px;
		padding-top: 6px;
		border-top: 1px solid rgba(255, 255, 255, 0.1);
	}

	.section-title {
		font-size: 9px;
		color: #666;
		text-transform: uppercase;
		letter-spacing: 1px;
		margin-bottom: 4px;
	}

	.marker-label {
		max-width: 60px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.help-text {
		margin-top: 8px;
		font-size: 8px;
		color: #555;
		line-height: 1.3;
	}
</style>

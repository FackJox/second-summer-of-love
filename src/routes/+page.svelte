<script>
    import { onMount } from 'svelte';
    import Poster from '../components/Poster.svelte';
    import Rsvp from '../components/Rsvp.svelte';
    import { fade } from 'svelte/transition';

    let showRsvp = false;
    let showThankYou = false;
    let isLoaded = false;
    let rsvpLoaded = false;

    onMount(() => {
        // Preload the RSVP component
        setTimeout(() => {
            rsvpLoaded = true;
        }, 1000);
    });

    function handleLoaded() {
        console.log('Poster component loaded');
        const minLoadTime = 1200;
        const startTime = Date.now();
        const elapsedTime = Date.now() - startTime;

        if (elapsedTime >= minLoadTime) {
            isLoaded = true;
        } else {
            setTimeout(() => {
                isLoaded = true;
            }, minLoadTime - elapsedTime);
        }
    }

    function toggleRsvp() {
        showRsvp = !showRsvp;
    }

    function handleFormSuccess() {
        console.log('handleFormSuccess called');
        showRsvp = false;
        showThankYou = true;
        setTimeout(() => {
            showThankYou = false;
        }, 10000);
    }

    function handleModalClick(event) {
        if (event.currentTarget === event.target) {
            showRsvp = false;
        }
    }

    function handleModalKeydown(event) {
        if (event.key === 'Escape') {
            showRsvp = false;
        }
    }
</script>

<main>
    {#if !isLoaded}
    <div class="loader" transition:fade={{ duration: 400 }}>
        <!-- CRT scanlines overlay -->
        <div class="loader-scanlines"></div>

        <!-- Film grain overlay -->
        <div class="film-grain"></div>

        <!-- VHS tracking noise at edges -->
        <div class="vhs-noise"></div>
    </div>
    {/if}

    <div class="poster-wrapper" class:crt-power-on={isLoaded}>
        <!-- CRT phosphor glow overlay during boot -->
        <div class="crt-boot-glow"></div>
        <!-- Horizontal beam line -->
        <div class="crt-beam-line"></div>
        <Poster on:loaded={handleLoaded} on:openRsvp={toggleRsvp} />
    </div>

    {#if rsvpLoaded}
    <div class="rsvp-preload" class:show={showRsvp}>
        <div class="modal" transition:fade on:click|self={handleModalClick} on:keydown={handleModalKeydown} role="button" tabindex="0">
            <Rsvp on:success={handleFormSuccess} />
        </div>
    </div>
    {/if}

    {#if showThankYou}
    <div class="thank-you" transition:fade>
        <h2 class="font-headline">Excited to see you!</h2>
        <p class="font-body">More details to follow.</p>
    </div>
    {/if}
</main>

<style>
    /* Match Poster.svelte font faces */
    @font-face {
        font-family: 'Horizon';
        src: url('/fonts/horizon.c7c834b7fe209bdc0a30119a6b1d26ae.b3ebf62f8ff8ae950dea860d56c49d1b.woff2') format('woff2');
        font-display: block;
    }

    @font-face {
        font-family: 'CondensedBold';
        src: url('/fonts/scr-nsevbd-reg.3f1bb23215a22e898f7272aa2.4e21acea96a3d8e9d18d910b961567bb.woff2') format('woff2');
        font-display: block;
    }

    @font-face {
        font-family: 'CondensedRegular';
        src: url('/fonts/scr-nsev-reg.039ecb79bbf7e9fd5981a06a01c.28e686f1a1e6846cf246683ff0cd3181.woff2') format('woff2');
        font-display: block;
    }

    :global(body) {
        margin: 0;
        padding: 0;
        overflow: hidden;
    }

    .rsvp-preload {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: -1;
    }

    .rsvp-preload.show {
        display: block;
        z-index: 1000;
    }

    /* Fill the entire viewport and center children */
    main {
        width: 100vw;
        height: 100vh;
        margin: 0;
        padding: 0;
        display: flex;
        justify-content: center;
        align-items: center;
        background: url('/assets/bg2.jpg') center center / cover no-repeat;
        background-color: #1a1a2e;
    }

    .modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    }

    /* Add CRT scanlines to modal backdrop */
    .modal::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: repeating-linear-gradient(
            0deg,
            rgba(0, 0, 0, 0.08) 0px,
            rgba(0, 0, 0, 0.08) 1px,
            transparent 1px,
            transparent 2px
        );
        pointer-events: none;
        z-index: 1;
        animation: crt-flicker 0.15s infinite;
    }

    @keyframes crt-flicker {
        0%, 100% { opacity: 0.97; }
        50% { opacity: 1; }
    }

    .thank-you {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 90%;
        max-width: 320px;
        background: #101830;
        border: 2px solid #E58632;
        border-radius: 6px;
        box-shadow:
            0 0 30px rgba(229, 134, 50, 0.3),
            0 0 60px rgba(229, 134, 50, 0.1),
            inset 0 0 60px rgba(229, 134, 50, 0.05);
        overflow: hidden;
        z-index: 1001;
        padding: 20px 15px;
        display: flex;
        flex-direction: column;
        align-items: center;
        animation: heartbeat 1.5s ease-in-out infinite;
    }

    /* CRT scanlines for thank-you */
    .thank-you::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: repeating-linear-gradient(
            0deg,
            rgba(0, 0, 0, 0.15) 0px,
            rgba(0, 0, 0, 0.15) 1px,
            transparent 1px,
            transparent 3px
        );
        pointer-events: none;
        z-index: 10;
        animation: crt-flicker 0.15s infinite;
    }

    /* CRT vignette for thank-you */
    .thank-you::after {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: radial-gradient(
            ellipse at center,
            transparent 0%,
            transparent 50%,
            rgba(0, 0, 0, 0.4) 100%
        );
        pointer-events: none;
        z-index: 11;
    }

    @keyframes heartbeat {
        0%, 100% {
            transform: translate(-50%, -50%) scale(1);
        }
        50% {
            transform: translate(-50%, -50%) scale(1.03);
        }
    }

    .thank-you p {
        font-family: 'CondensedRegular', 'Anton', sans-serif;
        font-size: 14px;
        color: #ffffff;
        text-align: center;
        margin: 15px 0 0 0;
        letter-spacing: 2px;
        text-transform: uppercase;
        text-shadow:
            0 0 10px rgba(255, 255, 255, 0.5),
            0 0 20px rgba(229, 134, 50, 0.3);
        position: relative;
        z-index: 5;
    }

    .thank-you h2 {
        font-family: 'Horizon', 'Rye', cursive;
        font-size: 22px;
        text-align: center;
        margin: 0;
        color: #e58632;
        letter-spacing: 2px;
        text-transform: uppercase;
        width: 100%;
        box-sizing: border-box;
        text-shadow:
            0 0 10px rgba(229, 134, 50, 0.8),
            0 0 20px rgba(229, 134, 50, 0.5),
            0 0 30px rgba(229, 134, 50, 0.3);
        position: relative;
        z-index: 5;
    }

    .loader {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: transparent;
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 2000;
    }

    /* ========================================
       CRT POWER-ON EFFECT
       Using clip-path to avoid WebGL distortion
       ======================================== */

    .poster-wrapper {
        position: relative;
        /* Initial state: clipped to horizontal line at center */
        clip-path: inset(50% 0 50% 0);
        opacity: 0;
        filter: brightness(0) saturate(0);
    }

    /* The horizontal beam line that appears first */
    .crt-beam-line {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 100%;
        height: 3px;
        background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(255, 255, 255, 0.3) 10%,
            rgba(200, 220, 255, 0.9) 30%,
            rgba(255, 255, 255, 1) 50%,
            rgba(200, 220, 255, 0.9) 70%,
            rgba(255, 255, 255, 0.3) 90%,
            transparent 100%
        );
        box-shadow:
            0 0 20px 8px rgba(180, 200, 255, 0.8),
            0 0 40px 15px rgba(140, 180, 255, 0.5),
            0 0 80px 30px rgba(100, 150, 255, 0.3);
        opacity: 0;
        z-index: 100;
        pointer-events: none;
    }

    /* Phosphor bloom overlay during boot */
    .crt-boot-glow {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: radial-gradient(
            ellipse at center,
            rgba(180, 200, 255, 0.4) 0%,
            rgba(100, 150, 255, 0.2) 30%,
            transparent 70%
        );
        opacity: 0;
        z-index: 99;
        pointer-events: none;
        mix-blend-mode: screen;
    }

    /* Power-on animation sequence */
    .poster-wrapper.crt-power-on {
        animation: crt-power-on 0.7s cubic-bezier(0.22, 1, 0.36, 1) forwards;
    }

    .poster-wrapper.crt-power-on .crt-beam-line {
        animation: crt-beam 0.7s ease-out forwards;
    }

    .poster-wrapper.crt-power-on .crt-boot-glow {
        animation: crt-glow 0.7s ease-out forwards;
    }

    @keyframes crt-power-on {
        /* Initial darkness - clipped to thin line */
        0% {
            clip-path: inset(50% 0 50% 0);
            opacity: 0;
            filter: brightness(0) saturate(0);
        }
        /* Beam appears */
        5% {
            clip-path: inset(49.8% 0 49.8% 0);
            opacity: 1;
            filter: brightness(3) saturate(0);
        }
        /* Start expanding - phosphor glow */
        15% {
            clip-path: inset(45% 0 45% 0);
            opacity: 1;
            filter: brightness(2.5) saturate(0.3);
        }
        /* Rapid expansion with chromatic instability */
        30% {
            clip-path: inset(30% 0 30% 0);
            opacity: 1;
            filter: brightness(1.8) saturate(0.5) hue-rotate(-10deg);
        }
        /* Major expansion - color coming in */
        50% {
            clip-path: inset(10% 0 10% 0);
            opacity: 1;
            filter: brightness(1.4) saturate(0.8) hue-rotate(5deg);
        }
        /* Almost full - slight overshoot */
        70% {
            clip-path: inset(0% 0 0% 0);
            opacity: 1;
            filter: brightness(1.2) saturate(1.1) hue-rotate(-3deg);
        }
        /* Flicker */
        80% {
            clip-path: inset(0% 0 0% 0);
            opacity: 0.9;
            filter: brightness(0.85) saturate(1);
        }
        /* Quick bright flicker */
        85% {
            clip-path: inset(0% 0 0% 0);
            opacity: 1;
            filter: brightness(1.2) saturate(1);
        }
        /* Settle */
        90% {
            clip-path: inset(0% 0 0% 0);
            opacity: 0.95;
            filter: brightness(0.95) saturate(1);
        }
        /* Final stable state */
        100% {
            clip-path: inset(0% 0 0% 0);
            opacity: 1;
            filter: brightness(1) saturate(1);
        }
    }

    @keyframes crt-beam {
        0% {
            opacity: 0;
            height: 2px;
            box-shadow:
                0 0 10px 4px rgba(180, 200, 255, 0.5),
                0 0 20px 8px rgba(140, 180, 255, 0.3);
        }
        5% {
            opacity: 1;
            height: 4px;
            box-shadow:
                0 0 30px 12px rgba(180, 200, 255, 1),
                0 0 60px 25px rgba(140, 180, 255, 0.7),
                0 0 100px 40px rgba(100, 150, 255, 0.4);
        }
        15% {
            opacity: 1;
            height: 8px;
            box-shadow:
                0 0 40px 15px rgba(180, 200, 255, 0.9),
                0 0 80px 30px rgba(140, 180, 255, 0.5);
        }
        35% {
            opacity: 0.6;
            height: 20px;
        }
        50% {
            opacity: 0.2;
            height: 40px;
        }
        70% {
            opacity: 0;
        }
        100% {
            opacity: 0;
        }
    }

    @keyframes crt-glow {
        0% {
            opacity: 0;
        }
        5% {
            opacity: 0;
        }
        15% {
            opacity: 0.8;
        }
        40% {
            opacity: 0.5;
        }
        70% {
            opacity: 0.2;
        }
        100% {
            opacity: 0;
        }
    }

    /* Font styling classes */
    .font-headline {
        font-family: 'Horizon', 'Rye', cursive;
    }

    .font-body {
        font-family: 'CondensedRegular', 'Anton', sans-serif;
    }
</style>

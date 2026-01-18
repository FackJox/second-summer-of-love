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
</script>

<main>
    {#if !isLoaded}
    <div class="loader" transition:fade={{ duration: 500 }}>
        <img src="/assets/disco-ball.svg" alt="Loading..." />
    </div>
    {/if}

    <Poster on:loaded={handleLoaded} on:openRsvp={toggleRsvp} />

    {#if rsvpLoaded}
    <div class="rsvp-preload" class:show={showRsvp}>
        <div class="modal" transition:fade on:click|self={handleModalClick}>
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

    /* CRT effect overlay for modals */
    .crt-overlay {
        position: relative;
    }

    .crt-overlay::before {
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
        border-radius: inherit;
    }

    .crt-overlay::after {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: radial-gradient(
            ellipse at center,
            transparent 0%,
            transparent 60%,
            rgba(0, 0, 0, 0.3) 100%
        );
        pointer-events: none;
        z-index: 11;
        border-radius: inherit;
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
        background: linear-gradient(180deg, #3A5B8C 0%, #C94B7C 50%, #E58632 100%);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 2000;
    }

    .loader img {
        width: 120px;
        height: 120px;
        animation: spin 3s linear infinite;
    }

    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }

    /* Font styling classes */
    .font-headline {
        font-family: 'Horizon', 'Rye', cursive;
    }

    .font-body {
        font-family: 'CondensedRegular', 'Anton', sans-serif;
    }
</style>

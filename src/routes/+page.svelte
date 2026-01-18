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

    .thank-you {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 90%;
        max-width: 320px;
        background: linear-gradient(180deg, #3A5B8C 0%, #C94B7C 50%, #E58632 100%);
        border: 2px solid #E58632;
        border-radius: 20px;
        box-shadow: 0 4px 30px rgba(229, 134, 50, 0.3);
        overflow: hidden;
        z-index: 1001;
        padding: 15px;
        display: flex;
        flex-direction: column;
        align-items: center;
        animation: heartbeat 1.5s ease-in-out infinite;
    }

    @keyframes heartbeat {
        0%, 100% {
            transform: translate(-50%, -50%) scale(1);
        }
        50% {
            transform: translate(-50%, -50%) scale(1.05);
        }
    }

    .thank-you p {
        font-family: 'Anton', sans-serif;
        font-size: 14px;
        color: #ffffff;
        text-align: center;
        margin-bottom: 10px;
        letter-spacing: 1px;
    }

    .thank-you h2 {
        font-family: 'Rye', cursive;
        font-size: 36px;
        text-align: center;
        margin: 0;
        background-color: #E58632;
        color: #1a1a1a;
        padding: 10px 15px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        width: 100%;
        box-sizing: border-box;
        border-radius: 10px;
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
        font-family: 'Rye', cursive;
    }

    .font-body {
        font-family: 'Anton', sans-serif;
    }
</style>

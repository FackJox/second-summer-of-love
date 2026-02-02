<script>
    import { onMount, createEventDispatcher } from 'svelte';
    import { config } from '$lib/config.js';
    export let form;

    const dispatch = createEventDispatcher();

    let fontsLoaded = false;
    let rsvpContainer;
    let formData = {
        name: '',
        phonenumber: '',
        email: '',
        plusones: '',
        dietary: ''
    };
    let error = null;
    let success = false;
    let isSubmitting = false;

    onMount(() => {
        document.fonts.ready.then(() => {
            fontsLoaded = true;
        });
    });

    async function handleSubmit(event) {
        event.preventDefault();
        error = null;
        success = false;
        isSubmitting = true;

        try {
            const response = await fetch('/api/rsvp', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });

            if (!response.ok) {
                const result = await response.json();
                throw new Error(result.error || 'Failed to submit');
            }

            success = true;
            dispatch('success');
        } catch (err) {
            console.error('Error:', err);
            error = 'An error occurred';
        } finally {
            isSubmitting = false;
        }
    }
</script>

<div class="rsvp-container" bind:this={rsvpContainer}>
    <form on:submit={handleSubmit}>
        <h1 class:loaded={fontsLoaded}>FEELING THE LOVE?</h1>
        <p class="subtitle" class:loaded={fontsLoaded}>SEND US YOUR DEETS</p>

        {#if form?.error}
            <p class="error-message">{form?.error}</p>
        {/if}

        {#if success}
            <p class="success-message" class:loaded={fontsLoaded}>EXCITED TO SEE YOU!</p>
        {/if}

        <div class="form-field">
            <label for="name" class:loaded={fontsLoaded}>NAME</label>
            <input id="name" name="name" type="text" required bind:value={formData.name}>
        </div>
        <div class="form-field">
            <label for="phonenumber" class:loaded={fontsLoaded}>PHONE NUMBER</label>
            <input id="phonenumber" name="phonenumber" type="tel" required bind:value={formData.phonenumber}>
        </div>
        <div class="form-field">
            <label for="email" class:loaded={fontsLoaded}>EMAIL</label>
            <input id="email" name="email" type="email" required bind:value={formData.email}>
        </div>
        <div class="form-field">
            <label for="plusones" class:loaded={fontsLoaded}>PLUS ONE NAME</label>
            <input id="plusones" name="plusones" type="text" bind:value={formData.plusones}>
        </div>
        {#if config.showDietary}
            <div class="form-field">
                <label for="dietary" class:loaded={fontsLoaded}>DIETARY REQUIREMENTS</label>
                <textarea id="dietary" name="dietary" bind:value={formData.dietary}></textarea>
            </div>
        {/if}
        <button type="submit" class:loaded={fontsLoaded} class:submitting={isSubmitting} disabled={isSubmitting}>
            <span class="btn-text">{isSubmitting ? 'SENDING...' : 'RSVP'}</span>
            <span class="scanline-sweep"></span>
        </button>
    </form>
</div>

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

    .rsvp-container {
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 100vh;
        width: 100%;
        padding: 20px;
        box-sizing: border-box;
        pointer-events: none;
    }

    form {
        width: 90%;
        max-width: 320px;
        background: #101830;
        border: 2px solid #e58632;
        border-radius: 6px;
        box-shadow:
            0 0 30px rgba(229, 134, 50, 0.3),
            0 0 60px rgba(229, 134, 50, 0.1),
            inset 0 0 60px rgba(229, 134, 50, 0.05);
        overflow: hidden;
        z-index: 1000;
        padding: 15px;
        display: flex;
        flex-direction: column;
        align-items: center;
        pointer-events: auto;
        position: relative;
    }

    /* CRT scanlines overlay */
    form::before {
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
        z-index: 100;
        animation: crt-flicker 0.15s infinite;
    }

    /* CRT vignette effect */
    form::after {
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
        z-index: 101;
    }

    @keyframes crt-flicker {
        0%, 100% { opacity: 0.97; }
        50% { opacity: 1; }
    }

    h1 {
        font-family: 'Horizon', 'Rye', cursive;
        font-size: 20px;
        text-align: center;
        margin: 0 0 4px 0;
        color: #e58632;
        letter-spacing: 2px;
        text-transform: uppercase;
        opacity: 0;
        transition: opacity 0.3s ease;
        text-shadow:
            0 0 10px rgba(229, 134, 50, 0.8),
            0 0 20px rgba(229, 134, 50, 0.5),
            0 0 30px rgba(229, 134, 50, 0.3);
        position: relative;
        z-index: 5;
    }

    h1.loaded {
        opacity: 1;
    }

    .subtitle {
        font-family: 'CondensedRegular', 'Anton', sans-serif;
        font-size: 14px;
        color: #ffffff;
        text-align: center;
        margin: 0 0 12px 0;
        letter-spacing: 2px;
        text-transform: uppercase;
        opacity: 0;
        transition: opacity 0.3s ease;
        text-shadow:
            0 0 10px rgba(255, 255, 255, 0.5),
            0 0 20px rgba(229, 134, 50, 0.3);
        position: relative;
        z-index: 5;
    }

    .subtitle.loaded {
        opacity: 1;
    }

    .success-message {
        font-family: 'CondensedBold', 'Anton', sans-serif;
        color: #e58632;
        text-align: center;
        margin: 0 0 10px 0;
        font-size: 12px;
        letter-spacing: 2px;
        opacity: 0;
        transition: opacity 0.3s ease;
        text-shadow:
            0 0 10px rgba(229, 134, 50, 0.8),
            0 0 20px rgba(229, 134, 50, 0.5);
        position: relative;
        z-index: 5;
    }

    .success-message.loaded {
        opacity: 1;
    }

    .error-message {
        font-family: 'CondensedRegular', 'Anton', sans-serif;
        color: #ff6b6b;
        text-align: center;
        margin: 0 0 10px 0;
        font-size: 12px;
        letter-spacing: 1px;
    }

    .form-field {
        width: 100%;
        margin-bottom: 10px;
        box-sizing: border-box;
        position: relative;
        z-index: 5;
    }

    label {
        font-family: 'CondensedRegular', 'Anton', sans-serif;
        display: block;
        margin-bottom: 2px;
        color: #ffffff;
        font-size: 12px;
        letter-spacing: 2px;
        text-transform: uppercase;
        opacity: 0;
        transition: opacity 0.3s ease;
        text-shadow: 0 0 8px rgba(255, 255, 255, 0.3);
    }

    label.loaded {
        opacity: 1;
    }

    input, textarea {
        width: 100%;
        padding: 8px;
        border: 2px solid rgba(229, 134, 50, 0.4);
        border-radius: 4px;
        background-color: rgba(16, 24, 48, 0.9);
        color: #ffffff;
        font-size: 14px;
        box-sizing: border-box;
        font-family: 'CondensedRegular', 'Anton', sans-serif;
        letter-spacing: 1px;
        transition: border-color 0.2s ease, box-shadow 0.2s ease;
        position: relative;
        z-index: 5;
    }

    input::placeholder, textarea::placeholder {
        color: rgba(255, 255, 255, 0.3);
    }

    input:focus, textarea:focus {
        outline: none;
        border-color: #e58632;
        box-shadow:
            0 0 12px rgba(229, 134, 50, 0.4),
            0 0 20px rgba(229, 134, 50, 0.2);
    }

    textarea {
        height: 60px;
        resize: vertical;
        min-height: 50px;
    }

    button {
        width: 100%;
        height: 50px;
        margin-top: 10px;
        background: transparent;
        border: 2px solid #e58632;
        border-radius: 4px;
        cursor: pointer;
        position: relative;
        padding: 0;
        display: flex;
        justify-content: center;
        align-items: center;
        -webkit-appearance: none;
        z-index: 5;
        box-shadow: 0 0 10px rgba(229, 134, 50, 0.2);
        overflow: hidden;
        transition: box-shadow 0.2s ease, border-color 0.2s ease;
    }

    /* Hover: phosphor glow intensifies */
    button:hover:not(:disabled) {
        box-shadow:
            0 0 15px rgba(229, 134, 50, 0.5),
            0 0 30px rgba(229, 134, 50, 0.3),
            inset 0 0 20px rgba(229, 134, 50, 0.1);
    }

    /* Active/Click: CRT power surge flash */
    button:active:not(:disabled) {
        animation: crt-click 0.15s ease-out;
    }

    @keyframes crt-click {
        0% {
            box-shadow:
                0 0 10px rgba(229, 134, 50, 0.2);
            filter: brightness(1);
        }
        50% {
            box-shadow:
                0 0 30px rgba(229, 134, 50, 0.9),
                0 0 60px rgba(229, 134, 50, 0.6),
                inset 0 0 30px rgba(229, 134, 50, 0.3);
            filter: brightness(1.3);
        }
        100% {
            box-shadow:
                0 0 15px rgba(229, 134, 50, 0.4),
                0 0 30px rgba(229, 134, 50, 0.2);
            filter: brightness(1);
        }
    }

    /* Submitting state: pulsing phosphor glow */
    button.submitting {
        background: rgba(229, 134, 50, 0.05);
        animation: phosphor-pulse 1.2s ease-in-out infinite;
        border-color: #e58632;
    }

    @keyframes phosphor-pulse {
        0%, 100% {
            box-shadow:
                0 0 10px rgba(229, 134, 50, 0.3),
                0 0 20px rgba(229, 134, 50, 0.2),
                inset 0 0 15px rgba(229, 134, 50, 0.05);
        }
        50% {
            box-shadow:
                0 0 25px rgba(229, 134, 50, 0.7),
                0 0 50px rgba(229, 134, 50, 0.4),
                inset 0 0 30px rgba(229, 134, 50, 0.15);
        }
    }

    button:disabled {
        cursor: not-allowed;
    }

    /* Button text */
    button .btn-text {
        font-family: 'CondensedBold', 'Anton', sans-serif;
        color: #e58632;
        font-size: 18px;
        letter-spacing: 3px;
        text-shadow:
            0 0 10px rgba(229, 134, 50, 0.8),
            0 0 20px rgba(229, 134, 50, 0.5);
        position: relative;
        z-index: 2;
        transition: text-shadow 0.2s ease, letter-spacing 0.2s ease;
    }

    button:hover:not(:disabled) .btn-text {
        text-shadow:
            0 0 15px rgba(229, 134, 50, 1),
            0 0 30px rgba(229, 134, 50, 0.7),
            0 0 45px rgba(229, 134, 50, 0.4);
        letter-spacing: 4px;
    }

    /* Submitting text: chromatic flicker */
    button.submitting .btn-text {
        animation: text-flicker 0.1s infinite;
    }

    @keyframes text-flicker {
        0%, 100% {
            opacity: 1;
            text-shadow:
                0 0 10px rgba(229, 134, 50, 0.8),
                0 0 20px rgba(229, 134, 50, 0.5);
        }
        50% {
            opacity: 0.95;
            text-shadow:
                -1px 0 rgba(255, 100, 100, 0.3),
                1px 0 rgba(100, 200, 255, 0.3),
                0 0 15px rgba(229, 134, 50, 0.9),
                0 0 30px rgba(229, 134, 50, 0.6);
        }
    }

    /* Scanline sweep element */
    button .scanline-sweep {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 4px;
        background: linear-gradient(
            180deg,
            transparent 0%,
            rgba(229, 134, 50, 0.8) 50%,
            transparent 100%
        );
        opacity: 0;
        pointer-events: none;
        z-index: 3;
    }

    /* Scanline sweep animation during submit */
    button.submitting .scanline-sweep {
        opacity: 1;
        animation: scanline-travel 0.8s linear infinite;
    }

    @keyframes scanline-travel {
        0% {
            top: -4px;
            opacity: 0;
        }
        10% {
            opacity: 1;
        }
        90% {
            opacity: 1;
        }
        100% {
            top: calc(100% + 4px);
            opacity: 0;
        }
    }

    button.loaded .btn-text {
        opacity: 1;
    }
</style>
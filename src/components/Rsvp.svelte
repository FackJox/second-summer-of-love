<script>
    import { onMount, createEventDispatcher } from 'svelte';
    export let form;

    const SHEETS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbwJ2LwLcXS5SANMJFNJakHyncuXrKS7_BbEXwhrpu9VOT7U4K63wlXFXmm7Q5wijUfgZg/exec';

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
            const response = await fetch(SHEETS_ENDPOINT, {
                method: 'POST',
                mode: 'no-cors',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });

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
        <div class="form-field">
            <label for="dietary" class:loaded={fontsLoaded}>DIETARY REQUIREMENTS</label>
            <textarea id="dietary" name="dietary" bind:value={formData.dietary}></textarea>
        </div>
        <button type="submit" class:loaded={fontsLoaded} class:submitting={isSubmitting} disabled={isSubmitting}>
            <span>{isSubmitting ? '' : 'RSVP'}</span>
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
        box-shadow: 0 0 30px rgba(229, 134, 50, 0.2);
        overflow: hidden;
        z-index: 1000;
        padding: 15px;
        display: flex;
        flex-direction: column;
        align-items: center;
        pointer-events: auto;
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
    }

    label.loaded {
        opacity: 1;
    }

    input, textarea {
        width: 100%;
        padding: 8px;
        border: 2px solid rgba(229, 134, 50, 0.4);
        border-radius: 4px;
        background-color: rgba(16, 24, 48, 0.8);
        color: #ffffff;
        font-size: 14px;
        box-sizing: border-box;
        font-family: 'CondensedRegular', 'Anton', sans-serif;
        letter-spacing: 1px;
        transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }

    input::placeholder, textarea::placeholder {
        color: rgba(255, 255, 255, 0.3);
    }

    input:focus, textarea:focus {
        outline: none;
        border-color: #e58632;
        box-shadow: 0 0 12px rgba(229, 134, 50, 0.3);
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
        transition: all 0.2s ease;
        -webkit-appearance: none;
    }

    button:hover:not(:disabled) {
        background: rgba(229, 134, 50, 0.1);
        transform: scale(1.02);
        box-shadow: 0 0 20px rgba(229, 134, 50, 0.3);
    }

    button.submitting {
        background-image: url('/assets/disco-ball.svg');
        background-size: 36px 36px;
        background-repeat: no-repeat;
        background-position: center;
        background-color: rgba(229, 134, 50, 0.1);
        animation: spin 2s linear infinite;
        -webkit-animation: spin 2s linear infinite;
    }

    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }

    @-webkit-keyframes spin {
        0% { -webkit-transform: rotate(0deg); }
        100% { -webkit-transform: rotate(360deg); }
    }

    button:disabled {
        cursor: not-allowed;
        opacity: 0.7;
    }

    button span {
        font-family: 'CondensedBold', 'Anton', sans-serif;
        color: #e58632;
        font-size: 18px;
        letter-spacing: 2px;
        transition: opacity 0.3s ease;
    }

    button.submitting span {
        opacity: 0;
    }

    button.loaded span {
        opacity: 1;
    }
</style>
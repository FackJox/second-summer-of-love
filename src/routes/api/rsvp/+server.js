import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';

/** @type {import('./$types').RequestHandler} */
export async function POST({ request }) {
    const data = await request.json();

    const token = data['cf-turnstile-response'];

    // If token is null or empty return an error
    if (!token) {
        return json({ error: 'Invalid CAPTCHA' }, { status: 400 });
    }

    const SECRET_KEY = env.CF_TURNSTILE_PRIVATE_KEY;

    const { success, error } = await validateToken(token, SECRET_KEY);

    if (!success) {
        return json({ error: error || 'Invalid CAPTCHA' }, { status: 400 });
    }

    const response = await fetch(env.PRIVATE_GOOGLE_SHEETS_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });

    const result = await response.json();
    if (result.result !== 'success') {
        return json({ error: `Failed to submit please email: ${publicEnv.PUBLIC_EMAIL}` }, { status: 500 });
    }

    // Return success message
    return json({ success: true, message: 'RSVP submitted successfully!' });
}

async function validateToken(token, secret) {
    const response = await fetch(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                response: token,
                secret: secret,
            }),
        },
    );

    const data = await response.json();

    return {
        success: data.success,
        error: data['error-codes']?.length ? data['error-codes'][0] : null,
    };
}
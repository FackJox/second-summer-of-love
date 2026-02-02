import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';

/** @type {import('./$types').RequestHandler} */
export async function POST({ request }) {
    const data = await request.json();

    try {
        const response = await fetch(env.PRIVATE_GOOGLE_SHEETS_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        const result = await response.json();
        if (result.result !== 'success') {
            return json({ error: `Failed to submit. Please email: ${publicEnv.PUBLIC_EMAIL}` }, { status: 500 });
        }

        return json({ success: true, message: 'RSVP submitted successfully!' });
    } catch (err) {
        console.error('RSVP submission error:', err);
        return json({ error: `Failed to submit. Please email: ${publicEnv.PUBLIC_EMAIL}` }, { status: 500 });
    }
}

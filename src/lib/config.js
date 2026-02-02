import { env } from '$env/static/public';

export const config = {
    eventTime: env.PUBLIC_EVENT_TIME || '17:30PM',
    showDietary: env.PUBLIC_SHOW_DIETARY !== 'false'
};

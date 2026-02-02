import { env } from '$env/dynamic/public';

export const config = {
    get eventTime() {
        return env.PUBLIC_EVENT_TIME || '17:30PM';
    },
    get showDietary() {
        return env.PUBLIC_SHOW_DIETARY !== 'false';
    }
};

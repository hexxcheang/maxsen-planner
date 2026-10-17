declare const __APP_VERSION__: string;

/** The commit and day this copy of the app was built: shown in Help and in error messages. */
export const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';

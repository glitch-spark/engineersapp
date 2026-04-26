// Was process.env.APP_TIMEZONE in the Next build; rewritten for browser via Vite's import.meta.env.
const tz = ((import.meta as unknown as { env?: Record<string, string | undefined> }).env)?.VITE_APP_TIMEZONE;
export const APP_TZ = tz || 'Asia/Tokyo';

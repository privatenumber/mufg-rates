import { createFixtureFetch } from './fixture-source-fetch.ts';

if (!process.env.MUFG_LIVE) {
	globalThis.fetch = createFixtureFetch();
}

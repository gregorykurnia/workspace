import { createUploadHandler } from '../_lib/upload.mjs';

export const maxDuration = 60;
export default { fetch: createUploadHandler() };

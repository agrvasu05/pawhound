/**
 * pinterest-video.js — Pinterest v5 video Pin upload/post, shared by
 * scripts/5-post-pins.js and products/lib.js (both manage their own token
 * refresh already, so every function here takes accessToken/apiHost
 * explicitly rather than reading env/module state).
 *
 * Video pins are a 3-step async flow, unlike image pins (single POST with a
 * public image_url): register the upload, POST the file to the returned S3
 * URL, poll until Pinterest finishes processing, THEN create the Pin
 * referencing the resulting media_id. Schema confirmed against Pinterest's
 * authoritative OpenAPI spec (api-description v5.12.0), since the interactive
 * docs site is JS-rendered and the response shape isn't guessable reliably.
 */
const fs = require('fs');

function pinterestJson(method, host, endpoint, accessToken, body) {
  return fetch(`https://${host}${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  }).then(async (res) => {
    const text = await res.text();
    let json; try { json = JSON.parse(text); } catch { json = text; }
    return { status: res.status, body: json };
  });
}

async function registerVideoUpload({ accessToken, apiHost }) {
  const r = await pinterestJson('POST', apiHost, '/v5/media', accessToken, { media_type: 'video' });
  if (r.status !== 201) throw new Error(`Register media upload failed (${r.status}): ${JSON.stringify(r.body).slice(0, 300)}`);
  return r.body; // { media_id, media_type, upload_url, upload_parameters }
}

// upload_url is an S3 presigned-POST endpoint (different host than
// api.pinterest.com) — a multipart/form-data POST with upload_parameters as
// form fields, `file` MUST be appended LAST (S3 presigned-POST requirement).
async function uploadVideoFile({ uploadUrl, uploadParameters, filePath }) {
  const form = new FormData();
  for (const [k, v] of Object.entries(uploadParameters || {})) form.append(k, v);
  const buf = fs.readFileSync(filePath);
  form.append('file', new Blob([buf]), require('path').basename(filePath));
  const res = await fetch(uploadUrl, { method: 'POST', body: form });
  if (res.status >= 300) throw new Error(`S3 video upload failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
}

async function pollVideoStatus({ accessToken, apiHost, mediaId, maxAttempts = 30, intervalMs = 3000 }) {
  for (let i = 0; i < maxAttempts; i++) {
    const r = await pinterestJson('GET', apiHost, `/v5/media/${mediaId}`, accessToken);
    if (r.status !== 200) throw new Error(`Media status check failed (${r.status}): ${JSON.stringify(r.body).slice(0, 300)}`);
    if (r.body.status === 'succeeded') return r.body;
    if (r.body.status === 'failed') throw new Error(`Pinterest video processing failed: ${JSON.stringify(r.body).slice(0, 300)}`);
    await new Promise((res) => setTimeout(res, intervalMs));
  }
  throw new Error(`Video processing did not finish after ${maxAttempts} polls`);
}

// Cover can be a public URL (content pins, hosted under public/pins/<slug>/) OR
// inline base64 (shop pins, which are posted with image_base64 and never touch
// public hosting — see products/lib.js pinPost/postQueue).
async function createVideoPin({ accessToken, apiHost, boardId, title, description, altText, link, mediaId, coverImageUrl, coverImageData, coverImageContentType }) {
  const r = await pinterestJson('POST', apiHost, '/v5/pins', accessToken, {
    board_id: boardId,
    title,
    description,
    alt_text: altText,
    link,
    media_source: {
      source_type: 'video_id',
      media_id: mediaId,
      ...(coverImageData
        ? { cover_image_data: coverImageData, cover_image_content_type: coverImageContentType || 'image/jpeg' }
        : { cover_image_url: coverImageUrl }),
    },
  });
  if (r.status !== 201) throw new Error(`Create video pin failed (${r.status}): ${JSON.stringify(r.body).slice(0, 500)}`);
  return r.body;
}

// Orchestrates the full 4-step flow; returns the created Pin (has .id).
async function postVideoPin({ accessToken, apiHost = 'api.pinterest.com', boardId, title, description, altText, link, videoPath, coverImageUrl, coverImageData, coverImageContentType }) {
  const reg = await registerVideoUpload({ accessToken, apiHost });
  await uploadVideoFile({ uploadUrl: reg.upload_url, uploadParameters: reg.upload_parameters, filePath: videoPath });
  await pollVideoStatus({ accessToken, apiHost, mediaId: reg.media_id });
  return createVideoPin({ accessToken, apiHost, boardId, title, description, altText, link, mediaId: reg.media_id, coverImageUrl, coverImageData, coverImageContentType });
}

module.exports = { registerVideoUpload, uploadVideoFile, pollVideoStatus, createVideoPin, postVideoPin };

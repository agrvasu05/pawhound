/**
 * lib-video.js — turns an already-rendered static pin PNG into a short "Ken
 * Burns" motion video (slow zoom-in), for Pinterest video pins.
 *
 * Deliberately reuses the FINISHED static design (warm collage/hero-stack/shop
 * pin, already includes headline + branding) as the single source image rather
 * than building a separate video-editing pipeline — 2026 Pinterest research
 * shows video pins run ~3x the CTR / ~2x the saves of static, and the biggest
 * lever is motion + the same save-worthy creative, not a from-scratch format.
 *
 * ffmpeg's zoompan filter is notoriously jittery on a small source image (it
 * computes the crop window on the source's native pixel grid), so the source
 * is upscaled first — the standard workaround — before the zoom is applied.
 */
const { execFile } = require('child_process');
const path = require('path');
const ffmpegPath = require('ffmpeg-static');

function run(args) {
  return new Promise((resolve, reject) => {
    execFile(ffmpegPath, args, { maxBuffer: 1024 * 1024 * 32 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(`ffmpeg failed: ${err.message}\n${stderr.slice(-2000)}`));
      resolve({ stdout, stderr });
    });
  });
}

// Renders a `duration`-second slow zoom-in (1.0x -> ~1.15x) over `imagePath`,
// plus a JPG cover frame (Pinterest requires a cover image, same dimensions,
// for every video pin). Output is silent, H.264/yuv420p, faststart for web play.
//
// Only the top `height - captionHeight` px are zoomed; the bottom band (every
// template's headline/brand caption) is kept static the whole clip. A center
// zoom over the WHOLE pin crops the full-width caption text off the left/right
// edges as it progresses — confirmed by extracting mid/end frames and finding
// "13 Pet-Friendly..." clipped to "3 Pet-Friendly...fo" by the last frame.
async function renderKenBurnsFromImage({
  imagePath,
  outPath,
  coverPath,
  duration = 7,
  width = 1000,
  height = 1500,
  captionHeight = 420,
  fps = 25,
}) {
  const frames = Math.round(duration * fps);
  const imgH = height - captionHeight;
  const upscaleW = width * 2.6; // headroom for smooth sub-pixel zoom, avoids zoompan jitter
  const filter =
    `[0:v]crop=${width}:${imgH}:0:0,scale=${upscaleW}:-2:flags=lanczos,` +
    `zoompan=z='min(zoom+0.0016,1.15)':d=${frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${width}x${imgH}:fps=${fps}[zoomed];` +
    `[0:v]crop=${width}:${captionHeight}:0:${imgH},fps=${fps}[cap];` +
    `[zoomed][cap]vstack=inputs=2,format=yuv420p[out]`;

  await run([
    '-y', '-loop', '1', '-i', imagePath,
    '-t', String(duration),
    '-filter_complex', filter,
    '-map', '[out]',
    '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    outPath,
  ]);

  await run(['-y', '-i', outPath, '-frames:v', '1', '-q:v', '3', coverPath]);
  return { outPath, coverPath };
}

module.exports = { renderKenBurnsFromImage, ffmpegPath };

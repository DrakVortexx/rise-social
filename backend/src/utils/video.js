const ffmpeg = require("fluent-ffmpeg");
const ffmpeg_static = require("ffmpeg-static");

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpeg_static);

async function getVideoMetadata(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        console.error("Error getting video metadata:", err);
        reject(err);
      } else {
        const video = metadata.streams.find((s) => s.codec_type === "video");
        const duration = metadata.format.duration;
        const width = video ? video.width : null;
        const height = video ? video.height : null;

        resolve({
          duration: parseFloat(duration),
          width,
          height,
        });
      }
    });
  });
}

module.exports = {
  getVideoMetadata,
};

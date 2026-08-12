import { Avatar } from "./Avatar";
import { useState } from "react";

export function CreatePost({
  user,
  content,
  onContentChange,
  onSubmit,
  isPosting,
}) {
  const [videoFile, setVideoFile] = useState(null);
  const [videoPreview, setVideoPreview] = useState(null);
  const [videoError, setVideoError] = useState("");

  function handleVideoSelect(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const MAX_SIZE = 100 * 1024 * 1024; // 100 MB
    const ALLOWED_TYPES = ["video/mp4", "video/webm", "video/quicktime", "video/mpeg"];

    setVideoError("");

    if (file.size > MAX_SIZE) {
      setVideoError("Video must be smaller than 100 MB.");
      return;
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      setVideoError("Please upload a valid video file (MP4, WebM, MOV, etc.).");
      return;
    }

    setVideoFile(file);
    const url = URL.createObjectURL(file);
    setVideoPreview(url);
  }

  function handleRemoveVideo() {
    if (videoPreview) {
      URL.revokeObjectURL(videoPreview);
    }
    setVideoFile(null);
    setVideoPreview(null);
    setVideoError("");
  }

  function handleSubmitWithVideo(event) {
    event.preventDefault();

    if (videoFile) {
      onSubmit(event, videoFile);
    } else {
      onSubmit(event, null);
    }
  }

  const hasContent = content.trim() || videoFile;

  return (
    <section className="create-post">
      <Avatar
        name={user?.display_name}
        size="md"
      />

      <form onSubmit={handleSubmitWithVideo} className="create-post-form">
        <textarea
          value={content}
          onChange={(e) =>
            onContentChange(e.target.value)
          }
          maxLength={500}
          placeholder="What's happening on RISE?"
          disabled={isPosting}
          className="post-textarea"
        />

        {videoPreview && (
          <div className="video-preview-container">
            <video
              controls
              className="video-preview"
              src={videoPreview}
              preload="metadata"
            />
            <button
              type="button"
              className="remove-video-btn"
              onClick={handleRemoveVideo}
              disabled={isPosting}
              title="Remove video"
            >
              ✕ Remove video
            </button>
          </div>
        )}

        {videoError && (
          <div className="error">
            {videoError}
          </div>
        )}

        <div className="post-actions">
          <div className="post-toolbar">
            <label className="video-upload-label">
              🎬
              <input
                type="file"
                accept="video/*"
                onChange={handleVideoSelect}
                disabled={isPosting || videoFile !== null}
                className="video-input"
              />
            </label>

            <span className="char-count">
              {content.length}/500
            </span>
          </div>

          <button
            type="submit"
            disabled={isPosting || !hasContent}
            className="primary-button"
          >
            {isPosting ? "Posting..." : "Post"}
          </button>
        </div>
      </form>
    </section>
  );
}

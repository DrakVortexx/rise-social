const express = require("express");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");
const pool = require("../db/database");
const { uploadVideo, deleteVideo, getVideoUrl } = require("../utils/filen");
const { getVideoMetadata } = require("../utils/video");

function createRouter(upload) {
  const router = express.Router();

  function authenticate(req, res, next) {
    try {
      const header = req.headers.authorization;

      if (!header || !header.startsWith("Bearer ")) {
        return res.status(401).json({
          error: "Authentication required.",
        });
      }

      const token = header.split(" ")[1];

      req.user = jwt.verify(token, process.env.JWT_SECRET);

      next();
    } catch {
      return res.status(401).json({
        error: "Invalid or expired token.",
      });
    }
  }

  // CREATE POST (with optional video)
  router.post("/", authenticate, upload.single("video"), async (req, res) => {
    let uploadedFile = null;
    try {
      const content = String(req.body.content || "").trim();
      const videoFile = req.file;

      // Validate: post must have content or video
      if (!content && !videoFile) {
        if (videoFile) {
          fs.unlinkSync(videoFile.path);
        }
        return res.status(400).json({
          error: "Post must contain text or a video.",
        });
      }

      // Validate content length
      if (content && content.length > 500) {
        if (videoFile) {
          fs.unlinkSync(videoFile.path);
        }
        return res.status(400).json({
          error: "Post cannot exceed 500 characters.",
        });
      }

      // Validate video
      if (videoFile) {
        const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100 MB
        const MAX_VIDEO_DURATION = 5 * 60; // 5 minutes in seconds

        if (videoFile.size > MAX_VIDEO_SIZE) {
          fs.unlinkSync(videoFile.path);
          return res.status(400).json({
            error: "Video must be smaller than 100 MB.",
          });
        }

        // Get video metadata
        let metadata;
        try {
          metadata = await getVideoMetadata(videoFile.path);
        } catch (error) {
          fs.unlinkSync(videoFile.path);
          return res.status(400).json({
            error: "Failed to read video file. Make sure it's a valid video.",
          });
        }

        if (metadata.duration > MAX_VIDEO_DURATION) {
          fs.unlinkSync(videoFile.path);
          return res.status(400).json({
            error: "Video must be shorter than 5 minutes.",
          });
        }
      }

      // Create post
      const postResult = await pool.query(
        `INSERT INTO posts (user_id, content)
         VALUES ($1, $2)
         RETURNING id, user_id, content, created_at`,
        [req.user.id, content || null]
      );

      const post = postResult.rows[0];

      // Upload video if provided
      if (videoFile) {
        try {
          const metadata = await getVideoMetadata(videoFile.path);

          uploadedFile = await uploadVideo(videoFile.path, videoFile.originalname);

          // Store video metadata in database
          await pool.query(
            `INSERT INTO videos (post_id, original_filename, filen_file_id, filen_path, mime_type, file_size, duration, width, height)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              post.id,
              videoFile.originalname,
              uploadedFile.fileId,
              uploadedFile.path,
              videoFile.mimetype,
              videoFile.size,
              metadata.duration,
              metadata.width,
              metadata.height,
            ]
          );

          // Clean up temporary file
          fs.unlinkSync(videoFile.path);
        } catch (error) {
          console.error("Error uploading video:", error);
          // Delete post if video upload fails
          await pool.query(`DELETE FROM posts WHERE id = $1`, [post.id]);

          if (fs.existsSync(videoFile.path)) {
            fs.unlinkSync(videoFile.path);
          }

          return res.status(500).json({
            error: "Failed to upload video.",
          });
        }
      }

      // Get full post data with user info and video
      const fullPost = await pool.query(
        `SELECT
          posts.id,
          posts.content,
          posts.created_at,
          users.id AS user_id,
          users.username,
          users.display_name,
          users.avatar_url,
          COUNT(DISTINCT likes.post_id)::int AS like_count,
          COUNT(DISTINCT comments.id)::int AS comment_count,
          EXISTS(
            SELECT 1 FROM likes 
            WHERE likes.post_id = posts.id 
            AND likes.user_id = $2
          )::boolean AS liked_by_me,
          json_build_object(
            'id', videos.id,
            'original_filename', videos.original_filename,
            'duration', videos.duration,
            'width', videos.width,
            'height', videos.height,
            'mime_type', videos.mime_type,
            'file_size', videos.file_size
          ) AS video
        FROM posts
        JOIN users ON users.id = posts.user_id
        LEFT JOIN likes ON likes.post_id = posts.id
        LEFT JOIN comments ON comments.post_id = posts.id
        LEFT JOIN videos ON videos.post_id = posts.id
        WHERE posts.id = $1
        GROUP BY posts.id, users.id, videos.id`,
        [post.id, req.user.id]
      );

      res.status(201).json({
        post: fullPost.rows[0],
      });
    } catch (error) {
      console.error("Create post error:", error);

      // Clean up on error
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      res.status(500).json({
        error: "Failed to create post.",
      });
    }
  });

  // GET FEED
  router.get("/", async (req, res) => {
    try {
      const userId = req.headers.authorization
        ? jwt.verify(req.headers.authorization.split(" ")[1], process.env.JWT_SECRET).id
        : null;

      const result = await pool.query(
        `SELECT
          posts.id,
          posts.content,
          posts.created_at,
          users.id AS user_id,
          users.username,
          users.display_name,
          users.avatar_url,
          COUNT(DISTINCT likes.post_id)::int AS like_count,
          COUNT(DISTINCT comments.id)::int AS comment_count,
          EXISTS(
            SELECT 1 FROM likes 
            WHERE likes.post_id = posts.id 
            AND likes.user_id = $1
          )::boolean AS liked_by_me,
          json_build_object(
            'id', videos.id,
            'original_filename', videos.original_filename,
            'duration', videos.duration,
            'width', videos.width,
            'height', videos.height,
            'mime_type', videos.mime_type,
            'file_size', videos.file_size
          ) AS video
        FROM posts
        JOIN users ON users.id = posts.user_id
        LEFT JOIN likes ON likes.post_id = posts.id
        LEFT JOIN comments ON comments.post_id = posts.id
        LEFT JOIN videos ON videos.post_id = posts.id
        GROUP BY posts.id, users.id, videos.id
        ORDER BY posts.created_at DESC
        LIMIT 50`,
        [userId || null]
      );

      res.json({
        posts: result.rows,
      });
    } catch (error) {
      console.error("Get posts error:", error);

      res.status(500).json({
        error: "Failed to load posts.",
      });
    }
  });

  // GET VIDEO METADATA
  router.get("/:postId/video", async (req, res) => {
    try {
      const { postId } = req.params;

      const result = await pool.query(
        `SELECT 
          id,
          original_filename,
          filen_file_id,
          filen_path,
          duration,
          width,
          height,
          mime_type,
          file_size
        FROM videos
        WHERE post_id = $1`,
        [postId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: "Video not found.",
        });
      }

      res.json({
        video: result.rows[0],
      });
    } catch (error) {
      console.error("Get video error:", error);

      res.status(500).json({
        error: "Failed to load video.",
      });
    }
  });

  // STREAM VIDEO
  router.get("/:postId/video/stream", async (req, res) => {
    try {
      const { postId } = req.params;

      const result = await pool.query(
        `SELECT filen_file_id FROM videos WHERE post_id = $1`,
        [postId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: "Video not found.",
        });
      }

      const videoUrl = await getVideoUrl(result.rows[0].filen_file_id);

      res.json({
        url: videoUrl,
      });
    } catch (error) {
      console.error("Stream video error:", error);

      res.status(500).json({
        error: "Failed to get video URL.",
      });
    }
  });

  // DELETE OWN POST
  router.delete("/:id", authenticate, async (req, res) => {
    try {
      // Get video info if exists
      const videoResult = await pool.query(
        `SELECT filen_file_id FROM videos WHERE post_id = $1`,
        [req.params.id]
      );

      // Delete from database
      const result = await pool.query(
        `DELETE FROM posts
         WHERE id = $1
         AND user_id = $2
         RETURNING id`,
        [req.params.id, req.user.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: "Post not found.",
        });
      }

      // Delete video from Filen if exists
      if (videoResult.rows.length > 0) {
        try {
          await deleteVideo(videoResult.rows[0].filen_file_id);
        } catch (error) {
          console.error("Failed to delete video from Filen:", error);
          // Don't fail the request if Filen deletion fails
        }
      }

      res.json({
        message: "Post deleted.",
      });
    } catch (error) {
      console.error("Delete post error:", error);

      res.status(500).json({
        error: "Failed to delete post.",
      });
    }
  });

  // LIKE POST
  router.post("/:id/like", authenticate, async (req, res) => {
    try {
      const postId = req.params.id;
      const userId = req.user.id;

      // Check if post exists
      const postCheck = await pool.query(`SELECT id FROM posts WHERE id = $1`, [postId]);

      if (postCheck.rows.length === 0) {
        return res.status(404).json({
          error: "Post not found.",
        });
      }

      // Try to insert like
      await pool.query(
        `INSERT INTO likes (user_id, post_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [userId, postId]
      );

      res.json({ message: "Post liked." });
    } catch (error) {
      console.error("Like post error:", error);

      res.status(500).json({
        error: "Failed to like post.",
      });
    }
  });

  // UNLIKE POST
  router.delete("/:id/like", authenticate, async (req, res) => {
    try {
      const postId = req.params.id;
      const userId = req.user.id;

      await pool.query(
        `DELETE FROM likes
         WHERE post_id = $1 AND user_id = $2`,
        [postId, userId]
      );

      res.json({ message: "Post unliked." });
    } catch (error) {
      console.error("Unlike post error:", error);

      res.status(500).json({
        error: "Failed to unlike post.",
      });
    }
  });

  // GET COMMENTS
  router.get("/:id/comments", async (req, res) => {
    try {
      const postId = req.params.id;

      const result = await pool.query(
        `SELECT
          comments.id,
          comments.content,
          comments.created_at,
          comments.user_id,
          users.username,
          users.display_name,
          users.avatar_url
        FROM comments
        JOIN users ON users.id = comments.user_id
        WHERE comments.post_id = $1
        ORDER BY comments.created_at DESC`,
        [postId]
      );

      res.json({
        comments: result.rows,
      });
    } catch (error) {
      console.error("Get comments error:", error);

      res.status(500).json({
        error: "Failed to load comments.",
      });
    }
  });

  // CREATE COMMENT
  router.post("/:id/comments", authenticate, async (req, res) => {
    try {
      const postId = req.params.id;
      const content = String(req.body.content || "").trim();

      if (!content) {
        return res.status(400).json({
          error: "Comment cannot be empty.",
        });
      }

      if (content.length > 300) {
        return res.status(400).json({
          error: "Comment cannot exceed 300 characters.",
        });
      }

      // Check if post exists
      const postCheck = await pool.query(`SELECT id FROM posts WHERE id = $1`, [postId]);

      if (postCheck.rows.length === 0) {
        return res.status(404).json({
          error: "Post not found.",
        });
      }

      const result = await pool.query(
        `INSERT INTO comments (post_id, user_id, content)
         VALUES ($1, $2, $3)
         RETURNING id, post_id, user_id, content, created_at`,
        [postId, req.user.id, content]
      );

      const comment = result.rows[0];

      // Get full comment data with user info
      const fullComment = await pool.query(
        `SELECT
          comments.id,
          comments.content,
          comments.created_at,
          comments.user_id,
          users.username,
          users.display_name,
          users.avatar_url
        FROM comments
        JOIN users ON users.id = comments.user_id
        WHERE comments.id = $1`,
        [comment.id]
      );

      res.status(201).json({
        comment: fullComment.rows[0],
      });
    } catch (error) {
      console.error("Create comment error:", error);

      res.status(500).json({
        error: "Failed to create comment.",
      });
    }
  });

  // DELETE COMMENT
  router.delete("/comments/:id", authenticate, async (req, res) => {
    try {
      const commentId = req.params.id;

      const result = await pool.query(
        `DELETE FROM comments
         WHERE id = $1
         AND user_id = $2
         RETURNING id`,
        [commentId, req.user.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: "Comment not found.",
        });
      }

      res.json({
        message: "Comment deleted.",
      });
    } catch (error) {
      console.error("Delete comment error:", error);

      res.status(500).json({
        error: "Failed to delete comment.",
      });
    }
  });

  return router;
}

module.exports = createRouter;
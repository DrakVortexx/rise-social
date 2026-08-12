-- ============================================================
-- RISE DATABASE SCHEMA
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ============================================================
-- USERS
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    username VARCHAR(30) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,

    display_name VARCHAR(50) NOT NULL,
    bio VARCHAR(160) DEFAULT '',
    avatar_url TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- POSTS
-- ============================================================

CREATE TABLE IF NOT EXISTS posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    content VARCHAR(500) NOT NULL,

    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- FOLLOWERS
-- ============================================================

CREATE TABLE IF NOT EXISTS followers (
    follower_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    following_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    PRIMARY KEY (follower_id, following_id),

    -- Prevent users from following themselves
    CHECK (follower_id != following_id)
);


-- ============================================================
-- LIKES
-- ============================================================

CREATE TABLE IF NOT EXISTS likes (
    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    post_id UUID NOT NULL
        REFERENCES posts(id)
        ON DELETE CASCADE,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    PRIMARY KEY (user_id, post_id)
);


-- ============================================================
-- COMMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    post_id UUID NOT NULL
        REFERENCES posts(id)
        ON DELETE CASCADE,

    content VARCHAR(500) NOT NULL,

    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- INDEXES
-- ============================================================

-- Makes newest-post queries faster
CREATE INDEX IF NOT EXISTS posts_created_at_idx
ON posts(created_at DESC);

-- Makes finding a user's posts faster
CREATE INDEX IF NOT EXISTS posts_user_id_idx
ON posts(user_id);

-- Makes finding someone's followers faster
CREATE INDEX IF NOT EXISTS followers_following_idx
ON followers(following_id);

-- Makes finding who someone follows faster
CREATE INDEX IF NOT EXISTS followers_follower_idx
ON followers(follower_id);

-- Makes finding comments on a post faster
CREATE INDEX IF NOT EXISTS comments_post_id_idx
ON comments(post_id);


-- ============================================================
-- DONE
-- ============================================================
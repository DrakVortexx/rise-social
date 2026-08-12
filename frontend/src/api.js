const API_URL = "https://rise-social.onrender.com";

async function request(endpoint, options = {}) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Something went wrong.");
  }

  return data;
}

export function signup(data) {
  return request("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function login(data) {
  return request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function getMe(token) {
  return request("/api/auth/me", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

// POSTS

export function getPosts() {
  return request("/api/posts");
}

export function createPost(content, token, videoFile = null) {
  if (!videoFile) {
    return request("/api/posts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        content,
      }),
    });
  }

  // If video file is provided, use FormData
  const formData = new FormData();
  formData.append("content", content);
  formData.append("video", videoFile);

  return fetch(`${API_URL}/api/posts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  }).then(async (response) => {
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Something went wrong.");
    }
    return data;
  });
}

export function deletePost(id, token) {
  return request(`/api/posts/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function likePost(id, token) {
  return request(`/api/posts/${id}/like`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function unlikePost(id, token) {
  return request(`/api/posts/${id}/like`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function getComments(id) {
  return request(`/api/posts/${id}/comments`);
}

export function createComment(id, content, token) {
  return request(`/api/posts/${id}/comments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ content }),
  });
}

export function deleteComment(id, token) {
  return request(`/api/posts/comments/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

// USERS

export function searchUsers(query) {
  return request(`/api/users/search?q=${encodeURIComponent(query)}`);
}

export function getProfile(username) {
  return request(`/api/users/${username}`);
}

export function getUserPosts(username, token) {
  return request(`/api/users/${username}/posts`, {
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : {},
  });
}

export function updateProfile(data, token) {
  return request("/api/users/me/profile", {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
}

export function followUser(username, token) {
  return request(`/api/users/${username}/follow`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function unfollowUser(username, token) {
  return request(`/api/users/${username}/follow`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

// VIDEOS

export function getVideoMetadata(postId) {
  return request(`/api/posts/${postId}/video`);
}

export function getVideoUrl(postId) {
  return request(`/api/posts/${postId}/video/stream`);
}
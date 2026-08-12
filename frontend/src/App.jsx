import { useState } from "react";
import {
  Home,
  Search,
  Bell,
  User,
  Plus,
  Heart,
  MessageCircle,
  Repeat2,
} from "lucide-react";
import "./App.css";

const posts = [
  {
    id: 1,
    user: "Alex",
    handle: "@alex",
    avatar: "A",
    text: "Just joined RISE 🚀 What should I post first?",
    likes: 128,
    comments: 14,
  },
  {
    id: 2,
    user: "Nova",
    handle: "@nova",
    avatar: "N",
    text: "The fastest-growing creators are showing up on RISE 🔥",
    likes: 542,
    comments: 37,
  },
];

function App() {
  const [liked, setLiked] = useState({});

  const toggleLike = (id) => {
    setLiked((current) => ({
      ...current,
      [id]: !current[id],
    }));
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="logo">RISE</div>

        <div className="search">
          <Search size={18} />
          <input placeholder="Search RISE" />
        </div>

        <div className="top-actions">
          <button>
            <Bell size={20} />
          </button>

          <button className="profile-button">
            <User size={18} />
            <span>Profile</span>
          </button>
        </div>
      </header>

      <div className="layout">
        <aside className="sidebar">
          <nav>
            <a className="active">
              <Home size={20} />
              Home
            </a>

            <a>
              <Search size={20} />
              Explore
            </a>

            <a>
              <Bell size={20} />
              Notifications
            </a>

            <a>
              <User size={20} />
              Profile
            </a>
          </nav>

          <button className="create-button">
            <Plus size={20} />
            Create Post
          </button>
        </aside>

        <main className="feed">
          <div className="feed-header">
            <div>
              <h1>Home</h1>
              <p>See what people are posting on RISE.</p>
            </div>
          </div>

          <div className="composer">
            <div className="avatar">D</div>

            <div className="composer-content">
              <textarea placeholder="What's happening?" />

              <div className="composer-bottom">
                <span>Share something with your followers.</span>
                <button>Post</button>
              </div>
            </div>
          </div>

          {posts.map((post) => (
            <article className="post" key={post.id}>
              <div className="post-header">
                <div className="avatar">{post.avatar}</div>

                <div>
                  <strong>{post.user}</strong>
                  <span>{post.handle}</span>
                </div>
              </div>

              <p className="post-text">{post.text}</p>

              <div className="post-actions">
                <button
                  className={liked[post.id] ? "liked" : ""}
                  onClick={() => toggleLike(post.id)}
                >
                  <Heart
                    size={19}
                    fill={liked[post.id] ? "currentColor" : "none"}
                  />
                  {post.likes + (liked[post.id] ? 1 : 0)}
                </button>

                <button>
                  <MessageCircle size={19} />
                  {post.comments}
                </button>

                <button>
                  <Repeat2 size={19} />
                  Share
                </button>
              </div>
            </article>
          ))}
        </main>

        <aside className="rightbar">
          <div className="card">
            <h2>🔥 Trending Creators</h2>

            <div className="creator">
              <div className="avatar">N</div>
              <div>
                <strong>Nova</strong>
                <span>@nova</span>
              </div>
              <button>Follow</button>
            </div>

            <div className="creator">
              <div className="avatar">A</div>
              <div>
                <strong>Alex</strong>
                <span>@alex</span>
              </div>
              <button>Follow</button>
            </div>

            <a className="see-more">See more</a>
          </div>

          <div className="card">
            <h2>📈 Your Growth</h2>
            <div className="growth-number">+0</div>
            <p>followers this week</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default App;
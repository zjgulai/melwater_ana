module.exports = {
  apps: [
    {
      name: "melwater-review-state-api",
      script: "server/reviewStateServer.mjs",
      cwd: "/opt/melwater/playbook-pain-radar-lab",
      interpreter: "node",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        HOST: "127.0.0.1",
        REVIEW_STATE_PORT: "4174",
        REVIEW_STATE_DIR: "/var/lib/melwater/review-state",
        REVIEW_STATE_CORS_ORIGIN: "https://melwater.example.com",
      },
    },
  ],
};

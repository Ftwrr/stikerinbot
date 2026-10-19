module.exports = {
  apps: [
    {
      name: "ambatron",
      script: "./index.js",
      interpreter: "bun",
      cwd: "/opt/ambatron",
      env: {
        SESSION_DIR: "session_auth"
      }
    }
  ]
};

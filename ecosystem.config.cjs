module.exports = {
  apps: [
    {
      name: "stikerinbot",
      script: "./index.js",
      interpreter: "bun",
      cwd: "/opt/stikerinbot",
      env: {
        SESSION_DIR: "session_auth"
      }
    }
  ]
};

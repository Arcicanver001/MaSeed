# Smart Greenhouse Remote Dashboard

Remote dashboard for monitoring and controlling greenhouse actuators. The project combines a static web dashboard (HTML/CSS/JS) with a Node.js + Firebase API located in `server`.

## Repository Structure

- `index.html`, `login.html`, `profile.html` – main dashboard pages.
- `css/`, `js/`, `assets/` – front-end styles, scripts, and static assets.
- `server/` – Node.js API using Firebase Realtime Database for historical data.
- `start_remote_dashboard.bat` – Windows helper that launches the API and opens the dashboard.
- `scripts/` – extra utilities (Linux helpers, MQTT tests).

## Prerequisites

- Node.js 18+ installed locally.
- Firebase project configured (see `server/firebase-config.js`).
- Git for version control.

## Local Development

1. **Install dependencies**
   ```powershell
   npm install
   npm --prefix server install
   ```
2. **Run the API locally**
   ```powershell
   cd server
   node server.js
   ```
3. **Launch the dashboard**
   - Open `login.html` directly in the browser, or
   - Run `start_remote_dashboard.bat` to start the API in a new terminal and open the login page.
4. **Point the front-end at your API**
   - The default API base URL is `http://localhost:8080/api`.
   - Use the settings panel inside the dashboard to change the API URL when testing against a remote server.

## Preparing for GitHub

1. **Clean the working tree**  
   Commit only source files—`node_modules/` and environment files are excluded by `.gitignore`.
2. **Create a new repository**
   ```powershell
   git init
   git branch -M main
   git remote add origin https://github.com/<your-org>/<repo-name>.git
   ```
3. **Commit and push**
   ```powershell
   git add .
   git commit -m "Initial commit"
   git push -u origin main
   ```

## Hosting Options for Mobile Access

### 1. Host the Front-End

- **GitHub Pages:**  
  - Move static site files into the `docs/` directory or configure the Pages branch in repo settings.  
  - Push to GitHub; enable Pages via `Settings → Pages`.  
  - Access the dashboard at `https://<username>.github.io/<repo>/login.html`.
- **Other Static Hosts:** Netlify, Vercel, or any S3-compatible bucket can serve the HTML/CSS/JS files without changes.

### 2. Expose the API

The Firebase-backed API must be reachable over the internet for phones to load data.

- **Cloud VM (Azure, AWS, GCP, etc.)**  
  Deploy the contents of `server/`, install Node.js, configure Firebase credentials, and run `node server.js`. Open TCP port `8080` or whichever port the API listens on.

- **Platform-as-a-Service**  
  Services like Render, Railway, or Fly.io can run Node.js apps. The Firebase database is cloud-hosted, so no local database files are needed.

- **Tunneling (quick demo)**  
  Use `ngrok`, `cloudflared`, or `localtunnel` to expose your local API temporarily:
  ```powershell
  ngrok http 8080
  ```
  Update the dashboard’s API base URL to the forwarded domain.

### 3. Configure CORS

Ensure the API allows cross-origin requests from the domain where you host the front-end. Adjust the CORS middleware in `server/server.js` as needed.

### 4. Update the Front-End Base URL

On first load, the dashboard attempts `http://localhost:8080/api`. For mobile use:

1. Open the dashboard on your phone.
2. Navigate to `Settings`.
3. Enter the public API URL (e.g., `https://your-domain.com/api`).
4. Save; the new setting persists in local storage.

## Testing Checklist

- [ ] Front-end loads on desktop and mobile.
- [ ] API responds over the public URL (test with `curl`/Postman).
- [ ] Login flow and authenticated routes work with remote API.
- [ ] WebSockets/MQTT integrations (if used) reach your broker.
- [ ] No hard-coded `localhost` URLs remain in production configuration.

## Next Steps

- Automate deployment with GitHub Actions (optional).
- Set up HTTPS certificates for your API host.
- Add monitoring/log forwarding for the Node server.

For questions or setup issues, please open an issue on the GitHub repository once published.


# 1. Choose a base Node.js image that includes tools to install dependencies
FROM node:18-slim

# 2. Install system dependencies needed for Puppeteer/chrome-aws-lambda
# This is where you put the libraries. The exact list can vary.
# chrome-aws-lambda tries to bundle many, but sometimes a few are still needed.
# Start with a minimal set and add if Render's build logs show missing .so files.
RUN apt-get update && apt-get install -yq \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdbus-1-3 \
    # libdrm2 \ # Often bundled or not strictly needed with chrome-aws-lambda
    libgbm1 \
    # libgtk-3-0 \ # Usually for non-headless, might not be needed
    libnspr4 \
    libnss3 \
    libx11-6 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libxtst6 \
    ca-certificates \
    fonts-liberation \
    # lsb-release \ # Usually not needed inside container
    # xdg-utils \ # Usually not needed
    # wget \ # Only if you need to wget something during build
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# 3. Set up the application directory
WORKDIR /usr/src/app

# 4. Copy package.json and package-lock.json (or yarn.lock)
COPY package*.json ./
# COPY yarn.lock ./ # If using Yarn

# 5. Install application dependencies (using puppeteer-core and chrome-aws-lambda)
RUN npm install --production
# RUN yarn install --production # If using Yarn

# 6. Copy the rest of your application code
COPY . .

# 7. Expose the port your app runs on
EXPOSE 3000

# 8. Define the command to run your application
CMD [ "node", "index.js" ]
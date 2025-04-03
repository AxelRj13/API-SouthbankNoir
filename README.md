# API-Southbank-Noir

## Table of Contents
- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Installation](#installation)
- [Running the API](#running-the-api)
  - [Using PM2](#using-pm2)
  - [Running Locally](#running-locally)

## Overview
This project is an API built using **Sails.js** on **Node.js**. It is designed to run efficiently with PM2 for background processing. Below are the steps required to install and run the API seamlessly.

---

## Tech Stack
The API is built using the following technologies:

### **Backend Framework**
- **Node.js** - Version **10.24.0**
- **Sails.js** - Version **1.5.4**

### **Tools**
- **Postman** – Used for testing API requests and responses.
- **PM2** (Version **5.3.1**) – Process manager for running the API in the background.
- **NPM** (Version **10.5.0**) – Package manager for installing dependencies.

---

## Installation
Follow these steps to set up the API on your local machine:

1. Ensure the following are installed:
   - **Git**
   - **Node.js (v10.24.0)**
   - **PM2 (v5.3.1)**
   - **NPM (v10.5.0)**

2. Clone the repository:
   ```sh
   git clone <repository_url>
   ```

3. Navigate to the project directory:
   ```sh
   cd API-Southbank-Noir
   ```

4. Install dependencies:
   ```sh
   npm install
   ```
   Ensure that you're using **Node.js v10.24.0** to avoid compatibility issues.

---

## Running the API

### **Using PM2** (Recommended)
To run the API in the background using **PM2**, execute the following command:

```sh
export NODE_ENV=staging && pm2 start node /var/www/API-Southbank-Noir/app.js --name="API-SouthbankNoir" -i max
```

This command:
- Sets the environment to **staging**.
- Starts the API process in the background using **PM2**.
- Utilizes all available CPU cores for maximum efficiency.

The API will be accessible at:
```
http://localhost:8888/api/v1/
```
(*Port number depends on the environment configuration*)

### **Running Locally (Without PM2)**
If you prefer to run the API without **PM2**, use the following command:

```sh
node app.js
```

This will start the API in the foreground. However, the terminal session must remain open as long as the API is needed.

The API will be accessible at:
```
http://localhost:30003/api/v1/
```

---

## Additional Notes
- Ensure the correct **Node.js** version is used to prevent compatibility issues.
- PM2 is recommended for production environments as it allows process management and load balancing.
- API endpoints and environment configurations should be adjusted based on the target deployment environment.

---

### 🎯 Happy Coding!


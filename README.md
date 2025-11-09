# FlowSync

**FlowSync** is a personal pet project with a **Nest.js** backend, **React/Vite** frontend, **MySQL** database, and **Docker** support for local development and production deployment.  
The project also has **CI/CD** configured via GitHub Actions.

---

## Table of Contents

1. [Features](#features)
2. [Technologies](#technologies)
3. [Project Structure](#project-structure)
4. [Local Development](#local-development)
5. [Production Deployment](#production-deployment)
6. [CI/CD](#cicd)
7. [Docker Images](#docker-images)
8. [Environment Configuration](#environment-configuration)
9. [Contributing](#contributing)
10. [License](#license)

---

## Features

- **Backend:** Nest.js with TypeScript
- **Frontend:** React + Vite
- **Database:** MySQL
- **Docker:** for local development and production
- Easy switching between **dev** and **prod** environments
- **CI/CD:** GitHub Actions for building and pushing Docker images

---

## Technologies

- Node.js 20
- Nest.js 10
- React 18 + Vite 5
- MySQL 8
- Docker / Docker Compose
- GitHub Actions

---

## Project Structure
flowsync/
├─ back/ # Nest.js backend
│ ├─ src/
│ ├─ package.json
│ ├─ Dockerfile
│ └─ Dockerfile.dev
├─ front/ # React/Vite frontend
│ ├─ src/
│ ├─ package.json
│ ├─ Dockerfile
│ └─ Dockerfile.dev
├─ docker-compose.yml
├─ docker-compose.override.yml
└─ .github/workflows/ci-cd.yml
---

## Local Development

1. Make sure **Docker** and **Docker Compose** are installed.
2. Clone the repository:


git clone https://github.com/BurlakaM/flowsync
cd flowsync

Start the local development environment:

docker compose up --build

React: http://localhost:5173

Nest.js API: http://localhost:3000

MySQL: localhost:3306 (user: root, password from .env)

Production Deployment
Build production images:

docker compose -f docker-compose.yml up --build -d
Access services:

React: http://localhost:8080

Nest.js API: http://localhost:3000

MySQL: localhost:3306

Environment variables are loaded from .env files. Switch between dev/prod by using different docker-compose files.

CI/CD
On push to main, GitHub Actions workflow builds and pushes Docker images to Docker Hub.

Requires GitHub secrets:

DOCKER_USERNAME — your Docker Hub username

DOCKER_PASSWORD — your Docker Hub password or access token

Workflow builds:

Backend image → ${DOCKER_USERNAME}/flowsync-back:latest

Frontend image → ${DOCKER_USERNAME}/flowsync-front:latest

Docker Images
Backend: Nest.js

Frontend: React/Vite

Database: MySQL 8

Local volumes are used for persistent MySQL data

Environment Configuration
Backend .env:

DATABASE_URL="mysql://root:rootpassword@db:3306/database_name"
SECRET_KEY=YOUR_SECRET_KEY
Frontend .env:


VITE_API_URL=http://localhost:3000
Use different .env files for dev/prod if needed.

Contributing
Fork the repository

Create a feature branch (git checkout -b feature/my-feature)

Commit your changes (git commit -m 'Add new feature')

Push to branch (git push origin feature/my-feature)

Create a Pull Request

License
This project is licensed under the MIT License.
<div align="center">

# ⚙️ BookNook Server

### REST API for **BookNook**, a small online library.

[![Live API](https://img.shields.io/badge/⚙️_Live_API-booknook--server--site.vercel.app-D97706?style=for-the-badge)](https://booknook-server-site.vercel.app/)
[![Client Site](https://img.shields.io/badge/🌐_Client_Site-book--nook--client--site.vercel.app-166534?style=for-the-badge)](https://book-nook-client-site.vercel.app/)

![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express.js-000000?style=flat-square&logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=flat-square&logo=mongodb&logoColor=white)
![JWT](https://img.shields.io/badge/JWT-jose-D97706?style=flat-square)
![Vercel](https://img.shields.io/badge/Deployed_on-Vercel-000000?style=flat-square&logo=vercel&logoColor=white)

**🔗 Live API:** [https://booknook-server-site.vercel.app](https://booknook-server-site.vercel.app/)

</div>

---

## 📖 Table of Contents

- [⚙️ BookNook Server](#️-booknook-server)
    - [REST API for **BookNook**, a small online library.](#rest-api-for-booknook-a-small-online-library)
  - [📖 Table of Contents](#-table-of-contents)
  - [🌿 About](#-about)
  - [✨ Features](#-features)
  - [🛠️ Tech Stack](#️-tech-stack)
  - [📡 API Endpoints](#-api-endpoints)
    - [Books](#books)
    - [My Books (books added by the logged-in user)](#my-books-books-added-by-the-logged-in-user)
    - [Borrows](#borrows)
    - [Example request](#example-request)
    - [Status codes](#status-codes)
  - [🗄️ Data Models](#️-data-models)
    - [`latestBooks`](#latestbooks)
    - [`myAddedBook`](#myaddedbook)
    - [`borrows`](#borrows-1)
  - [🔐 JWT Authentication](#-jwt-authentication)
  - [📁 Project Structure](#-project-structure)
  - [🚀 Getting Started](#-getting-started)
    - [Prerequisites](#prerequisites)
    - [Installation](#installation)
  - [🔑 Environment Variables](#-environment-variables)
  - [☁️ Deployment](#️-deployment)
  - [🔗 Related Repository](#-related-repository)
  - [📬 Contact](#-contact)

---

## 🌿 About

This is the **server side** of **BookNook**. It is built with **Express.js** and **MongoDB** and provides the API for books, user-added books and borrows.

Users sign in on the Next.js client with **Better Auth**. For protected routes, the client sends a **JWT** and this server verifies it, so each user can only read and change their own data.

---

## ✨ Features

- 📚 Public endpoints for the latest books and the full book list.
- 🔒 **JWT verification** with `jose` against the Better Auth JWKS endpoint.
- 🆕 `latestBooks` endpoint uses `sort` and `limit` in MongoDB to return the 6 newest books.
- 👤 **Owner-only updates and deletes.** Queries are filtered by the verified email from the token, so one user cannot change another user's book.
- 📥 **Borrow system** with a 14 day loan, and the book details (title, image) are read from the database instead of trusting the client.
- 🚫 **No double borrow.** A user cannot borrow the same book twice while it is still borrowed.
- 📤 Returning a book removes the borrow record.
- ✅ Input validation with clear status codes (`400`, `401`, `404`, `409`, `500`).
- 🌐 CORS enabled and ready for Vercel deployment.

---

## 🛠️ Tech Stack

| Category | Technology |
| --- | --- |
| **Runtime** | Node.js |
| **Framework** | Express.js |
| **Database** | MongoDB Atlas (official driver) |
| **Auth verification** | `jose` (JWT and remote JWKS) |
| **Other** | `cors`, `dotenv`, `nodemon` (dev) |
| **Hosting** | Vercel |

---

## 📡 API Endpoints

**Base URL:** `https://booknook-server-site.vercel.app`

### Books

| Method | Endpoint | Description | Auth |
| --- | --- | --- | --- |
| `GET` | `/` | Server health check | Public |
| `GET` | `/latestBooks` | Latest 6 books, newest first | Public |
| `GET` | `/allbooks` | All books | Public |
| `GET` | `/allbooks/:id` | One book by ID | 🔒 JWT |
| `POST` | `/allbooks` | Add a book to the main collection | Public |

### My Books (books added by the logged-in user)

| Method | Endpoint | Description | Auth |
| --- | --- | --- | --- |
| `POST` | `/my-books` | Add a book (owner email comes from the token) | 🔒 JWT |
| `GET` | `/my-books` | Get the logged-in user's books | 🔒 JWT |
| `PUT` | `/my-books/:id` | Update a book (owner only) | 🔒 JWT |
| `DELETE` | `/my-books/:id` | Delete a book (owner only) | 🔒 JWT |

### Borrows

| Method | Endpoint | Description | Auth |
| --- | --- | --- | --- |
| `POST` | `/borrows` | Borrow a book | See note |
| `GET` | `/borrows?email=` | Get one user's borrowed books | See note |
| `DELETE` | `/borrows/:id?email=` | Return a book | See note |

> 📝 **Note:** the `/allbooks` write route and the `/borrows` routes currently identify the user from the request. Moving them to `verifyToken` and `req.user.email` is the same pattern used by `/my-books`.

### Example request

```bash
curl https://booknook-server-site.vercel.app/my-books \
  -H "Authorization: Bearer <your_jwt_token>"
```

### Status codes

| Code | Meaning |
| --- | --- |
| `200` / `201` | Success / created |
| `400` | Invalid ID or missing fields |
| `401` | Missing, invalid or expired token |
| `404` | Book or record not found |
| `409` | Book already borrowed by this user |
| `500` | Server error |

---

## 🗄️ Data Models

**Database:** `BooksForBooknook`

### `latestBooks`

```json
{
  "_id": "ObjectId",
  "title": "Clean Code",
  "author": "Robert C. Martin",
  "category": "Technology",
  "image": "https://...",
  "description": "A handbook of agile software craftsmanship."
}
```

### `myAddedBook`

```json
{
  "_id": "ObjectId",
  "title": "string",
  "author": "string",
  "category": "Fiction | Science | History | Kids | Others",
  "image": "string (imgbb URL)",
  "description": "string",
  "userName": "string",
  "userEmail": "string (from verified JWT)",
  "addedAt": "Date",
  "updatedAt": "Date (set on update)"
}
```

### `borrows`

```json
{
  "_id": "ObjectId",
  "bookId": "string",
  "bookTitle": "string",
  "bookImage": "string",
  "userName": "string",
  "userEmail": "string",
  "borrowDate": "Date",
  "returnDate": "Date (borrow date + 14 days)",
  "status": "borrowed"
}
```

---

## 🔐 JWT Authentication

1. The user logs in on the client with **Better Auth**.
2. The client asks Better Auth for a token and sends it as `Authorization: Bearer <token>`.
3. The `verifyToken` middleware checks the signature with `jose`, using the remote key set at `CLIENT_URL/api/auth/jwks`, and also checks the issuer and audience.
4. On success, the payload is saved to `req.user`, and routes use `req.user.email` as the trusted identity.
5. On failure, the server replies with `401`.

```js
const JWKS = createRemoteJWKSet(new URL(`${process.env.CLIENT_URL}/api/auth/jwks`));

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return res.status(401).send({ message: "Unauthorized access" });

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: process.env.CLIENT_URL,
      audience: process.env.CLIENT_URL,
    });
    req.user = payload;
    next();
  } catch {
    res.status(401).send({ message: "Invalid or expired token" });
  }
};
```

---

## 📁 Project Structure

```text
book-nook-server-site/
├── index.js          # Express app, middleware, MongoDB connection, all routes
├── vercel.json       # Vercel deployment config
├── package.json
├── .env              # Environment variables (not committed)
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 20 or newer
- A MongoDB Atlas cluster
- The [BookNook client](#-related-repository) running, because the server reads its JWKS endpoint

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/Partho-Mukherjee2003/book-nook-server-site.git

# 2. Go into the project
cd book-nook-server-site

# 3. Install dependencies
npm install

# 4. Create your .env file (see the next section)

# 5. Start the server
nodemon index.js
```

The server runs on [http://localhost:5000](http://localhost:5000).

---

## 🔑 Environment Variables

Create a `.env` file in the project root:

```env
PORT=5000
MONGODB_USERNAME=your_mongodb_username
MONGODB_PASSWORD=your_mongodb_password

# URL of the deployed Next.js client (used for JWKS, issuer and audience)
CLIENT_URL=http://localhost:3000
```

> ⚠️ `CLIENT_URL` must exactly match the client's `BETTER_AUTH_URL`, with no trailing slash. Otherwise token verification fails with `401`.
> Never commit your `.env` file.

---

## ☁️ Deployment

Deployed on **Vercel**.

1. Export the app with `export default app` and only call `app.listen` outside Vercel.
2. Add `vercel.json`:

```json
{
  "version": 2,
  "builds": [{ "src": "index.js", "use": "@vercel/node" }],
  "routes": [{ "src": "/(.*)", "dest": "index.js" }]
}
```

3. Add the environment variables in Vercel, using the production `CLIENT_URL`:

```bash
vercel env add MONGODB_USERNAME production
vercel env add MONGODB_PASSWORD production
vercel env add CLIENT_URL production
vercel --prod
```

4. In MongoDB Atlas, allow network access from Vercel (`0.0.0.0/0`).

---

## 🔗 Related Repository

| Repository | Description |
| --- | --- |
| **Client** | [book-nook-client-site](https://github.com/Partho-Mukherjee2003/book-nook-client-site), the Next.js front end |
| **Server** (this repo) | Express and MongoDB API |

---

## 📬 Contact

**Partho Mukherjee**

📧 Email: [parthomukherjee582@gmail.com](mailto:parthomukherjee582@gmail.com)
🌐 Live site: [book-nook-client-site.vercel.app](https://book-nook-client-site.vercel.app/)

---

<div align="center">

Made with 💚 for readers everywhere.

</div>

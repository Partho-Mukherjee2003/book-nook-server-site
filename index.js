import express from "express";
import { MongoClient, ObjectId } from "mongodb";
import "dotenv/config";
import cors from "cors";
import { createRemoteJWKSet, jwtVerify } from "jose";


const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());
//middleware function
const JWKS = createRemoteJWKSet(
  new URL(`${process.env.CLIENT_URL}/api/auth/jwks`),
);

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token) {
    return res.status(401).send({ message: "Unauthorized access" });
  }

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: process.env.CLIENT_URL,
      audience: process.env.CLIENT_URL,
    });
    req.user = payload; // payload.email is verified
    next();
  } catch (err) {
    console.error("JWT verify failed:", err.message);
    return res.status(401).send({ message: "Invalid or expired token" });
  }
};
//                         ***MongoDB connection***
const client = new MongoClient(
  `mongodb://${process.env.MONGODB_USERNAME}:${process.env.MONGODB_PASSWORD}@ac-2soslzi-shard-00-00.w0rm344.mongodb.net:27017,ac-2soslzi-shard-00-01.w0rm344.mongodb.net:27017,ac-2soslzi-shard-00-02.w0rm344.mongodb.net:27017/?ssl=true&replicaSet=atlas-13wds7-shard-0&authSource=admin`,
);

export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.dir(err);
  }
}
const mongoClient = await connectToMongoDB();
const db = mongoClient.db("BooksForBooknook");
const booksCollection = db.collection("latestBooks");
const borrowsCollection = db.collection("borrows"); // new collection
const myAddedBookCollection = db.collection("myAddedBook");


app.get("/", (req, res) => {
  res.send("Book nook server is running");
});

app.get("/latestBooks", async (req, res) => {
  try {
    const books = await booksCollection
      .find()
      .sort({ _id: -1 })
      .limit(6)
      .toArray();
    res.send(books);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Failed to fetch books" });
  }
});

app.get("/allbooks",  async (req, res) => {
  try {
    const books = await booksCollection.find().toArray();
    res.send(books);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Failed to fetch books" });
  }
});

app.post("/allbooks",  async (req, res) => {
  try {
    const newBook = req.body;
    const result = await booksCollection.insertOne(newBook);

    res.send({
      success: true,
      message: "Book added successfully",
      insertedId: result.insertedId,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({ success: false, message: "Failed to add book" });
  }
});

app.get("/allbooks/:id",
verifyToken
,async (req, res) => {

  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid book id" });
    }

    const book = await booksCollection.findOne({ _id: new ObjectId(id) });

    if (!book) {
      return res.status(404).send({ message: "Book not found" });
    }

    res.send(book);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Failed to fetch book" });
  }
});

//                         ***Borrow routes***

// Create a borrow record
app.post("/borrows", async (req, res) => {
  try {
    const { bookId, userName, userEmail } = req.body;

    // 1. Validate input
    if (!bookId || !userEmail) {
      return res
        .status(400)
        .send({ success: false, message: "bookId and userEmail are required" });
    }
    if (!ObjectId.isValid(bookId)) {
      return res
        .status(400)
        .send({ success: false, message: "Invalid book id" });
    }

    // 2. Make sure the book exists
    const book = await booksCollection.findOne({ _id: new ObjectId(bookId) });
    if (!book) {
      return res
        .status(404)
        .send({ success: false, message: "Book not found" });
    }

    // 3. Prevent borrowing the same book twice (until it's returned)
    const alreadyBorrowed = await borrowsCollection.findOne({
      bookId,
      userEmail,
      status: "borrowed",
    });
    if (alreadyBorrowed) {
      return res.status(409).send({
        success: false,
        message: "You have already borrowed this book",
      });
    }

    // 4. Build the record (dates are set on the server, 14-day loan)
    const borrowDate = new Date();
    const returnDate = new Date();
    returnDate.setDate(borrowDate.getDate() + 14);

    const borrow = {
      bookId, // stored as string, same as the frontend sends
      bookTitle: book.title, // taken from the DB, not trusted from the client
      bookImage: book.image,
      userName,
      userEmail,
      borrowDate,
      returnDate,
      status: "borrowed",
    };

    const result = await borrowsCollection.insertOne(borrow);

    res.status(201).send({
      success: true,
      message: "Book borrowed successfully",
      insertedId: result.insertedId,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({ success: false, message: "Failed to borrow book" });
  }
});

// Get a user's borrowed books (useful for a "My Borrows" page)
// Example: GET /borrows?email=user@example.com
app.get('/borrows', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).send({ message: 'email query is required' });
    }

    const borrowsBook = await borrowsCollection
      .find({ userEmail: email })
      .sort({ borrowDate: -1 })
      .toArray();

    res.send(borrowsBook);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Failed to fetch borrows" });
  }
});
// Return a book = remove the borrow record (only the owner can do this)
// DELETE /borrows/:id?email=user@example.com
app.delete("/borrows/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.query;

    if (!ObjectId.isValid(id) || !email) {
      return res
        .status(400)
        .send({ success: false, message: "Valid id and email are required" });
    }

    const result = await borrowsCollection.deleteOne({
      _id: new ObjectId(id),
      userEmail: email,
    });

    if (result.deletedCount === 0) {
      return res
        .status(404)
        .send({ success: false, message: "Borrow record not found" });
    }

    res.send({ success: true, message: "Book returned successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ success: false, message: "Failed to return book" });
  }
});
// Add a book
app.post("/my-books", verifyToken, async (req, res) => {
  try {
    const { title, author, category, image, description, userName } = req.body;
    const userEmail = req.user.email; // from the token

    if (!title || !author || !category || !image) {
      return res
        .status(400)
        .send({ success: false, message: "Missing required fields" });
    }

    const result = await myAddedBookCollection.insertOne({
      title,
      author,
      category,
      image,
      description: description || "",
      userName,
      userEmail,
      addedAt: new Date(),
    });

    res.status(201).send({
      success: true,
      message: "Book added successfully",
      insertedId: result.insertedId,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({ success: false, message: "Failed to add book" });
  }
});

// Get only the logged-in user's books
app.get("/my-books", verifyToken, async (req, res) => {
  try {
    const books = await myAddedBookCollection
      .find({ userEmail: req.user.email })
      .sort({ addedAt: -1 })
      .toArray();
    res.send(books);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Failed to fetch books" });
  }
});

// Update (owner only)
app.put("/my-books/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, author, category, image, description } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ success: false, message: "Invalid id" });
    }

    const result = await myAddedBookCollection.updateOne(
      { _id: new ObjectId(id), userEmail: req.user.email },
      {
        $set: {
          title,
          author,
          category,
          image,
          description: description || "",
          updatedAt: new Date(),
        },
      },
    );

    if (result.matchedCount === 0) {
      return res.status(404).send({ success: false, message: "Book not found" });
    }
    res.send({ success: true, message: "Book updated successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ success: false, message: "Failed to update book" });
  }
});

// Delete (owner only)
app.delete("/my-books/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ success: false, message: "Invalid id" });
    }

    const result = await myAddedBookCollection.deleteOne({
      _id: new ObjectId(id),
      userEmail: req.user.email,
    });

    if (result.deletedCount === 0) {
      return res.status(404).send({ success: false, message: "Book not found" });
    }
    res.send({ success: true, message: "Book deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ success: false, message: "Failed to delete book" });
  }
});

// Delete a book (only the owner can delete): DELETE /my-books/:id?email=...
app.delete("/my-books/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.query;

    if (!ObjectId.isValid(id) || !email) {
      return res
        .status(400)
        .send({ success: false, message: "Valid id and email are required" });
    }

    const result = await myAddedBookCollection.deleteOne({
      _id: new ObjectId(id),
      userEmail: email,
    });

    if (result.deletedCount === 0) {
      return res
        .status(404)
        .send({ success: false, message: "Book not found" });
    }

    res.send({ success: true, message: "Book deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ success: false, message: "Failed to delete book" });
  }
});


app.listen(port, () => {
  console.log(`Book nook server is running on port: ${port}`);
});

//http://localhost:5000
export default app

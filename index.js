import express from "express";
import { MongoClient, ObjectId } from "mongodb";
import "dotenv/config";
import cors from "cors";
import { jwtVerify, createRemoteJWKSet } from "jose";

const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

//******************* middleware function **************************
const verifyToken = async (req,res,next)=>{
  const authHeader = req.headers.authorization;
   console.log(authHeader);
  //console.log(req.method, req.originalUrl, req.headers.authorization);
  if (!authHeader) {
    return res.status(401).send({
      msg: "Unauthorized!!",
    });
  }
  const token = authHeader.split(" ")[1];
  console.log(token);
  if (!token) {
    return res.status(401).send({
      msg: "Unauthorized!!",
    });
  }
  //***************** verify token ************************/
  //http://localhost:3000/api/auth/jwks

  const JWKS = createRemoteJWKSet(
    new URL(`${process.env.CLIENT_URL}/api/auth/jwks`),
  );
  try{
    const { payload } = await jwtVerify(token,JWKS);
    next()
  }catch(error){
    console.log('error from backend token verify',error)
  }

}







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
const borrowsCollection = db.collection("borrows");

// Purano book-gulo-te copies field nei. Server chalu hole ekbar auto set hoye jay
// (je book-e age theke field ache segulo touch hoy na). Eta pore muche dite paro.
const DEFAULT_COPIES = 5;
try {
  const migrated = await booksCollection.updateMany(
    { availableCopies: { $exists: false } },
    { $set: { totalCopies: DEFAULT_COPIES, availableCopies: DEFAULT_COPIES } },
  );
  if (migrated.modifiedCount > 0) {
    console.log(`Set default copies on ${migrated.modifiedCount} old books`);
  }
} catch (err) {
  console.error("Copies migration failed:", err.message);
}

app.get("/", (req, res) => {
  res.send("Book nook server is running");
});

//                         ***Books routes***
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

app.get("/allbooks", async (req, res) => {
  try {
    const books = await booksCollection.find().toArray();
    res.send(books);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Failed to fetch books" });
  }
});

// Book details
app.get("/allbooks/:id",
  verifyToken,
  async (req, res) => {

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

    // 4. Copy kombano ($inc -1). Shudhu jodi availableCopies > 0 hoy,
    //    tai duijon ek shathe shesh copy nilew count 0-r niche jabe na.
    const decrement = await booksCollection.updateOne(
      { _id: new ObjectId(bookId), availableCopies: { $gt: 0 } },
      { $inc: { availableCopies: -1 } },
    );

    if (decrement.modifiedCount === 0) {
      return res.status(409).send({
        success: false,
        message: "Not available. All copies are borrowed.",
      });
    }

    // 5. Build the record (dates are set on the server, 14-day loan)
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

    let result;
    try {
      result = await borrowsCollection.insertOne(borrow);
    } catch (insertError) {
      // Record save na hole copy ferot dao
      await booksCollection.updateOne(
        { _id: new ObjectId(bookId) },
        { $inc: { availableCopies: 1 } },
      );
      throw insertError;
    }

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

// Get a user's borrowed books
// Example: GET /borrows?email=user@example.com
app.get("/borrows", async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).send({ message: "email query is required" });
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

// Return a book = remove the borrow record + copy ferot ($inc +1)
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

    const borrow = await borrowsCollection.findOne({
      _id: new ObjectId(id),
      userEmail: email,
    });

    if (!borrow) {
      return res
        .status(404)
        .send({ success: false, message: "Borrow record not found" });
    }

    await borrowsCollection.deleteOne({ _id: borrow._id });

    // Copy ferot ($inc +1)
    if (ObjectId.isValid(borrow.bookId)) {
      await booksCollection.updateOne(
        { _id: new ObjectId(borrow.bookId) },
        { $inc: { availableCopies: 1 } },
      );
    }

    res.send({ success: true, message: "Book returned successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ success: false, message: "Failed to return book" });
  }
});

//                         ***My Added Books routes***
// Book-gulo shob book-er shathe `latestBooks` collection-e-i thake.
// Je user add koreche tar naam ar email book-er sathe save hoy.

// Add a book
app.post("/my-books",verifyToken, async (req, res) => {
  try {
    const {
      title,
      author,
      category,
      image,
      description,
      userName,
      userEmail,
      totalCopies,
    } = req.body;

    if (!title || !author || !category || !image || !userEmail) {
      return res
        .status(400)
        .send({ success: false, message: "Missing required fields" });
    }

    const copies = Number(totalCopies);
    if (!Number.isInteger(copies) || copies < 1) {
      return res.status(400).send({
        success: false,
        message: "Total copies must be a whole number (1 or more)",
      });
    }

    const result = await booksCollection.insertOne({
      title,
      author,
      category,
      image,
      description: description || "",
      userName,
      userEmail,
      totalCopies: copies,
      availableCopies: copies, // shuru-te shob copy available
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

// Shudhu logged-in user-er add kora book
// GET /my-books?email=user@example.com
app.get("/my-books", async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).send({ message: "email query is required" });
    }

    const books = await booksCollection
      .find({ userEmail: email })
      .sort({ addedAt: -1 })
      .toArray();
    res.send(books);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Failed to fetch books" });
  }
});

// Update (shudhu je add koreche)
// PUT /my-books/:id?email=user@example.com
app.put("/my-books/:id", verifyToken ,async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.query;
    const { title, author, category, image, description } = req.body;

    if (!ObjectId.isValid(id) || !email) {
      return res
        .status(400)
        .send({ success: false, message: "Valid id and email are required" });
    }

    const result = await booksCollection.updateOne(
      { _id: new ObjectId(id), userEmail: email },
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
      return res
        .status(404)
        .send({ success: false, message: "Book not found" });
    }
    res.send({ success: true, message: "Book updated successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ success: false, message: "Failed to update book" });
  }
});

// Delete (shudhu je add koreche)
// DELETE /my-books/:id?email=user@example.com
app.delete("/my-books/:id",verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.query;

    if (!ObjectId.isValid(id) || !email) {
      return res
        .status(400)
        .send({ success: false, message: "Valid id and email are required" });
    }

    const result = await booksCollection.deleteOne({
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

// Vercel-e app.listen lagbe na, local-e lagbe
if (process.env.VERCEL !== "1") {
  app.listen(port, () => {
    console.log(`Book nook server is running on port: ${port}`);
  });
}

export default app;

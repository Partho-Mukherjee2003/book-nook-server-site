import express from "express";
import { MongoClient,ObjectId } from "mongodb";
import "dotenv/config";
import cors from "cors";

const app = express();
const port = process.env.PORT || 5000;

//middleware
app.use(cors());
app.use(express.json());

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
const borrowedBooksCollection = db.collection("borrowedBooks");

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
app.get("/allbooks", async (req, res) => {
  try {
    const books = await booksCollection.find().toArray();
    res.send(books);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Failed to fetch books" });
  }
});
app.post("/allbooks", async (req, res) => {
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

app.get("/allbooks/:id", async (req, res) => {
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

app.post("/borrowed", async (req, res) => {
  try {
    const borrowData = req.body;
    const { bookId } = borrowData;

    const book = await booksCollection.findOne({ _id: new ObjectId(bookId) });
    if (!book) {
      return res.status(400).send({ message: "Book not found" });
    }

    borrowData.borrowedAt = new Date();
    const result = await borrowedBooksCollection.insertOne(borrowData);

    res.send({
      success: true,
      message: "Book borrowed successfully",
      insertedId: result.insertedId,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({ success: false, message: "Failed to borrow book" });
  }
});

app.listen(port, () => {
  console.log(`Book nook server is running on port: ${port}`);
});

//http://localhost:5000

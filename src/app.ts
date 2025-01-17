import express, { Request, Response } from "express";
import { MongoClient, ServerApiVersion, ObjectId } from "mongodb";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();

app.use(express.json());
app.use(
  cors({
    origin: "*",
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    allowedHeaders: "Content-Type,Authorization",
    credentials: true,
  })
);

const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error("MONGODB_URI is not defined");
}
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const connectDB = async () => {
  try {
    await client.connect();
    console.log("MongoDB connected");
  } catch (err) {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  }
};

connectDB();

const db = client.db("expense-tracker");
const expenseCollection = db.collection("jsondata");

// Search Articles with filters and pagination
app.get("/api/search", async (req: Request, res: Response) => {
  try {
    const {
      query,
      end_year,
      intensity,
      sector,
      topic,
      region,
      start_year,
      country,
      relevance,
      pestle,
      source,
      likelihood,
      start_date,
      end_date,
      page = 1,
      limit = 20,
    } = req.query;

    const filters: any = {};

    if (query) {
      filters.title = { $regex: new RegExp(query as string, "i") };
    }
    if (end_year && typeof end_year === "string") {
      const parsedEndYear = parseInt(end_year);
      filters.end_year = parsedEndYear;
    }
    if (intensity) {
      filters.intensity = parseInt(intensity as string);
    }
    if (sector) filters.sector = sector;
    if (topic) filters.topic = topic;
    if (region) filters.region = region;
    if (start_year) filters.start_year = start_year;
    if (country) filters.country = country;
    if (relevance) filters.relevance = parseInt(relevance as string);
    if (pestle) filters.pestle = pestle;
    if (source) filters.source = source;
    if (likelihood) filters.likelihood = parseInt(likelihood as string);

    // Date range filtering
    if (start_date || end_date) {
      filters.added = {};
      filters.published = {};

      if (start_date) {
        filters.added.$gte = new Date(start_date as string);
        filters.published.$gte = new Date(start_date as string);
      }
      if (end_date) {
        filters.added.$lte = new Date(end_date as string);
        filters.published.$lte = new Date(end_date as string);
      }

      // Clean up filters if not both date filters are applied
      if (!filters.added.$gte && !filters.added.$lte) delete filters.added;
      if (!filters.published.$gte && !filters.published.$lte) delete filters.published;
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const total = await expenseCollection.countDocuments(filters);
    const articles = await expenseCollection.find(filters).skip(skip).limit(limitNum).toArray();

    res.json({
      totalRecords: total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      articles,
    });
  } catch (error) {
    res.status(500).json({ error: "An error occurred while fetching articles" });
  }
});

// Get expense by ID
app.get("/api/search/:id", async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const expense = await expenseCollection.findOne({ _id: new ObjectId(id) });

    if (!expense) {
      return res.status(404).json({ error: "Expense not found" });
    }

    res.json(expense);
  } catch (error) {
    res.status(500).json({ error: "An error occurred while fetching the expense" });
  }
});

// Update expense by ID
app.put("/api/edit/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  const updateData = req.body; // This will contain the fields to be updated

  try {
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid ID format" });
    }

    const result = await expenseCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "Expense not found" });
    }

    res.json({ message: "Expense updated successfully" });
  } catch (error) {
    console.error("Error updating expense:", error);
    res.status(500).json({ error: "An error occurred while updating the expense" });
  }
});

// Delete multiple records
app.delete("/api/search/multiple", async (req: Request, res: Response) => {
  const { ids } = req.body; // Array of IDs to delete

  try {
    if (!Array.isArray(ids) || ids.some(id => !ObjectId.isValid(id))) {
      return res.status(400).json({ error: "Invalid ID(s) format" });
    }

    const objectIds = ids.map(id => new ObjectId(id));

    const result = await expenseCollection.deleteMany({ _id: { $in: objectIds } });

    res.json({ message: `${result.deletedCount} records deleted successfully` });
  } catch (error) {
    console.error("Error deleting records:", error);
    res.status(500).json({ error: "An error occurred while deleting records" });
  }
});

// Delete a single record by ID
app.delete("/api/search/:id", async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid ID format" });
    }

    const result = await expenseCollection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Record not found" });
    }

    res.json({ message: "Record deleted successfully" });
  } catch (error) {
    console.error("Error deleting record:", error);
    res.status(500).json({ error: "An error occurred while deleting the record" });
  }
});

export default app;

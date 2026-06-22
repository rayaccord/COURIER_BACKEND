import mongoose from "mongoose";

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(
      process.env.MONGO_URI,
      {
        serverSelectionTimeoutMS: 30000,
      }
    );

    console.log(
      `MongoDB Connected: ${conn.connection.host}`
    );

  } catch (error) {
    console.log(
      "Database Error:",
      error.message
    );

    process.exit(1);
  }
};

export default connectDB;
import dotenv from "dotenv";

const env = process.env.NODE_ENV || "development";

dotenv.config({
  path: `.env.${env}`,
});

import app from "./app.js";
import { connectDB } from "./config/db.js";

const PORT = process.env.PORT || 5000;

console.log(`Running in ${env} mode`);

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
});
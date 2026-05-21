const mongoose = require('mongoose');

const uri = "mongodb+srv://ecoscore994_db_user:rRW1AeLn6tpShP0i@ecoscore.bmqnwxt.mongodb.net/ecoscore?retryWrites=true&w=majority";

async function check() {
  console.log("Testing connection to:", uri);
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log("Connected successfully!");
    await mongoose.disconnect();
  } catch (err) {
    console.error("Connection failed:", err.message);
  }
}

check();

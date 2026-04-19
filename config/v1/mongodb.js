const mongoose = require('mongoose');

mongoose.connect(process.env.DATABASE_URL);
const db = mongoose.connection;

db.on("error", console.error.bind(console, "Database Connection Error: "));
// mongoose.set('debug', true);

db.once("open", function () {
  console.log("Database Connected Successfully!");
});

module.exports = db;
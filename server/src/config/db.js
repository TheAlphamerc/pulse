const Mongoose = require("mongoose");
const { MONGO_URI } = require("./config");

exports.connect = () => {
  Mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
    .then(() => console.log("⚡️: MongoDB Connected..."))
    .catch((error) => {
      console.log("🧨 database connection failed");
      console.error(error);
      console.log("🧨 database connection failed. exiting now...");
      process.exit(1);
    });
};

const express = require("express");
const mongoose = require("mongoose"); // npm install mongoose 
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const app = express();
app.use(express.json());
app.use(cors());
mongoose.connect(
  'mongodb+srv://sfayazmr:Abcdef067@cluster01.ibbs2.mongodb.net/LangUsers?retryWrites=true&w=majority&appName=Cluster01',
  { useNewUrlParser: true, useUnifiedTopology: true }
).then(() => console.log('Connected to MongoDB'))
  .catch((error) => console.error('Error connecting to MongoDB:', error));

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  learningLevel: { type: String, default: "beginner" },
  translationHistory: { type: Array, default: [] },
  quizResults: { type: Array, default: [] },
  timestamps: { type: Array, default: [] },
  loginStreak: { type: Number, default: 1 },
  lastLoginDate: { type: String, default: new Date().toISOString().split("T")[0] },
});

const User = mongoose.model("User", userSchema);

// Register User
app.post("/api/register", async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log("Received password during registration:", password);

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, password: hashedPassword });
    await newUser.save();

    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ message: "An error occurred during registration" });
  }
});

// Login User & Track Login Streak
app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log("Received password during login:", password);
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }
    //Log the stored Hashed password.
    console.log("Stored Hashed password:", user.password);

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const today = new Date().toISOString().split("T")[0];

    // Update login streak
    let newStreak = user.loginStreak;
    if (user.lastLoginDate !== today) {
      const lastLogin = new Date(user.lastLoginDate);
      const todayDate = new Date(today);
      const diffDays = (todayDate - lastLogin) / (1000 * 60 * 60 * 24);

      if (diffDays === 1) {
        newStreak += 1;
      } else {
        newStreak = 1;
      }

      await User.findByIdAndUpdate(user._id, { loginStreak: newStreak, lastLoginDate: today });
    }
    const token = jwt.sign({ username }, "secretKey", { expiresIn: "1h" });
    res.json({ token, username, loginStreak: newStreak });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "An error occurred during login" });
  }
});
// Update User Data (Translation, Quiz, Level)
app.put("/api/updateUser", async (req, res) => {
  try {
    const { username, learningLevel, translationHistory = [], quizResults = [] } = req.body;

    if (!username) {
      return res.status(400).json({ message: "Username is required" });
    }

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Update learningLevel if provided
    if (learningLevel) {
      user.learningLevel = learningLevel;
    }

    // Append translation history if provided
    if (Array.isArray(translationHistory) && translationHistory.length > 0) {
      user.translationHistory.push(...translationHistory);
    }

    // Append quiz results if provided
    if (Array.isArray(quizResults) && quizResults.length > 0) {
      user.quizResults.push(...quizResults);
    }

    // Add a timestamp for the update
    user.timestamps.push(new Date().toISOString());

    // Save the updated user data
    await user.save();

    // Send a success response with the updated user data
    res.json({ message: "User data updated successfully", updatedUser: user });

  } catch (error) {
    // Handle errors during the update process
    console.error("Update user error:", error);
    res.status(500).json({
      message: "An error occurred while updating user data",
      error: error.message,
    });
  }
});



app.get("/api/user", async (req, res) => {
  try {
    console.log("Received API request:", req.query); // Check if username is coming
    const username = req.query.username;
    if (!username) {
      console.log("No username provided in query.");
      return res.status(400).json({ message: "Username is required." });
    }
    console.log(`Searching for user: ${username}`);
    const user = await User.findOne({ username });
    if (!user) {
      console.log(`User not found: ${username}`);
      return res.status(404).json({ message: `User '${username}' not found.` });
    }
    res.json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});


// Start Server
const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`Server running on port ${port}`));

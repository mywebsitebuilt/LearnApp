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
    resetPasswordToken: String,
    resetPasswordExpires: Date,
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

// Reset Password - Update Password Based on Username
app.post("/api/forgot-password", async (req, res) => {
    try {
        const { username, newPassword } = req.body;

        if (!username) {
            return res.status(400).json({ message: "Username is required to reset password." });
        }

        if (!newPassword) {
            return res.status(400).json({ message: "New password is required." });
        }

        const user = await User.findOne({ username });
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await User.findOneAndUpdate({ username: username }, { password: hashedPassword });

        res.json({ message: "Password updated successfully." });
    } catch (error) {
        console.error("Reset password error:", error);
        res.status(500).json({ message: "An error occurred while updating the password." });
    }
});

// Update User Data (Translation, Quiz, Level)
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
          const historyWithLevel = translationHistory.map(item => ({ ...item, level: learningLevel }));
          user.translationHistory.push(...historyWithLevel);
      }

      // Append quiz results if provided (expecting a single quiz result object)
      if (Array.isArray(quizResults) && quizResults.length > 0) {
          user.quizResults.push(...quizResults.map(result => ({ ...result, level: learningLevel })));
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
        console.log("Received API request:", req.query);
        const username = req.query.username;

        if (!username) {
            console.log("Error: No username provided in query.");
            return res.status(400).json({ message: "Username is required." });
        }

        console.log(`Searching for user: ${username}`);
        const user = await User.findOne({ username });

        if (!user) {
            console.log(`Error: User not found with username: ${username}`);
            return res.status(404).json({ message: `User '${username}' not found.` });
        }

        res.json(user); // Send the raw user object
    } catch (error) {
        console.error("Error fetching user:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});
// Start Server
const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`Server running on port ${port}`));

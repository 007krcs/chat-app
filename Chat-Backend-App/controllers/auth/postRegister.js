const User = require("../../models/user");
const bcryptjs = require("bcryptjs");
const jwt = require('jsonwebtoken');

const postRegister = async (req, res) => {
  try {
    const { username, mail, password } = req.body;

    //Check if user exists
    const userExist = await User.findOne({ mail: mail.toLowerCase() });

    if (userExist) {
      
      return res.status(409).send("E-mail already in use");
    }

    
    //encrypt password
    const encryptPassword = await bcryptjs.hash(password, 10);

    //Create user document and save in database
    const user = await User.create({
      username,
      mail: mail.toLowerCase(),
      password: encryptPassword,
    });

    //Create JWT Token
    console.log("Hi")
    const token = jwt.sign(
      {
        userId: user._id,
        mail: user.mail,
      },
      process.env.SENDGRID_API_KEY,
      {
        expiresIn: "24h",
      }
    );

    // Send response after user creation in database
    console.log(token)
    return res.status(201).json({
      userDetails: {
        mail: user.mail,
        token: token,
        username: user.username,
      },
    });
  } catch (error) {
    return res.status(500).send("Error occurred, please try again");
  }
};

module.exports = postRegister;

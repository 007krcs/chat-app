const User = require("../../models/user");
const bcryptjs = require("bcryptjs");
const jwt = require("jsonwebtoken");
const postLogin = async (req, res) => {
  try {
    const { mail, password } = req.body;

    //Find user wether user login or not
    const user = await User.findOne({ mail: mail.toLowerCase() });
    
    if (user && (await bcryptjs.compare(password, user.password))) {
      //Create JWT Token
      
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

      return res.status(200).json({
        userDetails: {
          mail: user.mail,
          token: token,
          username: user.username,
        },
      });
      //res.status(404).send("User doesn't exist please try to register to our application");
    }
    return res.status(400).send("Invalid user, please try again");
  } catch (error) {
    return res.status(500).send("Something went wrong, please try again");
  }
};

module.exports = postLogin;

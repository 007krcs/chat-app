const jwt = require('jsonwebtoken');

const config = process.env;

const verifyTokenSocket = (socket, next)=> {
    const token = socket.handshake.auth?.token;

    try {
        const decoded = jwt.verify(token, config.TOKEN_KEY)
    } catch (error) {
        
    }
}
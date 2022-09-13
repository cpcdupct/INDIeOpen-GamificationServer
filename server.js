const path = require("path");
const express = require("express");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const forge = require('node-forge');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(cookieParser());

function encrypt(caden){
  var cipher = forge.cipher.createCipher('MY_CIPHER', process.env.KEY);
  cipher.start({iv: process.env.IV});
  cipher.update(forge.util.createBuffer(caden));
  cipher.finish();
  return forge.util.encode64(cipher.output.data);
 
}
function decrypt(encryptedString){
  const decipher = forge.cipher.createDecipher('MY_CIPHER', process.env.KEY);
  const decodedB64 = forge.util.decode64(encryptedString);
  decipher.start({ iv: process.env.IV });
  decipher.update(forge.util.createBuffer(decodedB64));
  decipher.finish();
  return decipher.output.data;
};

function sendCloseActivity(codgame, token){
  var data = '';
  
  var config = {
    method: 'put',
    url:  process.env.BACKENDGAME + "/" + codgame,
    headers: { 
      'Authorization': 'Bearer ' + token, 
      'Content-Type': 'application/json'
    },
    data : data
  };
  
  axios(config)
  .then(function (response) {
  
  })
  .catch(function (error) {
    console.log(error);
  });
  
}

function closeActivity(originalUrl,token){
  const pattern = /\/ranking\/\?cod=(\d{6})$/;
  const match = originalUrl.match(pattern);
  if (match != null){
    const codgame = match[1];
    sendCloseActivity(codgame, token);
    return true;
  }else{
    return false;
  } 
}

function verifyLTIToken(req){
  const tokencipher = req.cookies.access_token;
  if (tokencipher){ 
    try{
      const token = decrypt(tokencipher);
      const { profile }  = jwt.verify(token, "MY_PRIVATE_KEY");
      if ( profile == 'Instructor' ) {
        return token;
      }
      return undefined;
    }catch(error){
      return undefined; 
    }
  }
  return undefined;
}

function verifyOpenToken(req){
  const tokencipher = req.cookies.INDIE_USER;
  if (tokencipher){
    try{
      const token = decrypt(tokencipher);
      const tokenJSON = JSON.parse(token);
      const dataToken = jwt.verify(tokenJSON.access_token, "MY_PRIVATE_KEY");
      return tokenJSON.access_token; 
    }catch(error){
      return undefined;
    }
  }
  return undefined;
}

function verifyToken(req){
  let token;
  return ((token = verifyLTIToken(req)) !== undefined) ? token : verifyOpenToken(req);
}

app.get( /\/ranking*/, function(req, res, next) {
  let token;
  if ((token=verifyToken(req))!== undefined){
    if (closeActivity(req.originalUrl, token)){
      next();
    }else{
      return res.status(401).sendFile(path.join(__dirname, '/public/error/index.html'));
    }
  }else{
    return res.status(401).sendFile(path.join(__dirname, '/public/error/index.html'));  
  }
});

app.get( /\/*\/teacher\/$/, function(req, res, next) {
  let token;
  if ((token=verifyToken(req))=== undefined){
    return res.status(401).sendFile(path.join(__dirname, '/public/error/index.html'));
  }
  next();
});

app.use(express.static("public"));
app.use(function(_, res, _) {
  res.sendFile(path.join(__dirname, '/public/error/index.html'))
});

const http = require("http").Server(app);
const io = require("socket.io")(http);

io.on("connection", function(socket) {
  socket.on("join-room", (room) => {
    if (!(/[^\w.]/.test(room))) {
      socket.join(room);
    }
  });

  socket.on("question-response", (studentResponse) => {
    socket.to(studentResponse["room"]).emit("update-user-list", {
      "id": studentResponse["id"],
      "res": studentResponse["res"],
      "username": studentResponse["username"],
      "time": studentResponse["time"],
      "score": studentResponse["score"]
    });
  });

  socket.on("game-finished", (studentList) => {
    socket.to(studentList["room"]).emit("redirect-game-finished",
      studentList["student_list"])
  });
});

http.listen(process.env.PORT || 3000, function() {
  console.log("listening on *:3000");
});

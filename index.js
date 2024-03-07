const express = require("express")
const bodyParser = require("body-parser")
const jwt = require("jsonwebtoken")
const { uuid } = require('uuidv4');
var cors = require('cors');
let users = require('./users');
require('dotenv').config();
const axios = require('axios');
const https = require('https');

const jwtKey = process.env.JWT_RABBIT_SECRET
console.log("jwtKey:", jwtKey);
const now = Math.round(new Date().getTime()/1000);
const exp = now + parseInt(process.env.JWT_EXP_DURATION_SECONDS);
console.log("JWT will exp on:", new Date(exp * 1000));

const app = express()
app.use(bodyParser.json())
// allows login from "localhost Ionic dev chat" running on port 8100
app.use(cors({origin: '*'}));
app.use(express.static('public'))

/** Just a test */
app.post('/postdata', (req, res) => {
    console.log('/postdata', JSON.stringify(req.body));
    const httpsAgent = new https.Agent({
        rejectUnauthorized: false // (NOTE: this will disable client verification)
    });

    let axios_req = {
        url: process.env.PUSH_WH_NOTIFY_URL,
        method: 'POST',
        data: req.body,
        headers: {
            'Authorization': process.env.PUSH_WH_CHAT21_API_ADMIN_TOKEN
        },
        httpsAgent: httpsAgent
    }
    //console.log("axios_req:", axios_req);

    axios(axios_req)
      .then(function (response) {
        console.log("response.status:", response.status);
        res.status(200).send({success: true});
      })
      .catch(function (error) {
        console.error("Axios call error:", error);
        res.status(200).send({success: false});
      });
});

/** Just a test presence webhook */
app.post('/presence', (req, res) => {
    res.status(200).send({success: true});
    console.log('/presence:', req.body);
    // console.log('/presence:', JSON.stringify(req.body));
});

app.get('/fake', (req, res) => {
    res.status(200).send({success: true});
});

// app.post("/:appid/auth/signin", (req, res) => {
//     // Get credentials from JSON body
//     console.log("signin:", req.body)
//     const appid = req.params.appid
//     const { username, password } = req.body
//     if (!username || !password || !users[username] || users[username].password !== password) {
//         // return 401 error is username or password doesn't exist, or if password does
//         // not match the password in our records
//         console.log("Unauthorized")
//         return res.status(401).end()
//     }
//     const reply = getToken(appid, username)
//     console.log("reply:", reply)
//     res.status(200).send(reply);
// });

/*
    Native signin
**/
app.post("/native/:appid/signin", (req, res) => {
    // Get credentials from JSON body
    console.log("signin:", req.body)
    const appid = req.params.appid
    const { username, password } = req.body
    if (!username || !password || !users[username] || users[username].password !== password) {
        // return 401 error is username or password doesn't exist, or if password does
        // not match the password in our records
        console.log("Unauthorized")
        return res.status(401).end()
    }
    const reply = getToken(appid, username)
    console.log("reply:", reply)
    res.status(200).send(reply);
    // res.end()
});

/*
    Tiledesk Token delegate signin
**/
app.post("/auth/signin", (req, res) => {
    // Get credentials from JSON body
    console.log("Signin:", req.body)
    const appid = req.params.appid
    const { email, password } = req.body
    console.log("email", email)
    console.log("password", password)
    
    if (!email || !password || !users[email] || users[email].password !== password) {
        // return 401 error is username or password doesn't exist, or if password does
        // not match the password in our records
        console.log("Unauthorized")
        return res.status(401).end()
    }
    
    const user = users[email]
    if (!user) {
        throw "User not found!";
    }
    

    // let payload = {
    //     "_id": userid,
    //     "email": email,
    //     "firstname": user.firstname,
    //     "lastname": user.lastname,
    //     "emailverified": true,
    //     "iat": now,
    //     "aud": "https://tiledesk.com",
    //     "iss": "https://tiledesk.com",
    //     "sub": "user",
    //     "jti": uuid()
    // }
    // var token = jwt.sign(
    //     payload,
    //     jwtKey,
    //     {
    //         "algorithm": "HS256"
    //     }
    // );
    const token = getTiledeskToken(user, email);
    let reply = {
        "success": true,
        "token": "JWT " + token,
        "user": {
            "_id": user._id,
            "email": email,
            "firstname": user.firstname,
            "lastname": user.lastname,
            "emailverified": true
        }
    };
    console.log("reply:", reply);
    res.status(200).send(reply);
});

function getTiledeskToken(user, email) {
    console.log("...")
    const userid = user._id
    console.log("user", user)
    const now = Math.round(new Date().getTime()/1000);
    let payload = {
        "_id": userid,
        "email": email,
        "firstname": user.firstname,
        "lastname": user.lastname,
        "emailverified": true,
        "iat": now,
        "aud": "https://tiledesk.com",
        "iss": "https://tiledesk.com",
        "sub": "user",
        "jti": uuid()
    }

    var token = jwt.sign(
        payload,
        jwtKey,
        {
            "algorithm": "HS256"
        }
    );
    console.log("token:", token)
    return token;
}

/*
    Tiledesk Token delegate signin
**/
app.post("/chat21/native/auth/createCustomToken", (req, res) => {
    // Get credentials from JSON body
    console.log("Signin headers:", req.headers)
    let auth = req.headers['authorization'];
    console.log("auth", auth)
    if (!auth) {
        // return 401 error is username or password doesn't exist, or if password does
        // not match the password in our records
        console.log("Unauthorized (no auth)");
        return res.status(401).end()
    }

    let _token = auth.split(" ")[1];
    console.log("_token:", _token)
    try {
        let decoded = jwt.verify(_token, jwtKey);
        console.log("decoded", decoded)
        if (!decoded) {
            console.log("Unauthorized (no decoded token)");
            return res.status(401).end();
        }
        console.log("decoded.user.email", decoded.email);
        mqtt_token = getToken('tilechat', decoded.email);
        console.log("reply:", mqtt_token);
        return res.status(200).send(mqtt_token);
    } catch(err) {
        console.error("(Invalid token)");
        throw "Unauthorized (Invalid token)"
    }
});

/*
    Tiledesk Token delegate signin
**/
app.post("/auth/signinWithCustomToken", (req, res) => {
    // Get credentials from JSON body
    console.log("Signin headers:", req.headers)
    let auth = req.headers['authorization'];
    console.log("auth", auth)
    if (!auth) {
        // return 401 error is username or password doesn't exist, or if password does
        // not match the password in our records
        console.log("Unauthorized (no auth)");
        return res.status(401).end()
    }

    let _token = auth.split(" ")[1];
    console.log("_token:", _token)
    try {
        let decoded = jwt.verify(_token, jwtKey);
        if (!decoded) {
            console.log("Unauthorized (no decoded token)");
            return res.status(401).end();
        }
        console.log("decoded...", decoded)
        const user = {_id: decoded._id, firstname: decoded.firstname, lastname: decoded.lastname}
        console.log("user is", user)
        const token = getTiledeskToken(user, decoded.email);
        let reply = {
            "success": true,
            "token": "JWT " + token,
            "user": {
                "_id": decoded._id,
                "email": decoded.email,
                "firstname": decoded.firstname,
                "lastname": decoded.lastname,
                "emailverified": true
            }
        };
        console.log("reply:", reply);
        return res.status(200).send(reply);
    } catch(err) {
        console.error("(Invalid token /auth/signinWithCustomToken)");
        throw "Unauthorized (Invalid token /auth/signinWithCustomToken)"
    }
});

function getToken(appid, username) {
    const user = users[username]
    if (!user) {
        throw "User not found!";
    }
    const userid = user._id //"ulisse" // uuidv4()
    // let user = {
    //     _id: userid,
    //     username: userid
    // } // , email: userid + "@example.com" };
    // const now = Math.round(new Date().getTime()/1000);
    // const exp_duration = 60 * 60 * 24 * 30 * 12 * 10 // 10 years
    // const exp = now + 60 * 60 * 24 * 30 * 12 * 10 // 10 years
    // const exp = now + parseInt(process.env.JWT_EXP_DURATION_SECONDS);
    // console.log("exp:", exp);
    let scope;
    let tiledesk_api_roles = "user"
    if (username === 'observer') {
        scope = [
            "rabbitmq.read:*/*/*",
            "rabbitmq.write:*/*/*",
            "rabbitmq.configure:*/*/*"
        ]
    }
    else if (username === 'admin') { // rabbitmq console administrator
        scope = [
            "rabbitmq.read:*/*/*",
            "rabbitmq.write:*/*/*",
            "rabbitmq.tag:administrator",
            "rabbitmq.configure:*/*/*"
        ]
    }
    else if (username === 'apiadmin') {
        scope = [
            "rabbitmq.read:*/*/*",
            "rabbitmq.write:*/*/*",
            "rabbitmq.configure:*/*/*"
        ]
        tiledesk_api_roles = "admin"
    }
    else {
        scope = [
            `rabbitmq.read:*/*/apps.${appid}.users.${userid}.*`,
            `rabbitmq.write:*/*/apps.${appid}.users.${userid}.*`,
            `rabbitmq.write:*/*/apps.${appid}.outgoing.users.${userid}.*`,
            'rabbitmq.configure:*/*/*'
        ]
    }
    // else {
    //     scope = [
    //         `rabbitmq.read:*/*/apps.${appid}.users.${userid}.*`,
    //         `rabbitmq.write:*/*/apps.${appid}.users.${userid}.adminoutgoing`,
    //         `rabbitmq.write:*/*/apps.${appid}.users.${userid}.adminupdate`,
    //         'rabbitmq.configure:*/*/*'
    //     ]
    // }
    var payload = {
        "jti": uuid(),
        "sub": user._id,
        scope: scope,
        "client_id": user._id,
        "cid": user._id,
        "azp": user._id,
        "user_id": user._id,
        "app_id": appid,
        "iat": now,
        "exp": exp,
        "aud": [
            "rabbitmq",
            user._id
        ],
        "kid": "tiledesk-key", //"legacy-token-key",
        "tiledesk_api_roles": tiledesk_api_roles
    }
    // console.log("payload:\n", payload)
    var token = jwt.sign(
        payload,
        jwtKey,
        {
            "algorithm": "HS256"
        }
    );
    const result = {
        userid: user._id,
        fullname: user.fullname,
        firstname: user.firstname,
        lastname: user.lastname,
        token: token
    }
    return result;
}

app.get("/chat21/contacts", (req, res) => {
    console.log("/chat21/contacts")
    // users.forEach(function(value, index, array) {
    //     value.uid = value._id;
    // });
    let contacts = [];
    for (const [key, value] of Object.entries(users)) {
        console.log(`${key}: ${value}`);
        let contact = value;
        contact.uid = contact._id;
        contact.description = 'id:' + contact.uid;
        contacts.push(contact);
    }
    res.status(200).send(contacts);
    res.end();
})

app.get("/chat21/contacts/:userid", (req, res) => {
    const userid = req.params.userid
    console.log("/chat21/contacts/:userid", userid)
    let contact = usersById(userid);
    console.log("user:", contact)
    if (!contact) {
        res.status(404).send({success: false, message: "Not found"});
        res.end();
        return;
    }
    contact.uid = contact._id;
    contact.description = 'id:' + contact.uid;
    res.status(200).send(contact);
    res.end();
})

function usersById(userid) {
    for (const [key, value] of Object.entries(users)) {
        if (users[key]['_id'] === userid) {
            return users[key];
        }
    }
    return null
}

var port = process.env.PORT || 8002;
console.log("Starting server on port", port)
app.listen(port, () => {
    console.log('OBSERVER TOKEN:\n', getToken('tilechat', 'observer'))
    console.log('CHAT21 HTTP SERVER TOKEN:\n', getToken('tilechat', 'apiadmin'))
    console.log('RABBIT ADMIN (WEB CONSOLE) TOKEN:\n', getToken('tilechat', 'admin'))
    // console.log("RABBIT USER (andrea.leo@frontiere21.it) TOKEN:\n\n", getToken('tilechat', 'andrea.leo@frontiere21.it'))
    // console.log("const user1 = ", getToken('tilechat', 'user1@chatserver.org'));
    // console.log("const user2 = ", getToken('tilechat', 'user2@chatserver.org'));
    // console.log("const user3 = ", getToken('tilechat', 'user3@chatserver.org'));
    // console.log("const user4 = ", getToken('tilechat', 'user4@chatserver.org'));
    // console.log("const user5 = ", getToken('tilechat', 'user5@chatserver.org'));
    // console.log("const user6 = ", getToken('tilechat', 'user6@chatserver.org'));
    // console.log("const user7 = ", getToken('tilechat', 'user7@chatserver.org'));
    // console.log("const user8 = ", getToken('tilechat', 'user8@chatserver.org'));
    // console.log("const user9 = ", getToken('tilechat', 'user9@chatserver.org'));
});





// var payload = {
//     "jti": uuid(),
//     "sub": user._id,
//     scope: scope,
//     "client_id": user._id, //"rabbit_client", SEMBRA SIA QUESTO LO USER-ID
//     "cid": user._id, //"rabbit_client",
//     "azp": user._id, //"rabbit_client",
//     // "grant_type": "password", //"password", // client_credentials // REMOVED 2
//     "user_id": user._id,
//     "app_id": appid,
//     // "origin": "uaa", // REMOVED 2
//     // "user_name": user._id, // REMOVED 2
//     // "email": user.email,
//     // "auth_time": now, // REMOVED 2
//     // "rev_sig": "d5cf8503",
//     "iat": now,
//     "exp": exp, // IF REMOVED TOKEN NEVER EXPIRES?
//     // "iss": "http://localhost:8080/uaa/oauth/token", // REMOVED 2
//     // "zid": "uaa", // REMOVED 2
//     "aud": [
//         "rabbitmq",
//         user._id
//     ],
//     // "jku": "https://localhost:8080/uaa/token_keys", // REMOVED 2
//     "kid": "tiledesk-key", //"legacy-token-key",
//     "tiledesk_api_roles": tiledesk_api_roles
// }




// "scope": [
        //     // "rabbitmq.read:*/*/apps.ulisse.*",
        //     // "rabbitmq.write:*/*/apps.ulisse.*",
        //     // "rabbitmq.configure:*/*/*"

        //     // "rabbitmq.read:*/*/apps.tilechat.users.ulisse.#",
        //     // "rabbitmq.write:*/*/apps.tilechat.users.ulisse.#",
        //     // "rabbitmq.configure:*/*/*"

        //     `rabbitmq.read:*/*/apps.tilechat.users.ulisse.*`,
        //     `rabbitmq.write:*/*/apps.tilechat.users.ulisse.*`,
        //     'rabbitmq.configure:*/*/*'

        //     // `rabbitmq.read:*/*/apps.tilechat.users.${userid}.#`,
        //     // `rabbitmq.write:*/*/apps.tilechat.users.${userid}.#`,
        //     // "rabbitmq.configure:*/*/*"
        // ],
        // "authorities": [
        //     "rabbitmq.read:*/*",
        //     "rabbitmq.write:*/*",
        //     "rabbitmq.configure:*/*"
        // ],


        // app.post("/signin", (req, res) => {
//     // Get credentials from JSON body
//     console.log("signin:", req.body)
//     const { username, password } = req.body
//     if (!username || !password || users[username] !== password) {
//         // return 401 error is username or password doesn't exist, or if password does
//         // not match the password in our records
//         return res.status(401).end()
//     }

//     // Create a new token with the username in the payload
//     // and which expires 300 seconds after issue
//     // const token = jwt.sign(
//     //     { username },
//     //     jwtKey, 
//     // {
//     //     algorithm: "HS256",
//     //     expiresIn: jwtExpirySeconds,
//     // }
//     // )

//     // let user = {_id: uuidv4(), fullname:firstname, username: "rabbit_admin"};
//     // var signOptions = {
//     //     issuer:  'https://tiledesk.com',
//     //     subject:  'guest',
//     //     audience:  'https://tiledesk.com',
//     //     jwtid: uuidv4()
//     //     // scope: // rabbitmq
//     //     // aud: // rabbitmq
//     //   };
//     const userid = "32f9cb9bf63f" // uuidv4()
//     let user = { _id: userid, username: userid, email: "rabbit_anonym@example.com" };
//     const now = Date.now()
//     const exp = now + 60 * 60 * 24 * 30
//     var payload = {
//         "jti": uuidv4(),
//         "sub": user._id,
//         "scope": [
//             "rabbitmq.read:*/*",
//             "rabbitmq.write:*/*",
//             "rabbitmq.tag:",
//             "rabbitmq.configure:*/*"
//             // "rabbitmq.read:.*",
//             // "rabbitmq.write:.*",
//             // "rabbitmq.tag:administrator",
//             // "rabbitmq.configure:.*"
//         ],
//         "client_id": "rabbit_client",
//         "cid": user.username, //"rabbit_client",
//         "azp": user.username, //"rabbit_client",
//         "grant_type": "password",
//         "user_id": user._id,
//         "origin": "uaa",
//         "user_name": user.username,
//         "email": user.email,
//         "auth_time": now,
//         "rev_sig": "d5cf8503",
//         "iat": now,
//         "exp": exp,
//         "iss": "http://localhost:8080/uaa/oauth/token",
//         "zid": "uaa",
//         "aud": [
//             "rabbitmq",
//             user.username // andrea < rabbit_client
//         ],
//         "jku": "https://localhost:8080/uaa/token_keys",
//         "kid": "legacy-token-key",
//     }
//     // var payload = {
//     //     "jti": uuidv4(),
//     //     "sub": user._id,
//     //     "scope": [
//     //         "rabbitmq.read:*/*",
//     //         "rabbitmq.write:*/*",
//     //         "rabbitmq.tag:",
//     //         "rabbitmq.configure:*/*"
//     //         // "rabbitmq.read:.*",
//     //         // "rabbitmq.write:.*",
//     //         // "rabbitmq.tag:administrator",
//     //         // "rabbitmq.configure:.*"
//     //     ],
//     //     "client_id": user.username, //"rabbit_client",
//     //     "cid": user.username, //"rabbit_client",
//     //     "azp": user.username, //"rabbit_client",
//     //     "grant_type": "password",
//     //     "user_id": user._id,
//     //     "origin": "uaa",
//     //     "user_name": user.username,
//     //     "email": user.email,
//     //     "auth_time": now,
//     //     "rev_sig": "d5cf8503",
//     //     "iat": now,
//     //     "exp": exp,
//     //     "iss": "http://localhost:8080/uaa/oauth/token",
//     //     "zid": "uaa",
//     //     "aud": [
//     //         "rabbitmq",
//     //         user.username // andrea < rabbit_client
//     //     ],
//     //     "jku": "https://localhost:8080/uaa/token_keys",
//     //     "kid": "legacy-token-key",
//     // }

//     // var payload = {
//     //     "jti": uuidv4(),
        
//     //     "scope": [
//     //         "rabbitmq.read:*/*",
//     //         "rabbitmq.write:*/*",
//     //         "rabbitmq.tag:",
//     //         "rabbitmq.configure:*/*"
//     //     ],
        
//     //     "auth_time": now,
        
//     //     "iat": now,
//     //     "exp": exp,
        
//     //     "aud": [
//     //         "rabbitmq",
//     //         user.username // andrea < rabbit_client
//     //     ],
//     //     "jku": "https://localhost:8080/uaa/token_keys",
//     //     "kid": "legacy-token-key",
//     // }

//     var token = jwt.sign(
//         payload,
//         jwtKey,
//         {
//             "algorithm": "HS256"
//         }
//     );
//     console.log("token:", getToken())
//     res.status(200).send(token);
//     res.end()
// })


// source: https://github.com/rabbitmq/rabbitmq-auth-backend-oauth2/blob/master/src/rabbit_auth_backend_oauth2.erl#L169
    // %% Decoded tokens look like this:
    // %%
    // %% #{<<"aud">>         => [<<"rabbitmq">>, <<"rabbit_client">>],
    // %%   <<"authorities">> => [<<"rabbitmq.read:*/*">>, <<"rabbitmq.write:*/*">>, <<"rabbitmq.configure:*/*">>],
    // %%   <<"azp">>         => <<"rabbit_client">>,
    // %%   <<"cid">>         => <<"rabbit_client">>,
    // %%   <<"client_id">>   => <<"rabbit_client">>,
    // %%   <<"exp">>         => 1530849387,
    // %%   <<"grant_type">>  => <<"client_credentials">>,
    // %%   <<"iat">>         => 1530806187,
    // %%   <<"iss">>         => <<"http://localhost:8080/uaa/oauth/token">>,
    // %%   <<"jti">>         => <<"df5d50a1cdcb4fa6bf32e7e03acfc74d">>,
    // %%   <<"rev_sig">>     => <<"2f880d5b">>,
    // %%   <<"scope">>       => [<<"rabbitmq.read:*/*">>, <<"rabbitmq.write:*/*">>, <<"rabbitmq.configure:*/*">>],
    // %%   <<"sub">>         => <<"rabbit_client">>,
    // %%   <<"zid">>         => <<"uaa">>}


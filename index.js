require('dotenv/config') ; // Must configure ENV variables (PORT, HAPI_KEY)

const express = require('express');
const axios = require('axios');
const querystring = require('querystring');
const session = require('express-session');

const url = require('url');

// function getFormattedUrl(req) {
//     return url.format({
//         protocol: req.protocol,
//         host: req.get('host')
//     });
// }

// res.redirect(getFormattedUrl(req));

const app = express();

//app.set('views', './views');
app.set('view engine', 'pug');

app.use(express.json()); //Used to parse JSON bodies
app.use(express.urlencoded( {extended: true} )); //Parse URL-encoded bodies

const PORT = process.env.PORT || 3000;

const HAPI_KEY = process.env.HAPI_KEY;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const DOMAIN = process.env.DOMAIN || "http://localhost:" ;

// if (PORT === 3000){
//     DOMAIN = "http://localhost:"
// } else {
//     DOMAIN = url.origin;
// }


const REDIRECT_URI = `${DOMAIN}${PORT}/oauth-callback`;
const authUrl = `https://app.hubspot.com/oauth/authorize?client_id=1fea11cd-cae5-450b-b16d-04534de966f4&redirect_uri=https://silly-bird-143.herokuapp.com/oauth-callback&scope=contacts`
//const authUrl = `https://app.hubspot.com/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${DOMAIN}${PORT}/oauth-callback&scope=contacts`;

// const authUrl =
//   'https://app.hubspot.com/oauth/authorize' +
//   `?client_id=${encodeURIComponent(CLIENT_ID)}` +
//   `&scope=contacts` +
//   `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;

const tokenStore = {};

app.use(session({
    secret: Math.random().toString(36).substring(2),
    resave: false,
    saveUninitialized: true

}));

app.get('/contacts', async (req, res) => {
    const contacts = `https://api.hubapi.com/contacts/v1/lists/all/contacts/recent?hapikey=${HAPI_KEY}`;
    try {
        const resp = await axios.get(contacts);
        const data = resp.data;
        res.json(data);
    } catch(err){
        console.error(err);
    }
});


app.get('/update', async (req, res) => { 
    // http://localhost:3000/update?email=rick@crowbars.net
    const email = req.query.email;
    const getContact = `https://api.hubapi.com/contacts/v1/contact/email/${email}/profile?hapikey=${HAPI_KEY}`;
    try {
        const response = await axios.get(getContact);
        const data = response.data;
        res.render('update', { userEmail: email, favoriteBook: data.properties.favorite_book.value });
    } catch(err) {
        console.error(err);
    }
});

app.post('/update', async (req, res) => {
    const propUpdate = {
         "properties": [
             {
                 "property": "favorite_book",
                 "value": req.body.newVal
             }
         ]
    }   

    const email = req.query.email;
    //console.log(email);
    const apiCall = `https://api.hubapi.com/contacts/v1/contact/email/${email}/profile?hapikey=${HAPI_KEY}`;

    try{
        await axios.post(apiCall, propUpdate);
        //res.sendStatus(200);
        res.redirect('back');
    } catch(err) {
        console.error(err);
    }

}); 

const isAuthorized = (userId) => {
    return tokenStore[userId] ? true:false;
};

// 1. Send user to auth page. Kicks of initial request to OAuth Server.
app.get('/', async (req, res) => {
    if( isAuthorized(req.sessionID)) {
        const accessToken = tokenStore[req.sessionID];
        const headers = {
            Authorization: `Bearer ${accessToken}`, 
            'Content-Type': 'application/json'
        };
        const contacts = `https://api.hubapi.com/contacts/v1/lists/all/contacts/recent`;
        try {
            const resp = await axios.get(contacts, {headers});
            const data = resp.data;
            res.render('oauth', {
                token: accessToken,
                contacts: data.contacts
            });
        } catch (err) {
            console.error(err);
        }
    } else {
        res.render('oauth', { authUrl });
    }
});
// 2. Get temporary Auth code from OAuth server



// 3. Compine temporary auth code with app credentials and send back to OAuth server
app.get('/oauth-callback', async (req, res) => {
    const authCodeProof = {
        grant_type: 'authorization_code',
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        code: req.query.code
    };
    try {
        const responseBody = await axios.post('https://api.hubapi.com/oauth/v1/token', querystring.stringify(authCodeProof));

        //res.json(responseBody.data);

        // 4. Get acces and refresh tokens
        tokenStore[req.sessionID] = responseBody.data.access_token;
        res.redirect('/');
    } catch (err) {
        console.error(err);        
    }
});


app.listen( process.env.PORT, () => console.log(`listening on http://localhost:${PORT}`));
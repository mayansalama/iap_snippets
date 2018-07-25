const request = require('request');

/**
 * Responds to any HTTP request that can provide a "message" field in the body.
 * We're going to take that message, hit an AppEngine endpoint, and then finally
 * return the message and the AppEngine response.
 *
 * @param {Object} req ExpressJS object containing the received HTTP request.
 * @param {Object} res ExpressJS object containing the HTTP response to send.
 */
exports.demo_iap = (orig_req, orig_res) => {
  if (orig_req.body.message === undefined) {
    // This is an error case, as "message" is required
    orig_req.status(400).send('No message defined!');
  }
  else {
    // Everything is ok - call request-terminating method to signal function
    // completion. (Otherwise, the function may continue to run until timeout.)

    const project_id = process.env.GCP_PROJECT;
    const service_account = [project_id, '@appspot.gserviceaccount.com'].join(''); // app default service account for CF project
    const client_id = '284740355166-oq3063c9osp9cde5936ko5mqe7gp9vbf.apps.googleusercontent.com';

    console.log(`Using account ${service_account}`);

    /*--------------------------
    IAP Handling
    1) Get service account access token
    2) Create a JWT header and claim set for our request
    3) Sign that JWT using our service account access token
    4) Use signed JWT to get OpenID token 
    5) Attach that OpenID token to our request as a header
    --------------------------*/

    // Step 1: Get service account token
    console.log("Getting Service Account access token")
    var access_token = request({
      url: ['http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/',
            service_account,
            '/token'].join(''),
      headers: {
        'Metadata-Flavor': 'Google'
      }
    }, function (err, res, body) {
      var meta_resp_data = JSON.parse(body);
      var access_token = meta_resp_data.access_token;
      console.log(`Got token ${access_token}`)

      // Step 2: Create JWT
      // prepare JWT that is {Base64url encoded header}.{Base64url encoded claim set}.{Base64url encoded signature}
      var JWT_header = new Buffer(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString('base64');
      var iat = Math.floor(new Date().getTime() / 1000);
      // prepare claims set and base64 encode it
      var claims = {
        iss: service_account,
        aud: '/projects/284740355166/apps/iap-js-demo', //'https://iap-js-demo.appspot.com/',
        iat: iat,
        exp: iat + 600000000, // no need for a long lived token since it's not cached
        target_audience: client_id
      };
      var JWT_claimset = new Buffer(JSON.stringify(claims)).toString('base64');
      var to_sign = [JWT_header, JWT_claimset].join('.');

      // Step 3: Sign our JWT
      console.log("Signing JWT")
      request({
        url: ['https://iam.googleapis.com/v1/projects/',
              project_id,
              '/serviceAccounts/',
              service_account,
              ':signBlob'].join(''),
        method: "POST",
        json: {
          "bytesToSign": new Buffer(to_sign).toString('base64')
        },
        headers: {
          'Authorization': ['Bearer', access_token].join(' ')
        }
      }, function (err, res, body) {
        var JWT_signature = body.signature;
        var signed_jwt = [JWT_header, JWT_claimset, JWT_signature].join('.');
        console.log(`Got JWT ${signed_jwt}`)

        // Step 4: Get OpenID token
        console.log("Getting OpenID token")
        var ID_token = request({
          url:'https://www.googleapis.com/oauth2/v4/token',
          form: {grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion:signed_jwt},
          method: "POST"
        }, function(err, res, body){
          var ID_token_resp_data = JSON.parse(body);
          return ID_token_resp_data.id_token;
        });
        console.log(`Got OpenID token ${ID_token}`)

        // Step 5: Make our request to our AppEngine app with OpenID header
        console.log("Making request to AppEngine")
        request({
          url: 'https://iap-js-demo.appspot.com/',
          headers: {
             'content-type': 'application/json',
             'Authorization': ['Bearer', ID_token].join(' ')
          },
          method: 'post',
        }, function(err, res, body){
          console.log(`Got response ${res.statusCode} and body: ${body}`)
          orig_res.status(200).send(`You say ${orig_req.body.message} and AppEngine says ${body}. What a weird conversation!`);
        });
      });
    });
  }
};

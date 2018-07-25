const {auth} = require('google-auth-library');
const request = require('request');

/**
 * Responds to any HTTP request that can provide a "message" field in the body.
 * We're going to take that message, hit an AppEngine endpoint, and then finally
 * return the message and the AppEngine response.
 *
 * @param {Object} req ExpressJS object containing the received HTTP request.
 * @param {Object} res ExpressJS object containing the HTTP response to send.
 */
exports.demo_iap = async (orig_req, orig_res) => {
  if (orig_req.body.message === undefined) {
    // This is an error case, as "message" is required
    orig_req.status(400).send('No message defined!');
  }

  else {
    // Everything is ok - call request-terminating method to signal function
    // completion. (Otherwise, the function may continue to run until timeout.)

    const client_id = '284740355166-oq3063c9osp9cde5936ko5mqe7gp9vbf.apps.googleusercontent.com';

    const client = await auth.getClient({
      scopes: 'https://www.googleapis.com/auth/cloud-platform'
    });
    client.additionalClaims = { target_audience: client_id };
    client.email = 'iap-js-demo@appspot.gserviceaccount.com'

    const url = 'https://iap-js-demo.appspot.com/'
    const res = await client.request({ url });
    console.log(res.data);

    orig_res.status(200).send(`You say ${orig_req.body.message} and AppEngine says ${res.data}. What a weird conversation!`);
  }
}

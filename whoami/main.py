from flask import Flask
from google.appengine.api import users

app = Flask(__name__)

@app.route('/')
def print_username():
    user = users.get_current_user()
    if not user:
        return "IAP is not enabled"
    return "User email: {}".format(user.nickname())

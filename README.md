Hashi(橋)
=============

Hashi is a bridge to sync issues & tasks between Github and Asana.

Why?
=============

I like Asana a lot, it has definitely revolutionized the way I manage my time
and work flow. I also really like Github, but really hated having to keep track
of my assigned issues on Github and in Asana. So, I made Hashi to help do that
for me.

Installation
=============

I've only tested this running on Ubuntu, so ymmv on other platforms. If you are
using something with apt-get, install is as easy as running the install.sh
script included. If you are not, then you need to get the following
dependencies installed:

1. [Node.js](http://nodejs.org/download/)
2. [MongoDB](http://docs.mongodb.org/manual/installation/)

**Note**: You need to enable text search capabilities on MongoDB. To do this,
add the following line to your mongodb.conf

`setParameter=textSearchEnabled=true`

You will also need to run `npm install` to get the node module dependencies for
this project. 

How it works
=============

You define a "binding" between a Github repository and an Asana project. Hashi
will then sync all Github issues for the repository that are assigned to the
specified user to Asana. This includes sync'ing completion status in real time.

However, this sync only goes one way. If you complete a task in Asana, the
Github issue will not be closed. This support can be added, but for my work
flow, it really only made sense to close issues on Github. If this is a feature
you'd like to see, let me know.

See [`config.js`](https://github.com/ebensing/hashi/blob/master/config.js) for
information on how to configure Hashi. I believe the comments make it fairly
clear what to do, but let me know if you find anything confusing in the Github
Issues.

**Note**: Make sure to open the appropriate port in your firewall, and see
[Webhook Security](#webhook-security) below for information on how to keep this
secure.

Running Hashi
=============

You can run Hashi any number of ways, but the way that I've tested that seems
to work the best is using a node module called
[forever](https://github.com/nodejitsu/forever/).

If you decide to use forever, I've included a start.sh script to help get you
up and running quickly. If you don't want to have to keep specifying your
credentials at each startup, you need to set 3 environment variables.

1. `githubUsername` - This is the Github username which will be used to
   authenticate all Github API requests.
2. `githubPassword` - This is the password associated with the Github account.
3. `asanaKey` - This is the Asana API key that will be used to authenticate all
   Asana requests.

Information about how to find your Asana API key can be found
[here](http://developer.asana.com/documentation/#api_keys)

Webhook Security
=============

Hashi creates a webhook on your Github repository that will be used to notify
Hashi anytime an issue is open/closed/changed. The "easiest" way to get Hashi
up and running would be to give the whole world access to the port; however,
**this is not advised, please, do not do this**. Now, the better way to do this
is only allow Github'd IPs to ping the port. You can find these IPs by going to
the repository's administration page. Then navigate to the "Service Hooks"
section and click on "WebHook URLs". Here, it should list the public IP address
that the hooks will originate from.

Bugs & Feature Request
=============

Quickest way to get a bug fixed or see a new feature added is to submit a pull
request :) If that isn't your style though, head to the issues sections.

If you are reporting a bug, please include code/data/something to reproduce the
issue.



var settings = {};

/**
 * These are the different Repo-Project mappings that you want sync'd between
 * Asana and Github. All of these fields are required in each binding.
 *
 * workspace {String} - This is the name of the workspace that the project
 * resides in
 *
 * project {String} - This is the project where you want to create the Asana
 * tasks
 *
 * repo {String} - This is the full repo path for the repository you want to
 * sync issues from. IE. user/repo-name
 *
 * githubUser {String} - This is the Github username that each Issue will be
 * checked for before sync'ing to Asana. Only Issues with this username as
 * their 'assignee' will be sync'd.
 *
 */

settings.bindings = [
  {
    workspace   : 'Personal Projects',
    project     : 'JDA',
    repo        : 'Japan-Digital-Archives/Japan-Digital-Archive',
    githubUser  : 'ebensing'
  }
];

/**
 * Your Asana API Key. This can either be set here or with environment
 * variables. **Please do not add your key here and then save this to the
 * Github repo unless your fork is private**
 *
 */

settings.asanaKey = '' || process.env.asanaKey;

/**
 * Your Github Credentials. This can either be set here or with environment
 * variables. **Please do not add your key here and then save this to the
 * Github repo unless your fork is private**
 *
 */

settings.githubInfo = {
  userName : '' || process.env.githubUsername,
  password : '' || process.env.githubPassword
}

/**
 * This is the url that will be used when creating the webhooks in Github.
 *
 */

settings.url = "http://something.com"

/**
 * This is the port that the listening server will run on for the Github
 * webhook. It is recommended that you check your Github repository for the IP
 * address that the webhooks will be coming from and block all others. Hashi
 * does not offer any security guarantees against attackers.
 *
 * More instructions on how to do this can be found in the README.
 *
 */

settings.port = 34567;

module.exports = exports = settings;

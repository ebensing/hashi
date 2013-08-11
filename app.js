
var config = require('./config.js');
var AsanaConnector = require('./connectors/asana.js');
var GithubConnector = require('./connectors/github.js');

AsanaConnector.setKey(config.asanaKey);
GithubConnector.setKey(config.githubKey);

function main() {
  var done = false;

  function cont(err) {
    if (err) {
      return onError(err);
    }
    done && next();
    done = true;
  }

  // get all of the tasks in Asana
  AsanaConnector.getTasks(cont);

  // Get the issues in Github
  GithubConnector.getIssues(cont);

  function next() {
    console.log(AsanaConnector.tasks);
    console.log(GithubConnector.issues);
  }
}

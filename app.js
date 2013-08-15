
var async = require('async');
var mongoose = require('mongoose');

var config = require('./config.js');
var AsanaConnector = require('./connectors/asana.js');
var GithubConnector = require('./connectors/github.js');
var AsanaModels = require('./models/asana.js');
var GithubModels = require('./models/github.js')
var Workspace = AsanaModels.Workspace;
var Project = AsanaModels.Project;
var Task = AsanaModels.Task;
var Issue = GithubModels.Issue;

AsanaConnector.setKey(config.asanaKey);

GithubConnector.setAuthInfo(config.githubInfo.userName,
    config.githubInfo.password);

function main() {

  var dataGathered = false;
  function cont(err) {
    if (err) {
      return onError(err);
    }
    dataGathered && parse(repos);
    dataGathered = true;
  }

  // get Asana stuff
  getAllWorkspaces(function (err, workspaces) {
    if (err) {
      return onError(err);
    }
    getMonitoredProjects(workspaces, function (err, projects) {
      if (err) {
        return onError(err);
      }
      getMonitoredTasks(projects, cont);
    });
  });

  // get Github stuff
  var repos = config.bindings.map(function (item) {
    var arr = item.repo.split('/');
    var repo = {
      user : arr[0],
      name : arr[1],
      assignee : item.githubUser
    };
    return repo;
  });

  getAllIssues(repos, cont);
}


// once we get here, all of the data has been collected and is saved in the
// database. Time to process it and update anything that needs it
function parse(repos) {
  console.log("All Data collected!");

  async.each(repos, function (repo, callback) {
    var cond = {
      repo : {
        user : repo.user,
        name : repo.name
      },
      'assignee.login' : repo.assignee
    };
    Issue.find(cond, function (err, issues) {
      if (err) {
        return callback(err)
      }

      async.each(issues, processIssue, callback);
    });
  }, function (err) {
    return onError(err);
  });

  mongoose.disconnect();
}

function processIssue(issue, callback) {

  var tag = '"(gh ' + issue.number.toString() + ')"';

  Task.textSearch(tag, function (err, output) {
    if (err) {
      return callback(err);
    }

    if (output.results.length) {
      // found the match, go ahead and just sync'd them up
      syncIssue(issue, output.results[0], callback);
    } else {
      // no match found, time to create a new task in Asana
      createAsanaTask(issue, callback);
    }
  });
}

function getAllIssues(repos, callback) {
  async.each(repos, function (repo, cb) {
    GithubConnector.getAllRepoIssues(repo, repo.assignee, function (err, issues) {
      if (err) {
        return callback(err);
      }
      saveItems(issues, Issue, cb);
    });
  }, callback);
}

function saveItems(items, iClass, callback) {
  async.map(items, function (item, cb) {
    // find a better way to do this?
    var raw = item.toObject();
    iClass.findOneAndUpdate({ id : item.id }, raw, { upsert : true }, cb);
  }, callback);
}

function getAllWorkspaces(callback) {
  AsanaConnector.getWorkspaces(function (err, workspaces) {
    if (err) {
      return callback(err);
    }
    saveItems(workspaces, Workspace, callback);
  });
}

function getMonitoredProjects(workspaces, callback) {

  var watchedWorkspaces = config.bindings.map(function (item) {
    return item.workspace;
  });

  async.map(workspaces, function (w, cb) {
    if (watchedWorkspaces.indexOf(w.name) == -1) {
      return cb();
    }
    AsanaConnector.getProjects(w, cb);
  }, function (err, mapped) {
    if (err) {
      return callback(err);
    }

    // flatten into a 1-dim array
    var projects = [];
    projects = projects.concat.apply(projects, mapped);
    // strip out the undefined values
    projects = projects.filter(function (item) {
      return item;
    });

    saveItems(projects, Project, callback);
  });
}

function getMonitoredTasks(projects, callback) {

  var monitoredProjects = config.bindings.map(function (item) {
    return item.project;
  });

  async.map(projects, function (project, cb) {
    if (monitoredProjects.indexOf(project.name) == -1) {
      return cb();
    }
    AsanaConnector.getTasksByProject(project, cb);
  }, function (err, mapped) {
    if (err) {
      return callback(err);
    }

    // flatten & filter
    var tasks = [];
    tasks = tasks.concat.apply(tasks, mapped);
    tasks = tasks.filter(function (item) {
      return item;
    });

    saveItems(tasks, Task, callback);
  });
}

function onError(err) {
  console.log(err);
}
mongoose.connect("mongodb://localhost/taskSync", function (err) {
  if (err) throw err;
  main();
});

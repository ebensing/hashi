
var async = require('async');
var mongoose = require('mongoose');
var http = require('http');

var config = require('./config.js');
var AsanaConnector = require('./connectors/asana.js');
var GithubConnector = require('./connectors/github.js');
var AsanaModels = require('./models/asana.js');
var GithubModels = require('./models/github.js')
var Workspace = AsanaModels.Workspace;
var Project = AsanaModels.Project;
var Task = AsanaModels.Task;
var Issue = GithubModels.Issue;
var Hook = GithubModels.Hook;

AsanaConnector.setKey(config.asanaKey);

GithubConnector.setAuthInfo(config.githubInfo.userName,
    config.githubInfo.password);

function main() {

  var workMap = {};
  var projectMap = {};

  var dataGathered = false;
  function cont(err) {
    if (err) {
      return onError(err);
    }
    dataGathered && parse(repos, workMap, projectMap);
    dataGathered = true;
  }

  // get Asana stuff
  getAllWorkspaces(function (err, workspaces) {
    if (err) {
      return onError(err);
    }
    // make the workspace map
    for (var i=0; i < workspaces.length; i++) {
      var w = workspaces[i];
      workMap[w.name] = w.id;
    }
    getMonitoredProjects(workspaces, function (err, projects) {
      if (err) {
        return onError(err);
      }
      // make the project map
      for (var i=0; i < projects.length; i++) {
        var p = projects[i];
        projectMap[p.name] = p.id;
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
      assignee : item.githubUser,
      project : item.project,
      workspace : item.workspace
    };
    return repo;
  });

  getAllIssues(repos, cont);
}


// once we get here, all of the data has been collected and is saved in the
// database. Time to process it and update anything that needs it
function parse(repos, workMap, projectMap) {
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
      // set the project & workspace on all the issues
      issues = issues.map(function (item) {
        item.p_id = projectMap[repo.project];
        item.w_id = workMap[repo.workspace];
        return item;
      });
      async.each(issues, processIssue, callback);
    });

    // make sure the appropriate webhooks exist
    checkHooks(repo);
  }, function (err) {
    if (err) {
      return onError(err);
    }
    console.log("done");
  });
}

function checkHooks(repo) {
  var cond = { repo : { name : repo.name, user : repo.user } };
  Hook.findOne(cond, function (err, hook) {
    if (err) {
      return onError(err);
    }

    if (hook == null) {
      var url = config.url + ":" + config.port.toString();
      GithubConnector.createWebHook(repo, ["issues"], url, function (err, hook) {
        if (err) {
          if (err.errors && err.errors.length &&
            err.errors[0].message != "Hook already exists on this repository") {
            return onError(err);
          } else {
            console.log("Hook already exsits, do nothing");
            return;
          }
        }
        console.log("Hook Created for %s/%s", repo.user, repo.name);
      });
    }
  });
}

function processIssue(issue, callback) {

  var tag = '"(gh ' + issue.number.toString() + ')"';

  Task.textSearch(tag, function (err, output) {
    if (err) {
      return callback(err);
    }

    if (output.results.length) {
      // found the match, go ahead and just sync'd them up
      syncIssue(issue, output.results[0].obj, callback);
    } else {
      // no match found, time to create a new task in Asana
      createAsanaTask(issue, tag, callback);
    }
  });
}

function syncIssue(issue, task, callback) {
  var changeSet = {};

  if (issue.title != task.name) {
    task.name = issue.title;
    changeSet.name = issue.title;
  }

  if (issue.state == 'closed' && !task.completed) {
    task.completed = true;
    task.completed_at = issue.closed_at;
    changeSet.completed = true;
    changeSet.completed_at = issue.closed_at;
  }

  var body = "(GH " + issue.number.toString() +")\n"
    + issue.body + "\n" + issue.url;

  if (task.notes != body) {
    task.notes = body;
    changeSet.notes = body;
  }

  // only perform the update if there have actually been changes
  if (Object.keys(changeSet).length !== 0) {
    AsanaConnector.updateTask(task, changeSet, callback);
  } else {
    callback();
  }
}

function createAsanaTask(issue, tag, callback) {

  var task = new Task({
    completed : false,
    name : issue.title,
    notes : tag.replace(/\"/g,'') + "\n" + issue.body + "\n" + issue.url,
    assignee_status : "inbox",
    projects : [{ id : issue.p_id }],
    workspace : { id : issue.w_id }
  });

  AsanaConnector.createTask(task, function (err, cTask) {
    if (err) {
      return callback(err);
    }
    var raw = cTask.toObject();
    Task.findOneAndUpdate({ id : cTask.id }, raw, { upsert : true }, callback);
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
  mongoose.disconnect();
}
mongoose.connect("mongodb://localhost/taskSync", function (err) {
  if (err) throw err;
  main();

  http.createServer(function (req, res) {
    var data = "";
    req.on('data', function (d) {
      data += d.toString();
    });

    req.on('end', function () {
      var reqObj;
      try {
        reqObj = JSON.parse(data);
      } catch(err) {
        return onError(err);
      }

      var issue = new Issue(reqObj.issue);
      Issue.findOneAndUpdate({ id : issue.id }, raw, { upsert : true }, function (err, is) {
        if (err) {
          return onError(err);
        }
        processIssue(is, function (err) {
          if (err) {
            return onError(err);
          }
        });
      });
    });

    res.writeHead(200, "OK", { 'Content-type' : 'text/html' });
    res.end();
  }).listen(config.port, function () {
    console.log("Listening on port %d", config.port);
  });
});

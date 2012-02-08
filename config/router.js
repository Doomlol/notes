// Added by Craig 2/6/2012

var routes = require('../routes');

var paths_to_routes = {
    '/': routes.index,
    '/test': routes.test
};

exports.setupRoutes = function(app) {
    for (var path in paths_to_routes) {
        app.get(path, paths_to_routes[path]);
    }
};
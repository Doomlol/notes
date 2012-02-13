// Added by Craig 2/6/2012

var routes = require('../routes');

var paths_to_routes = {
    '/': routes.index,
    '/test': routes.test,
    
    // Sandbox
    '/sandbox': routes.sandbox,
    '/sandbox/:path': routes.sandbox
    
    /*,
    '/sandbox/*': routes.error_404,
    
    // Error routes - keep last
    '/500': routes.error_500,
    '/*': routes.error_404
    */
};

exports.setupRoutes = function(app) {
    // Setup regular routes
    for (var path in paths_to_routes) {
        app.get(path, paths_to_routes[path]);
    }
    // Setup errors
    app.error(routes.error);
};

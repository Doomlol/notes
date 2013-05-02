// Added by Craig 2/6/2012

var routes = require('../routes');

if (false) {
    var paths_to_routes = {
        '/': routes.landing
    };
}
else {
    var paths_to_routes = [
        {path: '/', route: routes.pad},
        {path: '/alt', route: routes.alt},
        {path: '/about', route: routes.about},
        {path: '/partials/:path', route: routes.partials},
        
        // Sandbox
        {path: '/sandbox', route: routes.sandbox},
        {path: '/sandbox/:path', route: routes.sandbox},

        // Otherwise, if it doesn't match a path from /public,
        // render the pad
        //'/^(?!\/(images|stylesheets|javascript))/': routes.pad

        {path: /^(?!\/(images|stylesheets|javascript))/, route: routes.pad}

        /*,
        '/sandbox/*': routes.error_404,
        
        // Error routes - keep last
        '/500': routes.error_500,
        '/*': routes.error_404
        */
    ];
}

exports.setupRoutes = function(app) {
    // Setup regular routes
    //for (var path in paths_to_routes) {
    //    app.get(path, paths_to_routes[path]);
    //}
    for (var i = 0; i < paths_to_routes.length; i++) {
        var ptr = paths_to_routes[i];
        app.get(ptr.path, ptr.route);
    }
    // Setup errors
    app.error(routes.error);
};

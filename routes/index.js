
function isMobile(req) {
    var useragent = req.header('user-agent');
    return (/mobile/i.test(useragent));
}

function render(req, res, path, options) {
    if (isMobile(req)) {
        if (options.layout === true || typeof options.layout == 'undefined') {
            options.layout = 'layout-mobile';
        }
        path = 'mobile/' + path;
    }
    else {
        if (options.layout === true || typeof options.layout == 'undefined') {
            options.layout = 'layout-main';
        }
        path = 'main/' + path;
    }
    options.vars = options;
    res.render(path, options);
}

exports.index = function(req, res){
    render(req, res, 'index', { title: 'Express' });
};

exports.test = function(req, res){
    render(req, res, 'test', { title: 'Test!!' });
};



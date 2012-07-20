// main.js

var Util = {
    // Taken from Prototype, slightly modified
    cumulativeOffset: function(element) {
        var valueT = 0, valueL = 0;
        do {
            valueT += element.offsetTop  || 0;
            valueL += element.offsetLeft || 0;
            element = element.offsetParent;
        } while (element);
        return {left: valueL, top: valueT};
    },
    // Tell us if this event is a return
    isReturn: function(e) {
        return e.keyCode == 13;
    }
};

var Notes = {
    
    initialize: function() {
        console.log(this);
        this.setupListeners();
    },
    
    setupListeners: function() {
        $('#content')
            .focus(this.contentFocus.bind(this))
            .blur(this.contentBlur.bind(this))
            .keydown(this.contentChange.bind(this));
    },
    
    contentFocus: function(e) {
        $(document.body).addClass('focus');
    },
    
    contentBlur: function(e) {
        $(document.body).removeClass('focus');
    },
    
    // Basically if the content + margin is lower than the window bottom,
    // scrollTo(0,10000000)
    contentChange: function(e) {
        return;
        // Prototype functions that don't exist in jQuery
        // descendantOf
        // cumulativeOffset
        // offset() doesn't return what you'd expect
        
        if (!Util.isReturn(e))
            return;
        
        var content_offset = $('#content').offset().top;
        var line_node = window.getSelection().anchorNode.parentNode;  // The line the return happened in
        var in_content = $(line_node).parents().is('#content');
        
        if (!in_content)
            return;
        
        // This is based on line height, so for it to work, 'p' tags must have no margin/padding
        var line_offset = Util.cumulativeOffset(line_node).top;
        var line_bottom = line_offset + (parseInt($(line_node).css('line-height')) * 2);
        
        console.log('scrollTop:', -1 * document.body.scrollTop);
        console.log('line_bottom:', line_bottom);
        console.log('scrollTop + line_bottom:', -1 * document.body.scrollTop + line_bottom);
        console.log('window.innerHeight:', window.innerHeight);
        console.log('window.innerHeight + 41:', window.innerHeight - 41);
        
        if (-1 * document.body.scrollTop + line_bottom > window.innerHeight - 41) {
            console.log('okay');
            document.body.scrollTop = line_bottom - (window.innerHeight - 41);
        }
        else {
            console.log('no');
        }
    }
    
};

$(Notes.initialize.bind(Notes));





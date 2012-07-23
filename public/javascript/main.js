// For the main site Pad

var Notes = {
	
	parse: {
		app_id: 'BjMBtcrI8aQOGvWXPgysjccUXANpBvheK2mFyLSM',
		js_key: 'YdnMLhDKkrISbqVdxAi73Y9GBAKisTmivSWa9YHF'
	},

	initialize: function() {
		Parse.initialize(this.parse.app_id, this.parse.js_key);
	}
};

$(Notes.initialize.bind(Notes));
// For the main site Pad

var Notes = {
	
	pad_timer: null,

	initialize: function() {
		$('#pad').focus();
		this.restorePad();
		this.setupListeners();
	},
	setupListeners: function() {
		$('#pad').keyup(this.padKeyup.bind(this));
	},
	padKeyup: function(e) {
		clearInterval(this.pad_timer);
		this.pad_timer = setTimeout(this.savePad.bind(this), 1000);
		$('#status').addClass('unsaved');
	},
	savePad: function() {
		var data = this.getData();
		this.setObject('data', data);
		$('#status').removeClass('unsaved');
	},
	restorePad: function() {
		var data = this.getObject('data');
		if (!data)
			return;
		$('#pad').val(data.text);
	},
	// Should take a param like pad ID?
	getData: function() {
		return {
			text: $('#pad').val()
		};
	},
	setObject: function(key, value) {
		var value_string = JSON.stringify(value);
		localStorage.setItem(key, value_string);
	},
	getObject: function(key) {
		var item = localStorage.getItem(key);
		return JSON.parse(item);
	}
};
// For the main site Pad

(function() {
	window.indexedDB = window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB || window.msIndexedDB;
	window.IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction || window.mozIDBTransaction || window.msIDBTransaction;

	window.Defaults = {
		days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
	};
})();


// Note class
function Note(note_data) {

	// The right-hand values must map to the DB properties
	this.id          = note_data.id;
	this.title       = note_data.title;
	this.body        = note_data.body;
	this.updated_at  = note_data.updated_at || (new Date()).valueOf();

	this.elements    = {
		note_item: null,
		title: null,
		delete_link: null
	};

	this.init = function() {
		this.setupElements();
	};
	this.setupElements = function() {
		this.elements.note_item = this.generateListElement();
		this.elements.title = this.elements.note_item.find('.title');
		this.elements.delete_link = this.elements.note_item.find('.delete');
		this.elements.note_item.click(App.loadNote.bind(App, this.id));
		this.elements.delete_link.click(App.deleteNote.bind(App, this.id));
	};
	this.generateListElement = function() {
		if ($('#note_item_' + this.id).length)
			return $($('#note_item_' + this.id)[0]);
		else
			return $('#note_item_tmpl').tmpl({id: this.id, title: this.getTitle(true), date: this.getFormattedTime()});
	};
	// Uncomfortable about a reference to App here
	this.appendToList = function() {
		this.elements.note_item.appendTo(App.elements.note_list);
	};
	this.removeFromList = function() {
		this.elements.note_item.remove();
	};

	// GETTERS
	this.getData = function() {
		return {
			id: this.id,
			title: this.title,
			body: this.body,
			updated_at: this.updated_at
		};
	};
	this.getTitle = function(use_default) {
		return this.title || (use_default ? 'Untitled' : '');
	};
	this.getBody = function() {
		return this.body;
	};
	this.getFormattedTime = function() {
		return Utils.formatDate(this.updated_at);
	};

	// SETTERS
	this.setTitle = function(title) {
		this.title = title;
		this.elements.title.html(this.title);
	};
	this.setBody = function(body) {
		this.body = body;
	};

	this.init();
};


var NotesDB = {
	db: null,
	settings: {
		name: 'notes-db',
		version: 15
	},
	blank_note: {
		title: 'Untitled',
		body: '',
		updated_at: ''
	},
	initialize: function(cb) {
		var open_request = window.indexedDB.open(this.settings.name, this.settings.version);
		open_request.onblocked = this.open_onblocked.bind(this);
		open_request.onerror = this.open_onerror.bind(this);
		open_request.onupgradeneeded = this.open_onupgradeneeded.bind(this);
		open_request.onsuccess = this.open_onsuccess.bind(this, cb);
	},
	open_onerror: function(event) {
		console.log('There was an error with the db (general)', event);
	},
	open_onblocked: function(event) {
		console.log('There was an error with the db (blocked)', event);
	},
	open_onupgradeneeded: function(event) {
		this.upgrade(event.target.result);
	},
	open_onsuccess: function(cb, event) {
		this.db = event.target.result;
		this.db.onabort = this.db_onabort.bind(this);
		this.db.onerror = this.db_onerror.bind(this);
		this.db.onversionchange = this.db_onversionchange.bind(this);
		if (this.db.setVersion && Number(this.db.version) != this.settings.version) {
			var version_request = this.db.setVersion(this.settings.version);
			version_request.onsuccess = function(event) {
				this.upgrade();
			}.bind(this);
		}
		if (cb) cb();
	},
	db_onabort: function(event) {
		console.log('db abort', event);
	},
	db_onerror: function(event) {
		console.log('db error', event);
	},
	db_onversionchange: function(event) {
		console.log('db version change', event);
	},
	transaction_onabort: function(event) {
		console.log('transaction abort', event);
	},
	transaction_onerror: function(event) {
		console.log('transaction error', event);
	},
	transaction_oncomplete: function(event) {
		//console.log('transaction complete', event);
	},
	getTransaction: function() {
		var transaction = this.db.transaction(['notes'], IDBTransaction.READ_WRITE);
		transaction.onabort = this.transaction_onabort.bind(this);
		transaction.onerror = this.transaction_onerror.bind(this);
		transaction.oncomplete = this.transaction_oncomplete.bind(this);
		return transaction;
	},
	getNotesStore: function() {
		var transaction = this.getTransaction();
		var notes_store = transaction.objectStore('notes');
		return notes_store;
	},
	// You need to put checks around the createObjectStores to make sure they don't
	// already exist. Otherwise when you bump the version you'll get  DOM IDBDatabase Exception 4
	// and db_onabort will be called
	upgrade: function() {
		var notes_store = this.db.createObjectStore('notes', {keyPath: 'id', autoIncrement: true});
		notes_store.createIndex('title', 'title', {unique: false});
		notes_store.createIndex('body', 'body', {unique: false});
		notes_store.createIndex('updated_at', 'updated_at', {unique: false});
	},
	getNotes: function(cb) {
		var notes = [];
		var notes_store = this.getNotesStore();
		var req = notes_store.openCursor();       // getAll() is supported in FF - see if in webkit later
		req.onerror = function(event) {console.log('getNotes req error', event);}
		req.onsuccess = function(event) {
			var cursor = event.target.result;
			if (cursor) {
				notes.push(new Note(cursor.value));   // cursor.key, cursor.value available
				cursor.continue();
			}
			else {
				if (cb) cb(notes);
			}
		}
	},
	getNote: function(note_id, cb) {
		var notes_store = this.getNotesStore();
		var req = notes_store.get(note_id);
		req.onerror = function(event) {console.log('getNote req error', event);}
		req.onsuccess = function(event) {
			var note;
			if (req.result)
				note = new Note(req.result);
			if (cb) cb(note);
		}
	},
	addNote: function(cb) {
		var notes_store = this.getNotesStore();
		var date = (new Date()).valueOf();
		var req = notes_store.add({updated_at: date});
		req.onerror = function(event) {console.log('addNote req error', event);}
		req.onsuccess = function(event) {
			if (cb) cb(new Note({id: req.result}));
		}
	},
	// Can pass back either a note id or null
	editNote: function(note, cb) {
		if (!note || !note.id) {
			if (cb) cb(null);
			return;
		}
		note.updated_at = (new Date()).valueOf();
		var notes_store = this.getNotesStore();
		var req = notes_store.put(note.getData());
		var note_data = note.getData();
		req.onerror = function(event) {console.log('addNote req error', event);}
		req.onsuccess = function(event) {
			if (cb) cb(note_data);
		}
	},
	deleteNote: function(note_id, cb) {
		var notes_store = this.getNotesStore();
		var req = notes_store.delete(note_id);
		req.onerror = function(event) {console.log('deleteNote req error', event);}
		req.onsuccess = function(event) {
			if (cb) cb(note_id);
		}
	}
};


var App = {

	errors: {
		db_connect_fail: 'Could not connect to the local database. Your browser may be in privacy mode.',
		db_generic: 'There was a problem with the database.'
	},
	parse: {
		app_id: 'BjMBtcrI8aQOGvWXPgysjccUXANpBvheK2mFyLSM',
		js_key: 'YdnMLhDKkrISbqVdxAi73Y9GBAKisTmivSWa9YHF'
	},
	firebase: {

	},
	elements: {
		note_list: '#notes',
		note_title: '#note_title',
		note_text: '#note_text',
		save_status: '#save_status'
	},
	default_note: {
		title: 'Your first note',
		updated_at: (new Date()).valueOf()
	},

	current_note: null,
	save_timeout: null,

	// Initialize the DB, and do anything else that doesn't rely on the DB
	initialize: function() {
		this.setupElements();
		this.setupListeners();
		// This should be the last line in the function
		NotesDB.initialize(this.initialize_cb.bind(this));
		//Parse.initialize(this.parse.app_id, this.parse.js_key);
	},

	// Initialization steps that need to be done after the DB initialized go here
	initialize_cb: function() {
		this.refreshNoteList();
	},

	setupElements: function() {
		for (var el in this.elements) {
			this.elements[el] = $(this.elements[el]);
		}
	},
	setupListeners: function() {
		this.elements.note_title.keydown(this.titleKeydown.bind(this));
		this.elements.note_title.keyup(this.titleKeyup.bind(this));
		this.elements.note_text.keydown(this.bodyKeydown.bind(this));
		this.elements.note_text.keyup(this.bodyKeyup.bind(this));
	},

	titleKeydown: function(event) {
		this.saved(false);
	},
	titleKeyup: function(event) {
		if (this.current_note)
			this.current_note.setTitle(event.target.value);
	},
	bodyKeydown: function(event) {
		this.saved(false);
	},
	bodyKeyup: function(event) {

	},

	saved: function(is_saved) {
		if (is_saved) {
			this.elements.save_status.addClass('saved').attr('title', 'Saved');
		}
		else {
			this.elements.save_status.removeClass('saved').attr('title', 'Not saved');
			clearTimeout(this.save_timeout);
			this.save_timeout = setTimeout(this.saveNote.bind(this), 1000);
		}
	},

	refreshNoteList: function() {
		this.elements.note_list.empty();
		NotesDB.getNotes(this.refreshNoteList_cb.bind(this));
	},
	refreshNoteList_cb: function(db_notes) {
		if (!db_notes.length) {
			this.createNote();
			return;
		}
		$.each(db_notes, function(i, note) {
			note.appendToList();
		}.bind(this));
		this.loadNote(db_notes[0].id);
	},

	loadNote: function(note_id, event) {
		if (this.current_note)
			this.getCurrentNoteItem().removeClass('selected');
		this.current_note = null;
		this.elements.note_title.val('');
		this.elements.note_text.html('');
		NotesDB.getNote(note_id, this.loadNote_cb.bind(this));
	},
	loadNote_cb: function(note) {
		this.current_note = note;
		this.getCurrentNoteItem().addClass('selected');
		this.elements.note_title.val(note.getTitle(false));
		this.elements.note_text.html(note.body || '');
	},

	createNote: function() {
		NotesDB.addNote(this.createNote_cb.bind(this));
	},
	createNote_cb: function(note) {
		note.appendToList();
	},

	// Possibly change from this to "note.delete()"
	// No - because you can click delete on unloaded notes.
	// Keep save the same way for symmetry
	deleteNote: function(note_id, event) {
		event.stopPropagation();
		NotesDB.deleteNote(note_id, this.deleteNote_cb.bind(this));
	},
	deleteNote_cb: function(note_id) {
		$('#note_item_' + note_id).remove();
		this.refreshNoteList();
	},

	saveNote: function() {
		if (!this.current_note)
			return;
		this.current_note.setTitle(this.elements.note_title.val());
		this.current_note.setBody(this.elements.note_text.html());
		NotesDB.editNote(this.current_note, this.saveNote_cb.bind(this));
	},
	saveNote_cb: function(note_data) {
		$('#note_item_' + note_data.id + ' span.time').html(Utils.formatDate(note_data.updated_at));
		if (this.current_note.body == note_data.body)
			this.saved(true);
	},

	// =========================================================================
	// Utility functions =======================================================

	getCurrentNoteItem: function() {
		return $('#note_item_' + this.current_note.id);
	},

	showError: function(text) {
		$('.main_error').html(text).fadeIn(250);
	},

	hideError: function() {
		$('.main_error').fadeOut(250);
	}
};

var Utils = {

	formatDate: function(timestamp) {
		var date = new Date (timestamp);
		var hours = date.getHours() % 12 + (date.getHours()%12==0?1:0);
		var minutes = this.digits(2, date.getMinutes());
		var am_pm = date.getHours() < 12 ? 'am' : 'pm';
		return [hours, ':', minutes, ' ', am_pm].join('');
	},

	// pad a number with leading zeroes
	digits: function(n, number) {
		var zeroes = '';
		var number_digits = Math.ceil(Math.log(number+1)/Math.LN10);
		if (number_digits < n)
			for (var i = 0; i < n - number_digits; i++)
				zeroes += '0';
		return zeroes + number;
	}

};

$(App.initialize.bind(App));










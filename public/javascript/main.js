// For the main site Pad

(function() {
	window.indexedDB = window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB || window.msIndexedDB;
	window.IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction || window.mozIDBTransaction || window.msIDBTransaction;

	window.Defaults = {
		days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
	};
})();


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
				notes.push(cursor.value);   // cursor.key, cursor.value available
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
			if (cb) cb(req.result);
		}
	},
	addNote: function(cb) {
		var notes_store = this.getNotesStore();
		var date = (new Date()).valueOf();
		var req = notes_store.add({updated_at: date});
		req.onerror = function(event) {console.log('addNote req error', event);}
		req.onsuccess = function(event) {
			if (cb) cb(req.result, date); // The 'id', not the whole note
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
		var req = notes_store.put(note);
		req.onerror = function(event) {console.log('addNote req error', event);}
		req.onsuccess = function(event) {
			if (cb) cb(req.result, note.title, note.updated_at);
		}
	}
};


var Notes = {

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
		note_text: '#note_text'
	},

	templates: {
		note_item: '#note_item_tmpl'
	},

	default_note: {
		title: 'Your first note',
		updated_at: (new Date()).valueOf()
	},

	current_note_id: null,

	// Initialize the DB, and do anything else that doesn't rely on the DB
	initialize: function() {
		this.setupElements();
		// This should be the last line in the function
		NotesDB.initialize(this.initialize_cb.bind(this));
		//Parse.initialize(this.parse.app_id, this.parse.js_key);
	},

	// Initialization steps that need to be done after the DB initialized go here
	initialize_cb: function() {
		this.refreshNoteList();

		// ... Load the first note ...
	},

	setupElements: function() {
		for (var el in this.elements) {
			this.elements[el] = $(this.elements[el]);
		}
		for (var template in this.templates) {
			this.templates[template] = $(this.templates[template]);
		}
	},

	refreshNoteList: function() {
		NotesDB.getNotes(this.refreshNoteList_cb.bind(this));
	},
	refreshNoteList_cb: function(notes) {
		if (!notes.length) {
			//notes.push({id: 'default', title: this.default_note.title, date: this.default_note.updated_at});
			this.createNote();
			return;
		}
		$.each(notes, function(i, v) {
			var title = v.title || 'Untitled';
			var updated_at = this.formatDate(v.updated_at);
			var note_el = this.templates.note_item.tmpl({id: v.id, title: title, date: updated_at});
			var delete_el = note_el.find('.delete');
			note_el.click(this.loadNote.bind(this, v.id));
			delete_el.click(this.deleteNote.bind(this, v.id));
			this.elements.note_list.append(note_el);
		}.bind(this));
		this.loadNote(notes[0].id);
	},

	loadNote: function(note_id, event) {
		if (this.current_note_id) {
			this.getCurrentNoteItem().removeClass('selected');
		}
		this.current_note_id = null;
		this.elements.note_title.attr('value', '');
		this.elements.note_text.html('');
		NotesDB.getNote(note_id, this.loadNote_cb.bind(this));
	},
	loadNote_cb: function(note) {
		this.current_note_id = note.id;
		this.getCurrentNoteItem().addClass('selected');
		this.elements.note_title.attr('value', note.title || '');
		this.elements.note_text.html(note.body || '');
	},

	createNote: function() {
		NotesDB.addNote(this.createNote_cb.bind(this));
	},
	createNote_cb: function(note_id, updated_at) {
		var title = 'Untitled';
		updated_at = this.formatDate(updated_at);
		var note_el = this.templates.note_item.tmpl({id: note_id, title: title, date: updated_at});
		var delete_el = note_el.find('.delete');
		note_el.click(this.loadNote.bind(this, note_id));
		delete_el.click(this.deleteNote.bind(this, note_id));
		this.elements.note_list.append(note_el);
	},

	deleteNote: function(note_id, event) {
		event.stopPropagation();
	},
	deleteNote_cb: function() {

	},

	saveNote: function() {
		if (!this.current_note_id)
			return;
		var note = {
			id: this.current_note_id,
			title: this.elements.note_title.attr('value'),
			body: this.elements.note_text.html()
		};
		NotesDB.editNote(note, this.saveNote_cb.bind(this));
	},
	saveNote_cb: function(id, title, updated_at) {
		updated_at = this.formatDate(updated_at, 'simple');
		$('#note_item_' + id + ' span.title').html(title);
		$('#note_item_' + id + ' span.time').html(updated_at);
	},

	// ===========================================================
	// Utility functions

	getCurrentNoteItem: function() {
		return $('#note_item_' + this.current_note_id);
	},

	showError: function(text) {
		$('.main_error').html(text).fadeIn(250);
	},

	hideError: function() {
		$('.main_error').fadeOut(250);
	},

	formatDate: function(timestamp) {
		var date = new Date (timestamp);
		var hours = date.getHours() % 12 + 1;
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

$(Notes.initialize.bind(Notes));










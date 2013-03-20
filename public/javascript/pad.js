'use strict';

// For the main site Pad

(function() {
	if (!indexedDB || !IDBTransaction) {
		alert('Your browser does not support local databases');
	}
})();


filepicker.setKey('AdxGfHDDjQ2OTkf5i11y1z');

var base_ref = new Firebase('https://cilphex.firebaseio.com/');
var auth_client;


// This is a note!
function Note(value) {
	this.value = value;
	this.uploads = [];
	this.media_data = null;
	this.setValue = function(item) {
		for (var key in this.value) {
			delete this.value[key];
		}
		this.updateValue(item);
	};
	this.updateValue = function(item) {
		for (var key in item) {
			var value = item[key];
			//if (typeof value != 'undefined') {
				this.value[key] = value;
			//}
		}
	};
	this.getValue = function() {
		return this.value;
	};
	// This is used when editing a note, because you can't pass along attachments
	this.getContent = function() {
		return {
			id:         this.value.id,
			title:      this.getTitle(),
			body:       this.value.body,
			updated_at: this.value.updated_at
		};
	};
	this.getId = function() {
		return this.value.id;
	};
	this.getTitle = function() {
		return this.value.title || '';
	};
	this.getBody = function() {
		return this.value.body || '';
	};
	this.getTime = function() {
		return Utils.formatDate(this.value.updated_at);
	};
	this.getAttachments = function() {
		return this.value.attachments || {};
	};
	this.getAttachmentsLength = function() {
		return Object.keys(this.getAttachments()).length;
	};
	this.getAttachmentKey = function(attachment) {
		if (!this.value.attachments)
			return null;
		for (var a in this.value.attachments) {
			if (this.value.attachments[a].url == attachment.url) {
				return a;
			}
		}
		return null;
	};
}


// Here is where you put your db specification per version
function upgrade_database(db) {
	// version is in db.version if needed
	if ($.inArray('notes', db.objectStoreNames) < 0) {
		var notes_store = db.createObjectStore('notes', {keyPath: 'id', autoIncrement: true});
		notes_store.createIndex('title', 'title', {unique: false});
		notes_store.createIndex('body', 'body', {unique: false});
		notes_store.createIndex('updated_at', 'updated_at', {unique: false});
	}
	return true;
}


var Utils = {
	getCurrentTimestamp: function() {
		return (new Date()).valueOf();
	},
	formatDate: function(timestamp) {
		var date = new Date (timestamp);
		var hours = date.getHours() % 12 + (date.getHours()%12==0?1:0);
		var minutes = this.digits(2, date.getMinutes());
		var am_pm = date.getHours() < 12 ? 'am' : 'pm';
		return [hours, ':', minutes, ' ', am_pm].join('');
	},
	formatDuration: function(s) {
		s = Math.ceil(s);
		var seconds = s % 60;
		var minutes = Math.floor(s/60);
		var hours = Math.floor(s/3600);
		var time = minutes + ':' + this.digits(2, seconds);
		if (hours)
			time = hours + ':' + time;
		return time;
	},
	formatDurationProgress: function(s, progress) {
		//Math.log(val) / Math.LN10;
		progress = Math.round(progress);
		var s = Math.ceil(s);
		var seconds = progress % 60;

		var total_minutes = Math.floor(s/60);
		var minutes_pad = Math.ceil(Math.log(total_minutes+1)/Math.LN10);
		var minutes = Math.floor(progress/60);

		var total_hours = Math.floor(s/3600);
		var hours_pad = Math.ceil(Math.log(total_hours+1)/Math.LN10);
		var hours = Math.floor(progress/3600);

		var time = this.digits(minutes_pad, minutes) + ':' + this.digits(2, seconds);
		if (hours)
			time = this.digits(hours_pad, hours) + ':' + time;
		return time;
	},
	// Pad a number with leading zeroes
	digits: function(n, number) {
		var zeroes = '';
		var number_digits = Math.ceil(Math.log(number+1)/Math.LN10);
		if (number == 0)
			n-=1;
		//var number_digits = (number == 0 ? n : Math.ceil(Math.log(number+1)/Math.LN10));
		if (number_digits < n)
			for (var i = 0; i < n - number_digits; i++)
				zeroes += '0';
		return zeroes + number;
	},
	// From http://www.regular-expressions.info/email.html
	validate_email: function(email) {
		var regex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,4}$/i;
		return regex.test(email);
	},
	isFileType: function(type, attachment) {
		switch(type) {
			case 'image':
				var extensions = ['jpg', 'jpeg', 'png'];
				return /^image\//i.test(attachment.mimetype) || attachment.key.match(this.getFileRegex(extensions));
				break;
			case 'audio':
				var extensions = ['mp3'];
				return /^audio\//i.test(attachment.mimetype) || attachment.key.match(this.getFileRegex(extensions));
				break;
			case 'video':
				var extensions = ['mp4'];
				return /^video\//i.test(attachment.mimetype) || attachment.key.match(this.getFileRegex(extensions));
				break;
			default:
				return true;
		}
	},
	getFileType: function(attachment) {
		if (this.isFileType('image', attachment))
			return 'image';
		else if (this.isFileType('audio', attachment))
			return 'audio';
		else if (this.isFileType('video', attachment))
			return 'video';
		else
			return 'other';
	},
	getFileRegex: function(extensions) {
		return new RegExp("\." + extensions.join('|') + '$', 'i');
	}
};

// Database module - IndexedDB
// Factory - multiple instances
angular.module('IndexedDBModule', [])
	.factory('indexeddb', function($rootScope) {
		function IndexedDB(name, version, store, item_class, upgrade_function) {
			this.db = null;
			this.settings = {
				name: name,
				version: version,
				store: store,
				item_class: item_class,
				upgrade_function: upgrade_function
			};
			this.queue = [];
			this.initialize = function() {
				var open_request = window.indexedDB.open(this.settings.name, this.settings.version);
				open_request.onblocked = this.open_onblocked.bind(this);
				open_request.onerror = this.open_onerror.bind(this);
				open_request.onupgradeneeded = this.open_onupgradeneeded.bind(this);
				open_request.onsuccess = this.open_onsuccess.bind(this);
			};
			this.initialize_done = function() {
				this.initialized = true;
				this.releaseQueue();
			};
			this.open_onblocked = function(event) {
				console.log('There was an error with the db (blocked)', event);
			};
			this.open_onerror = function(event) {
				console.log('There was an error with the db (general)', event);
			};
			this.open_onupgradeneeded = function(event) {
				var initialized = this.settings.upgrade_function(event.target.result);
				if (!initialized) {
					alert('Error opening database');
				}
			};
			this.open_onsuccess = function(event) {
				this.db = event.target.result;
				this.db.onabort = this.db_onabort.bind(this);
				this.db.onerror = this.db_onerror.bind(this);
				this.db.onversionchange = this.db_onversionchange.bind(this);
				this.initialize_done();
			};
			this.db_onabort = function(event) {
				console.log('db abort', event);
			};
			this.db_onerror = function(event) {
				console.log('db error', event);
			};
			this.db_onversionchange = function(event) {
				console.log('db version change', event);
			};
			this.transaction_onabort = function(event) {
				console.log('transaction abort', event);
			};
			this.transaction_onerror = function(event) {
				console.log('transaction error', event);
			};
			this.transaction_oncomplete = function(event) {
				//console.log('transaction complete', event);
			};
			this.getTransaction = function() {
				var transaction = this.db.transaction([this.settings.store], 'readwrite'); //IDBTransaction.READ_WRITE
				transaction.onabort = this.transaction_onabort.bind(this);
				transaction.onerror = this.transaction_onerror.bind(this);
				transaction.oncomplete = this.transaction_oncomplete.bind(this);
				return transaction;
			};
			this.getStore = function() {
				var transaction = this.getTransaction();
				var store = transaction.objectStore(this.settings.store);
				return store;
			};
			this.get = function(opts) { //, cb
				var id = (new Number(opts.id)).valueOf() || -1;
				var store = this.getStore();
				var req = store.get(id);
				req.onerror = function(event) {
					opts.failure();
				}.bind(this);
				req.onsuccess = function(event) {
					if (req.result) {
						var item = this.classify(req.result);
						opts.success(item);
					}
					else {
						opts.failure();
					}
				}.bind(this);
			};
			this.getAll = function(opts) {  // cb
				var result = [];
				var store = this.getStore();
				var req = store.openCursor(); // getAll() is supported in FF - see if in webkit later
				req.onerror = function(event) {
					opts.failure();
				}.bind(this);
				req.onsuccess = function(event) {
					var cursor = event.target.result;
					if (cursor) {
						var item = this.classify(cursor.value)
						result.push(item);
						cursor.continue();
					}
					else {
						opts.success(result);
					}
				}.bind(this);
			};
			this.add = function(opts) {
				var store = this.getStore();
				var date = Utils.getCurrentTimestamp();
				var req = store.add({updated_at: date});
				req.onerror = function(event) {
					opts.failure();
				}.bind(this);
				req.onsuccess = function(event) {
					var item = this.classify({id: req.result, updated_at: date});  // is this updated_at needed?
					opts.success(item);
				}.bind(this);
			};
			this.edit = function(opts) {
				var item = opts.item;
				if (!item || !item.id) {
					opts.failure();
					return;
				}
				item.updated_at = Utils.getCurrentTimestamp();
				var store = this.getStore();
				var req = store.put(item);
				req.onerror = function(event) {
					opts.failure();
				}.bind(this);
				req.onsuccess = function(event) {
					opts.success(item);
				}.bind(this);
			};
			this.delete = function(opts) {
				var id = (opts.item && opts.item.id) || opts.id;
				var store = this.getStore();
				var req = store.delete(id);
				req.onerror = function(event) {
					opts.failure();
				}.bind(this);
				req.onsuccess = function(event) {
					opts.success(id);
				}.bind(this);
			};
			this.enqueue = function(f) {
				this.queue.push(f);
				if (this.initialized)
					this.releaseQueue();
			};
			this.releaseQueue = function() {
				while(this.queue.length)
					this.queue.shift()();
			};
			this.classify = function(item) {
				if (this.settings.item_class)
					return (new this.settings.item_class(item))
				else
					return item;
			};
			this.initialize();
		}
		// Keeps track of object references
		function IndexedDBFactory(name, version, store, item_class, upgrade_function) {
			var db = new IndexedDB(name, version, store, item_class, upgrade_function);
			// These values are returned by default
			var funcs = {
				get: {},
				getAll: [],
				add: {},
				edit: {},
				delete: null
			};
			for (var f in funcs) {
				var retval = angular.copy(funcs[f]);
				funcs[f] = function(retval, func, opts) {
					opts = opts || {};
					// This needs to be separated into a new reference so successive returns do
					// not all point to the same objects
					var retval_copy = angular.copy(retval);
					var params = angular.copy(opts);
					params.success = function(retval_copy, result) {
						retval_copy ? angular.copy(result, retval_copy) : (retval_copy = result);
						$rootScope.$apply();
						if (opts.success)
							opts.success(retval_copy);
					}.bind(db, retval_copy);
					params.failure = function(retval_copy, result) {
						retval_copy ? angular.copy(result, retval_copy) : (retval_copy = result);
						angular.copy(result, retval_copy);
						if (opts.failure)
							opts.failure(retval_copy);
					}.bind(db, retval_copy);
					db.enqueue(db[func].bind(db, params));
					return retval_copy;
				}.bind(this, retval, f);  // retval is messed if not bound
			}
			return funcs;
		}
		return IndexedDBFactory;
	});

// Service
angular.module('FirebaseModule', [])
	.service('firebase', function($rootScope) {

		//this.base = new Firebase('https://cilphex.firebaseio.com/users/cilphex/notes');

		this.setUser = function(userid) {
			this.user_ref = base_ref.child('users').child(userid).child('notes');
		};
		// This should be changed to item_ref, and use a 'classify' system like the db storage
		this.get = function(opts) {

			// It is questionable whether opts.replace should be required here

			var note = opts.replace || new Note({id: opts.id});
			var note_ref = this.user_ref.child(opts.id);
			var once = false;
			note_ref.off('value');
			note_ref.on('value', function(snapshot) {
				//console.log('ref.on callback fired');

				// Whether we're calling storage.get, or it's a remote db update,
				// update the value of the note
				note.updateValue(snapshot.val());

				// If we called storage.get, call the callback. Don't $apply - let that happen
				// in the callback. Consider calling $apply if opts.success does not exist
				if (!once) {
					if (note.value && opts.success) {
						//console.log('firebase.get success');
						opts.success(note);
					}
					else if (!note.value && opts.failure) {
						console.log('firebase.get failure');
						opts.failure();
					}
					once = true;
				}

				// This is what happens when on('value') gets fired from a remote db update.
				// Note: theoretically this will call $rootScope.$apply every time any note is
				// remotely updated, even if it's not the current note.  Maybe try to make this
				// only fire if 'note' is the current note?
				else {
					// Maybe just only do this if not currently $apply-ing or $digest-ing
					// look up the stackoverflow stuff for a version of safeApply, it should have it
					if (!($rootScope.$$phase == '$apply' || $rootScope.$$phase == '$digest'))
						$rootScope.$apply();
				}
			});
			return note;
		};
		this.getAll = function(opts) {
			var ret = [];
			if (this.user_ref) {
				this.user_ref.once('value', function(snapshot) {
					var notes = snapshot.val();
					for (var n in notes) {
						notes[n].id = n;
						var note = new Note(notes[n]);
						ret.push(note);
					}
					if (opts.success)
						opts.success(ret);
				});
			}
			else {
				console.log('user_ref does not exist; getAll skipped');
			}
			return ret;
		};
		this.add = function(opts) {
			var ret = {};
			var item = {updated_at: Utils.getCurrentTimestamp()}
			var note_ref = this.user_ref.push(item, function(error, dummy) {
				if (!error && opts.success) {
					item.id = note_ref.name();
					var note = new Note(item);
					angular.copy(note, ret);
					opts.success(note);
				}
				else if (error && opts.failure) {
					opts.failure();
				}
			});
			return ret;
		};
		this.delete = function(opts) {
			this.user_ref.child(opts.id).remove(function(error, dummy) {
				if (!error && opts.success) {
					opts.success(opts.id);
				}
				else if (error && opts.failure) {
					opts.failure();
				}
			});
		};
		this.edit = function(opts) {
			console.log('edit opts', opts);
			var item = opts.item;
			this.user_ref.child(item.id).update(item, function(error, dummy) {
				// does opts need to be bound to this function for confusion not to occur?
				if (!error && opts.success)
					opts.success(item);
				else if (error && opts.failure)
					opts.failure();
			});
			return {};
		};
		this.attach = function(opts) {
			var items = opts.items;
			for (var i = 0; i < items.length; i++) {
				var item = items[i];
				item.updated_at = Utils.getCurrentTimestamp();
				var attachmentref = this.user_ref.child(opts.id).child('attachments').push(item, function(item, error, dummy) {
					if (!error && opts.success) {
						item.firebasekey = attachmentref.name();
						opts.success(item);
					}
					else if (error && opts.failure) {
						opts.failure(item);
					}
				}.bind(this, item));
			};
			return true;
		};
		this.unattach = function(opts) {
			this.user_ref.child(opts.id).child('attachments').child(opts.attachment_key).remove(function(error, dummy) {
				if (!error && opts.success) {
					opts.success(opts);
				}
				else if (error && opts.failure) {
					opts.failure();
				}
			});
			return true;
		};
	});

// Service - only one instance
// This should use a prefix
angular.module('LocalStorageModule', [])
	.service('localStorageService', function() {
		this.prefix = 'notesfm-';
		this.getPrefixedKey = function(key, opts) {
			return (this.prefix || '') + (opts && opts.prefix || '') + key;
		}
		this.set = function(key, value, opts) {
			if (typeof value == 'ojbect')
				value = JSON.stringify(value);
			key = this.getPrefixedKey(key, opts);
			localStorage.setItem(key, value);
		};
		this.get = function(key, opts) {
			key = this.getPrefixedKey(key, opts);
			var value = localStorage.getItem(key);
			try {
				return JSON.parse(value);
			}
			catch(e) {
				return value;
			}
		};
		this.remove = function(key) {
			return localStorage.removeItem(key);
		};
		this.clearAll = function() {
			for (var i in localStorage)
				this.remove(i);
		};
	});

// Maybe once this is working you can remove LocalStorageModule / localStorageService from
// the controllers.
// "storage" might be a bad name as this is not a replacement for localStorage, just
// indexeddb and firebase.  Maybe "database"
angular.module('NotesHelperModule', ['LocalStorageModule', 'IndexedDBModule', 'FirebaseModule'])
	.service('storage', function(indexeddb, firebase) {
		// This should be a helper for abstracting the switching between local
		// storage and firebase
		var mechanism;
		var synced = false;
		// I don't like 'setuser' being here because it's specific, not generic
		var storage_functions = ['get', 'getAll', 'add', 'delete', 'edit', 'setUser', 'attach', 'unattach'];
		for (var i = 0; i < storage_functions.length; i++) {
			var func = storage_functions[i];
			this[func] = function(func) {
				var args = Array.prototype.slice.call(arguments).slice(1);
				if (mechanism[func])
					return mechanism[func].apply(mechanism, args);
				else
					throw "This storage mechanism doesn't support '" + func + "'"
			}.bind(this, func);
		}
		this.sync = function() {
			console.log('storage: sync');
			this.setMechanism('firebase');
			this.synced = true;
		}
		this.local = function() {
			console.log('storage: local');
			this.setMechanism('indexeddb');
			this.synced = false;
		}
		this.setMechanism = function(m) {
			switch (m) {
				case 'firebase':
					mechanism = firebase;
					break;
				default:
					mechanism = indexeddb('notes-db', 28, 'notes', Note, upgrade_database);
			};
		}
		this.printMechanism = function() {
			console.log('mechanism:', mechanism);
		}
	})
	.service('settings', function($rootScope, localStorageService) {

		var storage_prefix = 'setting-';
		var settings = ['type', 'startup', 'fontfamily', 'theme', 'expanded'];

		// Putting something on $rootScope probably isn't the right way to do this
		$rootScope.settings = {};

		function settingsChange(setting, new_value, old_value) {
			if (new_value == old_value)
				return;
			localStorageService.set(setting, new_value, {prefix: storage_prefix});
		}
		function val(setting) {
			return this.settings[setting];
		}
		angular.forEach(settings, function(s) {
			$rootScope.settings[s] = localStorageService.get(s, {prefix: storage_prefix});
			$rootScope.$watch(val.bind($rootScope,s), settingsChange.bind(this,s));
		});
	});

// Controllers
// If we wanted, all the things in controllers, components, and services
// could be chained inside the NotesApp module declaration
// Keep in mind that $scope.$apply is necessary in most callbacks
angular.module('controllers', ['NotesHelperModule', 'AudioManagerModule'])
	.controller('MainCtrl', function MainCtrl($scope, $location, indexeddb, storage, settings) {

		//storage.local();
		var queue = [];

		$scope.notes = [];
		$scope.results = [];
		$scope.page_view = false;
		$scope.expanded = false;
		$scope.signed_in = false;
		$scope.user = {};

		window.xx = $scope;

		$scope.initialize = function() {
			auth_client = new FirebaseAuthClient(base_ref, function(error, user) {
				if (error)
					$scope.authError(error);
				else if (user)
					$scope.authorized(user);
				else
					$scope.unauthorized();
			});
			// Observers
			$scope.$watch('query', search.bind(this));
		}
		$scope.set = function(key, value) {
			$scope[key] = value;
		}
		// In the future make it so that getAll accepts a param of 'fields', which is an array,
		// and specifies what properties of each item you want.  this way you can specify id, title,
		// and updated_at, and not get the body for every single note
		$scope.refresh = function() {
			$scope.notes = storage.getAll({
				success: function() {
					$scope.releaseQueue();
					$scope.$apply();
				}
			});
		}
		// I feel that this is wrong because if there are no notes,
		// the queue won't be released. does that work?
		$scope.enqueue = function(f) {
			queue.push(f);
			if ($scope.notes.length)
				$scope.releaseQueue();
		}
		$scope.releaseQueue = function() {
			while(queue.length)
				queue.shift()();
		}
		// A function instead of href="/note/note_id". It should remain just this one line.
		$scope.loadNote = function(id) {
			$location.path('/note/' + id);
		}
		$scope.loadFirstNote = function() {
			if ($scope.notes.length)
				$scope.loadNote($scope.notes[0].getId());
			else
				$location.path('');
		}
		// Why does this get called twice on a note load?
		$scope.setCurrentNote = function(note) {
			$scope.current_note = note;
			$scope.scrollToCurrent();

			if (!$scope.currentNoteLoaded())
				return;

			// Now make sure the reference in $scope.notes matches this one
			for (var i = 0; i < $scope.notes.length; i++) {
				if ($scope.notes[i].getId() == $scope.current_note.getId()) {
					$scope.notes[i] = $scope.current_note;
				}
			}
		}
		$scope.getCurrentNote = function() {
			return $scope.current_note;
		}
		$scope.currentNoteLoaded = function() {
			return !!($scope.current_note && $scope.current_note.value);
		}
		// This is prob called multiple times per note load... it also appears
		// to be called before any notes are in the DOM (thus that return there); why?
		$scope.scrollToCurrent = function() {
			// Get the visible notes ul (ul.notes for results also exists & may be hidden)
			if (!$scope.currentNoteLoaded())
				return;
			var list_el = $('ul.notes:not([style*="none"])');
			var note_el = list_el.find('li[rel="note_' + $scope.current_note.getId() + '"]');
			if (!note_el || !list_el || !note_el.length || !list_el.length)
				return;
			var note_position = note_el.position().top;
			var note_height = note_el.height();
			var list_offset = list_el.scrollTop();
			var list_height = list_el.height();
			if (note_position + note_height > list_height) {
				var top = list_el.scrollTop() - (list_height - (note_position + note_height));
				list_el.scrollTop(top);
			}
			else if (note_position < 0) {
				var top = list_el.scrollTop() + note_position;
				list_el.scrollTop(top);
			}
		}
		$scope.addNote = function() {
			var note = storage.add({
				success: function(n) {
					$scope.loadNote(n.getId());
					$scope.$apply();
				}
			});
			$scope.notes.push(note);
		}
		// This doesn't get a note from storage, it gets the reference to this
		// note in $scope.notes
		$scope.getNote = function(id) {
			for (var i = 0; i < $scope.notes.length; i++) {
				if ($scope.notes[i].getId() == id)
					return $scope.notes[i];
			}
			return null;
		}
		$scope.deleteNote = function(id) {
			window.event.stopPropagation(); // only here because delete overlaps clickable note li
			storage.delete({
				id: id,
				success: function(note_id) {
					var index;
					angular.forEach($scope.notes, function(value, key) {
						if (value.getId() == note_id)
							index = key;
					});
					if (typeof index != 'undefined') {
						$scope.notes = $scope.notes.slice(0,index).concat($scope.notes.slice(index+1));
						$scope.$apply();
					}
					if ($scope.current_note && (id == $scope.current_note.getId())) {
						$scope.loadFirstNote();
					}
					$scope.$apply();
				}
			});
		}
		$scope.getTotalNotes = function() {
			return $scope.notes.length;
		}
		$scope.firstNote = function() {
			var note = $scope.query ? $scope.results[0] : $scope.notes[0];
			if (note)
				$scope.loadNote(note.getId());
		}
		$scope.nextNote = function() {
			var notes = $scope.query ? $scope.results : $scope.notes;
			for (var i = 0, prev = false; i < notes.length; i++) {
				if (!prev && notes[i].getId() == $scope.current_note.getId()) {
					prev = true;
				}
				else if (prev) {
					$scope.loadNote(notes[i].getId());
					return;
				}
			}
			if (notes.length)
				$scope.firstNote();
		}
		$scope.prevNote = function() {
			var notes = $scope.query ? $scope.results : $scope.notes;
			for (var i = notes.length-1, prev = false; i >= 0; i--) {
				if (!prev && notes[i].getId() == $scope.current_note.getId()) {
					prev = true;
				}
				else if (prev) {
					$scope.loadNote(notes[i].getId());
					return;
				}
			}
			if (notes.length)
				$scope.firstNote();
		}
		$scope.setPageView = function(val) {
			if ($location.path() == '/') {
				$scope.page_view = false;
				$scope.current_note = null;
			}
			else {
				$scope.page_view = val;
			}
		}
		// Is this function necessary anymore now that you can use the browser back button? Yes,
		// Probably - what if your first page load is not "/" ?
		$scope.menu = function() {
			$location.path('/');
			//$scope.setPageView(false);
		}
		$scope.toggleExpand = function() {
			$scope.expanded = !$scope.expanded;
		}

		// Signing in

		$scope.authorized = function(user) {
			console.log('authorized');
			$scope.signed_in = true;
			$scope.user = user;
			// In the future this should be a call to a method that checks the sync/local
			// setting first, doesn't just set to sync automatically
			storage.sync();
			storage.setUser($scope.user.id);
			$scope.refresh();
		}
		$scope.authError = function(error) {
			alert('auth error. sign in again.');
			console.log('authError');
		}
		$scope.unauthorized = function() {
			console.log('unauthorized');
			$scope.signed_in = false;
			$scope.user = {};
			storage.local();
			$scope.refresh();
		}

		// Search

		function search(new_query, old_query) {
			$scope.results = [];
			for (var i = 0; i < $scope.notes.length; i++) {
				try {
					var regexp = new RegExp(new_query, 'i');
					$scope.search_invalid = null;
				}
				catch (e) {
					$scope.search_invalid = 'invalid';
					$scope.results = [];
					break;
				}
				var note = $scope.notes[i];
				if (note.getTitle().match(regexp)) {
					$scope.results.push(note);
				}
				else if (note.getBody().match(regexp)) {
					$scope.results.push(note);
				}
			}
		}

		$scope.initialize();
	})

	.controller('NoteCtrl', function NoteCtrl($scope, $element, $location, $routeParams, storage) {

		$scope.setPageView(true);
		$scope.saved = true;
		$scope.save_timeout = null;
		$scope.loaded = false;

		$element.find('.attachments').on('mousewheel', function(event) {
			this.scrollLeft -= event.originalEvent.wheelDelta;
		});

		// This controller will likely be instantiated before notes have returned from the db.
		// So instead of trying to fetch the note immediately (it won't be there), enqueue
		// the call to do so, then set the note when it's available.
		// Enqueue it at the bottom so all other functions are available when it runs.
		function initialize() {
			// parseInt will allow trailing letters after digits
			//var note_id = (new Number($routeParams.note_id)).valueOf();
			var note_id = $routeParams.note_id;
			$scope.note = storage.get({
				id: note_id,
				replace: $scope.getNote(note_id),
				success: function(note) {
					// We may have selected another note in the meantime
					if (!(note.getId() == $scope.getCurrentNote().getId()))
						return;
					$scope.setCurrentNote($scope.note);
					$scope.watchChanges();
					$scope.loaded = true;
					$scope.$apply();
				},
				failure: function() {
					$location.path('/notfound/' + $routeParams.note_id);
					$scope.$apply();
				}
			});
			$scope.setCurrentNote($scope.note);
			$scope.$watch('loaded', function(loaded) {
				$element.find('input, textarea').attr('disabled', !loaded);
			});
		}

		function noteChange(new_value, old_value) {
			if (new_value == old_value)
				return;
			$scope.saved = false;
			$scope.timeoutSave();
		}

		// Watch the body and save when changes are made
		$scope.watchChanges = function() {
			$scope.$watch('note.getTitle()', noteChange);
			$scope.$watch('note.getBody()', noteChange);
		}

		// Allow for two seconds to pass before saving
		$scope.timeoutSave = function() {
			clearTimeout($scope.save_timeout);
			$scope.save_timeout = setTimeout($scope.save, 2000);
		}

		$scope.supportsAttachments = function() {
			return storage.synced;
		}

		// Used in the template to determine whether to show or hide attachments box.
		// This function is messy - why's it called like 6 times on a note load?
		$scope.showAttachments = function() {
			var attachments = $scope.note && $scope.note.getAttachments && Object.keys($scope.note.getAttachments()).length;
			var uploads = $scope.note && $scope.note.uploads && $scope.note.uploads.length;
			return attachments || uploads;
		}

		// Save the current note
		$scope.save = function() {
			if ($scope.note) {
				storage.edit({
					item: $scope.note.getContent(),
					success: function() {
						console.log('saved');
						$scope.saved = true;
						$scope.$apply();
					}
				})
			}
		}

		$scope.attach = function(fpfiles) {
			try {
				storage.attach({
					id: $scope.note.getId(),
					items: fpfiles,
					success: function(item) {
						console.log('attached');//, item);
					},
					failure: function(item) {
						console.log('FAILED attach:', item);
					}
				});
			}
			catch (e) {
				alert('Error: ' + e);
			}
		}

		$scope.enqueue(initialize);
	})

	.controller('AttachmentCtrl', function AttachmentCtrl($scope, $element, storage, ImageManager, AudioManager, VideoManager) {

		// Observers for AudioManager and VideoManager updates
		function update_audio() {
			if (AudioManager.data.attachment && $scope.attachment.key == AudioManager.data.attachment.key)
				$scope.data = AudioManager.data;
			else
				$scope.data = null;
		}
		function update_video() {}
		if (Utils.isFileType('audio', $scope.attachment)) $scope.$on('audio-change', update_audio.bind(this));
		if (Utils.isFileType('video', $scope.attachment)) $scope.$on('video-change', update_video.bind(this));

		$scope.playText = function() {
			if ($scope.data && $scope.data.playing)
				return 'Pause';
			else
				return 'Play';
		}
		$scope.getFileType = function() {
			return Utils.getFileType($scope.attachment);
		}
		$scope.updateStyle = function() {
			if (Utils.isFileType('image', $scope.attachment))
				$scope.src_url = 'url(' + $scope.getImageSrc() + ')';
		}
		$scope.getImageSrc = function() {
			if (Utils.isFileType('image', $scope.attachment)) {
				return 'http://storage.notes.fm/' + $scope.attachment.thumbs[100].key;
			}
			else {
				return 'http://media.notes.fm/file.png';
			}
		}
		$scope.remove = function() {
			try {
				storage.unattach({
					id: $scope.note.getId(),
					attachment_key: $scope.note.getAttachmentKey($scope.attachment),
					success: function() {
						if ($scope.attachment.thumbs) {
							for (var thumb in $scope.attachment.thumbs) {
								filepicker.remove($scope.attachment.thumbs[thumb]);
							}
						}
						filepicker.remove($scope.attachment);
					}
				});
			}
			catch (e) {
				alert('Error: ' + e);
			}
		}
		$scope.preview = function() {
			switch (Utils.getFileType($scope.attachment)) {
				case 'audio':
				case 'video':
					($scope.data && $scope.data.playing) ? $scope.pause() : $scope.play();
					break;
				case 'image':
					ImageManager.show('http://storage.notes.fm/' + $scope.attachment.key);
			}
		}
		$scope.play = function() {
			switch(Utils.getFileType($scope.attachment)) {
				case 'audio':
					AudioManager.play('http://storage.notes.fm/' + $scope.attachment.key, $scope.note, $scope.attachment);
					break;
				case 'video':
					VideoManager.show('http://storage.notes.fm/' + $scope.attachment.key, $scope.attachment);
					break;
				default:
					console.log('Not a playable attachment:', $scope.attachment);
			}
		}
		$scope.pause = function() {
			AudioManager.pause();
		}
		$scope.$watch('attachment', function() {
			$scope.updateStyle();
		});
	})

	.controller('NotFoundCtrl', function NotFoundCtrl($scope, $routeParams) {
		$scope.setPageView(true);
		$scope.setCurrentNote(null);
		$scope.note_id = $routeParams.note_id;
	})

	.controller('LoginCtrl', function LoginCtrl($scope) {
		$scope.setPageView(true);
		$scope.logging_in = true;
		$scope.login_error = false;
		$scope.email_error = false;
		$scope.signup_error = false;

		$scope.toggleLogin = function() {
			$scope.logging_in = !$scope.logging_in;
		}
		$scope.go = function() {
			$scope.logging_in ? $scope.signIn() : $scope.signUp();
		}
		$scope.signIn = function() {
			console.log('signing in...');
			auth_client.login('password', {
				rememberMe: true,
				email: $('#email_input').val(),
				password: $('#password_input').val()
			});
		}
		$scope.signOut = function() {
			console.log('sign out');
			auth_client.logout();
		}
		$scope.signUp = function() {
			console.log('doing signup');
			var email = $('#email_input').val();
			var password = $('#password_input').val();
			var authClient = new FirebaseAuthClient(base_ref);
			if (!Utils.validate_email(email)) {
				$scope.email_error = true;
				return;
			}
			authClient.createUser(email, password, function(error, user) {
				// Once firebase fixes 'error' to handle invalid email addresses,
				// you'll need to switch on 'error == whatever'
				if (error) {
					console.log('error signing up');
					$scope.signup_error = true;
				}
				else {
					console.log('signed up; now signing in');
					$scope.signIn();
					$scope.signup_error = false;
					$scope.email_error = false;
					$scope.signed_up = true;
				}
			});
		}

	})

	.controller('SettingsCtrl', function OptionsCtrl($scope) {
		$scope.setPageView(true);
	})

	.controller('PageCtrl', function PageCtrl($scope, $routeParams) {
		$scope.setPageView(true);
	})

	.controller('AudioPlayerCtrl', function AudioPlayerCtrl($scope, AudioManager) {
		$scope.data = AudioManager.data;
		$scope.play = function() {
			AudioManager.play();
		}
		$scope.pause = function() {
			AudioManager.pause();
		}
		$scope.hide = function() {
			AudioManager.hide();
		}
		$scope.$on('audio-play', function() { $scope.set('show_audio', true); });
		$scope.$on('audio-hide', function() { $scope.set('show_audio', false); });
	})

	// For the inline video element and surrounding DOM - *not* the attachment element
	.controller ('VideoPlayerCtrl', function VideoPlayerCtrl($scope, VideoManager) {
		$scope.data = VideoManager.data;
		$scope.play = function() {
			VideoManager.play();
		}
		$scope.pause = function() {
			VideoManager.pause();
		}
		$scope.toggle = function() {
			VideoManager.toggle();
		}
		$scope.hide = function() {
			VideoManager.hide();
		}
		$scope.cancel = function(event) {
			event.stopPropagation();
		}
	})

	// For the inline image element and surrounding DOM - *not* the attachment element
	.controller('ImagePreviewCtrl', function ImagePlayerCtrl($scope, ImageManager) {
		$scope.data = ImageManager.data;
		$scope.hide = function() {
			$scope.data.show = !$scope.data.show;
		}
	})

angular.module('AudioManagerModule', [])
	.service('ImageManager', function($rootScope) {
		this.data = {
			src: null,
			show: false
		};
		this.show = function(src) {
			this.data.src = src;
			this.data.show = true;
		}
	})
	.service('AudioManager', function($rootScope) {
		var audio = document.createElement('audio');
		var track_click = $('.audio-player .track-click')[0];
		this.data = {
			playing: false,
			src: null,
			total_time: '0:00',
			current_time: '0:00',
			meta_loaded: false,
			loaded: 0,
			progress: 0,
			buffers: []
		};

		var track_click_handlers = {
			mousemove: function(event) {
				var left = event.pageX - $(track_click).offset().left;
				$(track_click).find('.pos').css({left: left + 'px'});
			},
			click: function(event) {
				var left = event.pageX - $(track_click).offset().left;
				var seconds = left / $(track_click).width() * audio.duration;
				audio.currentTime = seconds;
			}
		};
		for (var handler in track_click_handlers) {
			$(track_click).on(handler, track_click_handlers[handler].bind(this));
		}

		var audio_handlers = {
			loadstart: function() {
				this.data.meta_loaded = false;
				this.updateBuffers();
				$rootScope.$broadcast('audio-play');
				this.broadcastChange($rootScope);
			},
			loadedmetadata: function() {
				this.data.meta_loaded = true;
				this.data.total_time = Utils.formatDuration(audio.duration);
				this.broadcastChange($rootScope);
			},
			progress: function() {
				if (!this.data.meta_loaded)
					return;
				this.data.loaded = Math.round((audio.buffered.end(audio.buffered.length-1) - audio.buffered.start(0)) / audio.duration * 100);
				this.updateBuffers();
				this.broadcastChange($rootScope);
			},
			timeupdate: function() {
				this.data.progress = audio.currentTime / audio.duration * 100;
				this.data.current_time = Utils.formatDurationProgress(audio.duration, audio.currentTime);
				this.broadcastChange($rootScope);
			},
			play: function() {
				this.checkPause();
				this.broadcastChange($rootScope);
			},
			pause: function() {
				this.checkPause();
				this.broadcastChange($rootScope);
			}
		};
		for (var handler in audio_handlers) {
			$(audio).on(handler, audio_handlers[handler].bind(this));
		}

		this.broadcastChange = function(scope) {
			scope.$broadcast('audio-change');
			scope.$apply();
		}
		this.updateBuffers = function() {
			this.data.buffers = [];
			for (var i = 0; i < audio.buffered.length; i++) {
				var left = audio.buffered.start(i) / audio.duration * 100;
				var width = (audio.buffered.end(i) - audio.buffered.start(i)) / audio.duration * 100;
				this.data.buffers.push({left: left+'%', width: width+'%'});
			}
		}
		this.checkPause = function() {
			this.data.playing = !audio.paused;
			if (this.data.note)
				this.data.note.audio = this.data.playing;
		}
		this.set = function(src) {
			if (audio.src != src || this.data.src != src) {
				audio.src = src;
				this.data.src = src;
				this.checkPause();
			}
		}
		this.play = function(src, note, attachment) {
			if (src) {
				src = encodeURI(src);
				this.set(src);
			}
			if (note)
				this.data.note = note;
			if (attachment)
				this.data.attachment = attachment;
			audio.play();
		}
		this.pause = function() {
			audio.pause();
		}
		this.hide = function() {
			this.pause();
			$rootScope.$broadcast('audio-hide');
		}
	})
	.service('VideoManager', function($rootScope) {
		var video = $('.video-player video')[0];
		var track_click = $('.video-player .track-click')[0];
		this.data = {
			playing: false,
			show: false,
			total_time: '0:00',
			current_time: '0:00',
			meta_loaded: false,
			loaded: 0,
			progress: 0,
			buffers: []
		};

		var track_click_handlers = {
			mousemove: function(event) {
				var left = event.pageX - $(track_click).offset().left;
				$(track_click).find('.pos').css({left: left + 'px'});
			},
			click: function(event) {
				var left = event.pageX - $(track_click).offset().left;
				var seconds = left / $(track_click).width() * video.duration;
				video.currentTime = seconds;
			}
		};
		for (var handler in track_click_handlers) {
			$(track_click).on(handler, track_click_handlers[handler].bind(this));
		}

		var video_handlers = {
			loadstart: function() {
				this.data.meta_loaded = false;
				this.updateBuffers();
				$rootScope.$apply();
			},
			loadedmetadata: function() {
				this.data.meta_loaded = true;
				this.data.total_time = Utils.formatDuration(video.duration);
				$rootScope.$apply();
			},
			progress: function() {
				if (!this.data.meta_loaded)
					return;
				this.data.loaded = Math.round((video.buffered.end(video.buffered.length-1) - video.buffered.start(0)) / video.duration * 100);
				this.updateBuffers();
				$rootScope.$apply();
			},
			timeupdate: function() {
				this.data.progress = video.currentTime / video.duration * 100;
				this.data.current_time = Utils.formatDurationProgress(video.duration, video.currentTime);
				$rootScope.$apply();
			},
			play: function() {
				this.checkPause();
				$rootScope.$apply();
			},
			pause: function() {
				this.checkPause();
				$rootScope.$apply();
			}
		};
		for (var handler in video_handlers) {
			$(video).on(handler, video_handlers[handler].bind(this));
		}

		this.updateBuffers = function() {
			this.data.buffers = [];
			for (var i = 0; i < video.buffered.length; i++) {
				var left = video.buffered.start(i) / video.duration * 100;
				var width = (video.buffered.end(i) - video.buffered.start(i)) / video.duration * 100;
				this.data.buffers.push({left: left+'%', width: width+'%'});
			}
		}
		this.checkPause = function() {
			this.data.playing = !video.paused;
			if (this.data.note)
				this.data.note.video = this.data.playing;
		}
		this.set = function(src, attachment) {
			if (src)
				src = encodeURI(src);
			if (src && (video.src != src || this.data.src != src)) {
				video.src = src;
				this.data.src = src;
				this.checkPause();
			}
			if (attachment)
				this.data.attachment = attachment;
		}
		this.play = function(src, attachment) {
			this.set(src, attachment);
			this.data.show = true;
			video.autoplay = false;
			if (this.data.meta_loaded)
				video.play();
			else
				video.autoplay = true;
		}
		this.pause = function() {
			video.pause();
		}
		this.toggle = function() {
			video.paused ? this.play() : this.pause();
		}
		this.show = function(src, attachment) {
			this.set(src, attachment);
			this.data.show = true;
		}
		this.hide = function() {
			this.pause();
			this.data.show = false;
		}
	})


// The things inside this could be chained to the 'NotesApp' module contents,
// but this way if we wanted we could separate this out into another file,
// and potentially reuse it elsewhere.
// 1/21/2013 - When possible, specify controllers here and not in the routeProver -
// that way you can inject $element into the controller
angular.module('components', [])
	.directive('note', function() {
		return {
			restrict: 'E',
			controller: 'NoteCtrl',
			templateUrl: '/partials/note'
		}
	})
	// This should get the value of the "partials" attribute
	// from attrs, and to templateUrl: /partials/{{that value}}
	.directive('partial', function() {
		return {
			restrict: 'A',
			templateUrl: '/partials/note-list-item'
		}
	})
	.directive('attachment', function() {
		return {
			restrict: 'E',
			controller: 'AttachmentCtrl'
		}
	})
	.directive('autoFocus', function() {
		return function(scope, element, attrs) {
			scope.el = $(element[0]);
			var unwatch_textchange = scope.$watch('el.val()', function(old_value, new_value) {
				if (!new_value || (old_value == new_value)) {
					var text_length = $(scope.el[0]).val().length;
					var pos = (attrs.autoFocus == 'start') ? 0 : text_length;
					scope.el.focus();
					scope.el[0].setSelectionRange(pos, pos);
					if (text_length)
						unwatch_textchange();
				}
			});
		}
	})
	.directive('droppable', function() {

		return function(scope, element, attrs) {

			if (attrs.droppable !== 'true' || !scope.supportsAttachments())
				return;

			var picker = {

				// Since there's no way to identify multiple uploads, right now
				// we can only allow one at a time
				uploading: false,
				upload_count: 0,
				rand: Math.round(Math.random()*1000),
				thumbs: {},
				uploaded_fpfiles: null,
				conversion_options: [
					{format: 'jpg', quality: 65, fit: 'crop', width: 100, height: 100},
					{format: 'jpg', quality: 65, fit: 'crop', width: 40, height: 40}
				],
				dragEnter: function() {
					$(element).addClass('droppable-hover');
				},
				dragLeave: function() {
					$(element).removeClass('droppable-hover');
				},
				onStart: function(files) {
					this.uploading = true;
					this.upload_count = files.length;
					$(element).removeClass('droppable-hover');
				},
				onProgress: function(percentage) {
					//console.log('onProgress', this.rand, percentage);
					if (scope.note) {
						scope.note.uploads = [
							{count: this.upload_count, progress: percentage}
						];
						scope.$apply();
					}
				},
				onSuccess: function(fpfiles) {
					this.uploading = false;
					if (scope.note) {
						scope.note.uploads = [];
					}
					console.log('onSuccess', this.rand, fpfiles);
					this.uploaded_fpfiles = fpfiles;
					this.thumbs_remaining = (fpfiles.length * this.conversion_options.length);

					// For every image uploaded
					for (var i = 0; i < fpfiles.length; i++) {
						var orig_fpfile = fpfiles[i];

						// If it's an image, generate thumbs for each size
						if (Utils.isFileType('image', orig_fpfile)) {
							for (var j = 0; j < this.conversion_options.length; j++) {
								var options = this.conversion_options[j];
								filepicker.convert(
									orig_fpfile,
									options,
									this.thumbConverted.bind(this, options, orig_fpfile)
								);
							}
						}
						// Otherwise, just attach it to the note
						else {
							scope.attach([orig_fpfile]);
						}
					}
				},
				onError: function(type, message) {
					this.uploading = false;
					console.log('onError', this.rand, type, message);
				},
				thumbConverted: function(options, orig_fpfile, new_fpfile) {
					console.log('thumbConverted');
					if (!this.thumbs[orig_fpfile.key])
						this.thumbs[orig_fpfile.key] = {};
					this.thumbs[orig_fpfile.key][options.width] = new_fpfile;
					if (Object.keys(this.thumbs[orig_fpfile.key]).length == this.conversion_options.length) {
						orig_fpfile.thumbs = this.thumbs[orig_fpfile.key];
						console.log('calling scope.attach with', [orig_fpfile]);
						scope.attach([orig_fpfile]);
					}
				}
			};
			var drop_pane_options = {
				multiple:        true,
				store_location:  'S3',
				dragEnter:       picker.dragEnter.bind(picker),
				dragLeave:       picker.dragLeave.bind(picker),
				onStart:         picker.onStart.bind(picker),
				onProgress:      picker.onProgress.bind(picker),
				onSuccess:       picker.onSuccess.bind(picker),
				onError:         picker.onError.bind(picker)
			};
			filepicker.makeDropPane($(element), drop_pane_options);
		}
	});

// Events for keys, like esc="do_something()"
var key_directives = {enter: 13, esc: 27, up: 38, down: 40};
angular.forEach(key_directives, function(val, key) {
	angular.module('components')
		.directive(key, function($parse) {
			return function(scope, element, attrs) {
				var fn = $parse(attrs[key]);
				element.on('keydown', function(event) {
					if (event.keyCode == val) {
						event.preventDefault();
						scope.$apply(function() {
							fn(scope, {$event:event});
						});
					}
				});
			}
		})
});



angular.module('NotesApp', ['controllers', 'components'])
	.config(function($routeProvider) {
		$routeProvider
			.when('/note/:note_id', {
				template: '<note></note>'
			})
			.when('/notfound/:note_id', {
				templateUrl: '/partials/notfound',
				controller: 'NotFoundCtrl'
			})
			.when('/login', {
				templateUrl: '/partials/login',
				controller: 'LoginCtrl'
			})
			.when('/signup', {
				templateUrl: '/partials/signup',
				controller: 'LoginCtrl'
			})
			.when('/settings', {
				templateUrl: '/partials/settings',
				controller: 'SettingsCtrl'
			})
			.when('/', {
				templateUrl: '/partials/hello',
				controller: 'PageCtrl'
			})
			.otherwise({
				//redirectTo: '/'
				template: "Content does not exist"
			});
	});

















/*

// Old settings controller content

var settings = ['type', 'startup', 'fontfamily'];

function settingsChange(setting, new_value, old_value) {
	localStorageService.set(setting, new_value);
}

angular.forEach(settings, function(s) {
	$scope[s] = localStorageService.get(s);
	$scope.$watch(s, settingsChange.bind(this, s));
});
*/


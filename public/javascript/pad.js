'use strict';

// For the main site Pad

(function() {
	window.indexedDB = window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB || window.msIndexedDB;
	window.IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction || window.mozIDBTransaction || window.msIDBTransaction;
})();


filepicker.setKey('AdxGfHDDjQ2OTkf5i11y1z');


// This is a note!
function Note(value) {
	this.value = value;
	this.getValue = function() {
		return this.value;
	};
	this.getId = function() {
		return this.value.id;
	};
	this.getTitle = function() {
		return this.value.title || '';
	};
	this.getBody = function() {
		return this.value.body;
	};
	this.getTime = function() {
		return Utils.formatDate(this.value.updated_at);
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
	formatDate: function(timestamp) {
		var date = new Date (timestamp);
		var hours = date.getHours() % 12 + (date.getHours()%12==0?1:0);
		var minutes = this.digits(2, date.getMinutes());
		var am_pm = date.getHours() < 12 ? 'am' : 'pm';
		return [hours, ':', minutes, ' ', am_pm].join('');
	},
	// Pad a number with leading zeroes
	digits: function(n, number) {
		var zeroes = '';
		var number_digits = Math.ceil(Math.log(number+1)/Math.LN10);
		if (number_digits < n)
			for (var i = 0; i < n - number_digits; i++)
				zeroes += '0';
		return zeroes + number;
	},
	// From http://www.regular-expressions.info/email.html
	validate_email: function(email) {
		var regex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,4}$/i;
		return regex.test(email);
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
				var store = this.getStore();
				var req = store.get(opts.id);
				req.onerror = function(event) {
					opts.failure();
				}.bind(this);
				req.onsuccess = function(event) {
					var item;
					if (req.result)
						item = this.classify(req.result);
					opts.success(item);
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
				var date = (new Date()).valueOf();
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
				item.updated_at = (new Date()).valueOf();
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

var base_ref = new Firebase('https://cilphex.firebaseio.com/');

// Service
angular.module('FirebaseModule', [])
	.service('firebase', function($rootScope) {

		//this.base = new Firebase('https://cilphex.firebaseio.com/users/cilphex/notes');

		this.setUser = function(userid) {
			this.user_ref = base_ref.child('users').child(userid).child('notes');
		};
		
		this.get = function(opts) {

		};
		this.getAll = function(opts) {
			var ret = [];
			if (this.user_ref) {
				console.log('user_ref exists; getAll executing');
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
			var item = {updated_at: (new Date()).valueOf()}
			var noteref = this.user_ref.push(item, function(success) {
					if (success && opts.success) {
						item.id = noteref.name();
						var note = new Note(item);
						//ret = note;
						angular.copy(note, ret);
						opts.success(note);
					}
					else if (!success && opts.failure) {
						opts.failure();
					}
				}
			);
			return ret;
		};
		this.delete = function(opts) {
			this.user_ref.child(opts.id).remove(function(success) {
				if (success && opts.success) {
					opts.success(opts.id);
				}
				else if (!success && opts.failure) {
					opts.failure();
				}
			});
		};
		this.edit = function(opts) {
			var item = opts.item;
			this.user_ref.child(item.id).update(item, function(success) {
				// does opts need to be bound to this function for confusion not to occur?
				if (success && opts.success)
					opts.success(item);
				else if (!success && opts.failure)
					opts.failure();
			});
			return {};
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
		var storage_functions = ['get', 'getAll', 'add', 'delete', 'edit', 'setUser'];
		for (var i = 0; i < storage_functions.length; i++) {
			var func = storage_functions[i];
			this[func] = function(func) {
				var args = Array.prototype.slice.call(arguments).slice(1);
				return mechanism[func].apply(mechanism, args);
			}.bind(this, func);
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
		var settings = ['type', 'startup', 'fontfamily', 'theme'];

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
angular.module('controllers', ['IndexedDBModule', 'NotesHelperModule'])
	.controller('MainCtrl', function MainCtrl($scope, $location, indexeddb, storage, settings) {

		window.xx = $scope;

		var queue = [];
		storage.setMechanism('firebase');

		$scope.notes = [];

		// For testing - remove later
		$scope.storage = storage;

		$scope.page_view = false;
		$scope.expanded = false;
		$scope.signed_in = false;
		$scope.user = {};

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

		$scope.setDB = function(dbtype) {
			storage.setMechanism(dbtype);
			$scope.refresh();
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
		$scope.setCurrentNote = function(note) {
			if ($scope.current_note)
				$scope.current_note.class = '';
			$scope.current_note = note;
			$scope.current_note.class = 'selected';
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
		$scope.getNote = function(id) {
			var note = null;
			angular.forEach($scope.notes, function(value, key) {
				if (value.getId() == id)
					note = value;
			});
			return note;
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
		$scope.setPageView = function(val) {
			$scope.page_view = val;
		}
		$scope.menu = function() {
			$scope.setPageView(false);
		}
		$scope.toggleExpand = function() {
			$scope.expanded = !$scope.expanded;
		}


		$scope.authorize = function() {
			var authtoken = localStorage.getItem('authtoken');
			if (authtoken) {
				base_ref.auth(authtoken, function(success) {
					if (success)
						$scope.authorized();
					else
						$scope.unauthorized();
				});
			}
			else {
				$scope.unauthorized();
			}
		}
		$scope.authorized = function() {
			console.log('authorized');
			$scope.signed_in = true;
			$scope.user = {
				authtoken: localStorage.getItem('authtoken'),
				userid: localStorage.getItem('userid'),
				email: localStorage.getItem('email')
			}
			storage.setUser($scope.user.userid);
			$scope.refresh();
		}
		$scope.unauthorized = function() {
			console.log('unauthorized');
			$scope.signed_in = false;
			$scope.user = {};
			$scope.refresh();
		}
		$scope.signIn = function() {
			var email = $('#email_input').val();
			var password = $('#password_input').val();
			var authClient = new FirebaseAuthClient(base_ref);
			authClient.login('password', email, password, function(error, token, user) {
				if (error) {
					console.log('error signing in');
				}
				else {
					console.log('signed in');
					localStorage.setItem('authtoken', token);
					localStorage.setItem('userid', user.id);
					localStorage.setItem('email', user.email);
					$scope.authorize();
				}
			});
		}
		$scope.signOut = function() {
			console.log('sign out');
			// clear authtoken, userid, and email from localStorage
			base_ref.unauth();
			localStorage.removeItem('authtoken');
			localStorage.removeItem('userid');
			localStorage.removeItem('email');
			$scope.authorize();
		}

		$scope.authorize();
		//$scope.refresh();
	})

	.controller('NoteCtrl', function NoteCtrl($scope, $location, $routeParams, storage) {

		$scope.setPageView(true);
		$scope.saved = true;
		$scope.save_timeout = null;

		// This controller will likely be instantiated before notes have returned from the db.
		// So instead of trying to fetch the note immediately (it won't be there), enqueue
		// the call to do so, then set the note when it's available.
		// Enqueue it at the bottom so all other functions are available when it runs.
		function initialize() {
			// parseInt will allow trailing letters after digits
			//var note_id = (new Number($routeParams.note_id)).valueOf();
			var note_id = $routeParams.note_id;
			$scope.note = $scope.getNote(note_id);
			if (!$scope.note) {
				$location.path('/notfound/' + $routeParams.note_id);
				return;
			}
			$scope.setCurrentNote($scope.note);
			$scope.watchChanges();
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

		// Save the current note
		$scope.save = function() {
			if ($scope.note) {
				storage.edit({
					item: $scope.note.getValue(),
					success: function() {
						console.log('saved');
						$scope.saved = true;
						$scope.$apply();
					}
				})
			}
		}

		$scope.enqueue(initialize);
	})

	.controller('NotFoundCtrl', function NotFoundCtrl($scope, $routeParams) {
		$scope.setPageView(true);
		$scope.note_id = $routeParams.note_id;
	})

	.controller('LoginCtrl', function LoginCtrl($scope) {
		$scope.setPageView(true);

	})

	.controller('SignupCtrl', function SignupCtrl($scope) {
		$scope.setPageView(true);

		$scope.email_error = false;
		$scope.signup_error = false;

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
	});


// The things inside this could be chained to the 'NotesApp' module contents,
// but this way if we wanted we could separate this out into another file,
// and potentially reuse it elsewhere.
angular.module('components', [])
	.directive('note', function() {
		return {
			restrict: 'E',
			templateUrl: '/partials/note'
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
			})
		}
	})
	.directive('droppable', function() {
		return function(scope, element, attrs) {
			filepicker.makeDropPane($(element), {
				multiple: true,
				dragEnter: function() {
					console.log('dragEnter');
					$(element).addClass('droppable-hover');
				},
				dragLeave: function() {
					console.log('dragLeave');
					$(element).removeClass('droppable-hover');
				},
				onStart: function(files) {
					$(element).removeClass('droppable-hover');
					console.log('onStart', files);

				},
				onProgress: function(percentage) {
					console.log('onProgress', percentage);

				},
				onSuccess: function(fpfiles) {
					console.log('onSuccess', fpfiles);

				},
				onError: function(type, message) {
					console.log('onError', type, message);

				}
			});
		}
	});


angular.module('NotesApp', ['controllers', 'components'])
	.config(function($routeProvider) {
		$routeProvider
			.when('/note/:note_id', {
				template: '<note></note>',
				controller: 'NoteCtrl'
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
				controller: 'SignupCtrl'
			})
			.when('/settings', {
				templateUrl: '/partials/settings',
				controller: 'SettingsCtrl'
			})
			.when('', {
				templateUrl: '/partials/hello',
				controller: 'PageCtrl'
			})
			.otherwise({
				redirectTo: '/',
				templateUrl: '/partials/hello',
				controller: 'PageCtrl'
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




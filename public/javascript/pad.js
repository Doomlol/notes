'use strict';

// For the main site Pad

(function() {
	window.indexedDB = window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB || window.msIndexedDB;
	window.IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction || window.mozIDBTransaction || window.msIDBTransaction;
})();



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

// Service - only one instance
angular.module('LocalStorageModule', [])
	.service('localStorageService', function() {
		return {
			set: function(key, value) {
				if (typeof value == 'ojbect')
					value = JSON.stringify(value);
				localStorage.setItem(key, value);
			},
			get: function(key) {
				var value = localStorage.getItem(key);
				try {
					return JSON.parse(value);
				}
				catch(e) {
					return value;
				}
			},
			remove: function(key) {
				return localStorage.removeItem(key);
			},
			clearAll: function() {
				for (var i in localStorage)
					this.remove(i);
			}
		}
	});

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
			}
			this.open_onerror = function(event) {
				console.log('There was an error with the db (general)', event);
			};
			this.open_onblocked = function(event) {
				console.log('There was an error with the db (blocked)', event);
			};
			this.open_onupgradeneeded = function(event) {
				this.upgrade(event.target.result);
			};
			this.open_onsuccess = function(event) {
				this.db = event.target.result;
				this.db.onabort = this.db_onabort.bind(this);
				this.db.onerror = this.db_onerror.bind(this);
				this.db.onversionchange = this.db_onversionchange.bind(this);
				if (this.db.setVersion && Number(this.db.version) != this.settings.version) {
					var version_request = this.db.setVersion(this.settings.version);
					version_request.onsuccess = function(event) {
						this.upgrade(event.target.result);
					}.bind(this);
				}
				else {
					this.initialize_done();
				}
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
			this.upgrade = function(transaction) {
				var initialized = this.settings.upgrade_function(this.db);
				if (initialized) {
					transaction.oncomplete = this.initialize_done.bind(this);
				}
				else {
					alert('Error opening database');
				}
			}
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



// Controllers
// If we wanted, all the things in controllers, components, and services
// could be chained inside the NotesApp module declaration
// Keep in mind that $scope.$apply is necessary in most callbacks
angular.module('controllers', ['LocalStorageModule', 'IndexedDBModule'])
	.controller('MainCtrl', function MainCtrl($scope, $location, localStorageService, indexeddb) {

		window.mainscope = $scope;
		var queue = [];

		$scope.db = indexeddb('notes-db', 28, 'notes', Note, upgrade_database);
		$scope.page_view = false;
		$scope.expanded = false;

		// In the future make it so that getAll accepts a param of 'fields', which is an array,
		// and specifies what properties of each item you want.  this way you can specify id, title,
		// and updated_at, and not get the body for every single note
		$scope.notes = $scope.db.getAll({
			success: function() {
				$scope.releaseQueue();
				$scope.$apply();
			}
		});

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
			var note = $scope.db.add({
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
			$scope.db.delete({
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
		$scope.log = function(x) {
			x = x || 'no string';
			console.log('Test log', x);
		}
	})

	.controller('NoteCtrl', function NoteCtrl($scope, $location, $routeParams) {

		$scope.setPageView(true);
		$scope.saved = true;
		$scope.save_timeout = null;

		// This controller will likely be instantiated before notes have returned from the db.
		// So instead of trying to fetch the note immediately (it won't be there), enqueue
		// the call to do so, then set the note when it's available.
		// Enqueue it at the bottom so all other functions are available when it runs.
		function initialize() {
			// parseInt will allow trailing letters after digits
			var note_id = (new Number($routeParams.note_id)).valueOf();
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
				$scope.db.edit({
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

	.controller('SettingsCtrl', function OptionsCtrl($scope, localStorageService) {

		$scope.setPageView(true);

		var settings = ['type', 'startup', 'fontfamily'];

		function settingsChange(setting, new_value, old_value) {
			localStorageService.set(setting, new_value);
		}

		angular.forEach(settings, function(s) {
			$scope[s] = localStorageService.get(s);
			$scope.$watch(s, settingsChange.bind(this, s));
		});
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























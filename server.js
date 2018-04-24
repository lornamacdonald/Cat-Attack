// Call the packages
var express = require('express');
var app = express();
var apiRouter = express.Router();
var serv = require('http').Server(app);
var mongojs = require('mongojs');
var db = mongojs('localhost:27017/myGame');
var bodyParser = require('body-parser');
var morgan = require('morgan');
var mongoose = require('mongoose');
var User = require('./app/models/user');

// Start the server on port 2000
serv.listen(2000);
console.log("Server started: port 2000");

// Use body parser to grab information from POST requests
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

// Configure to handle CORS requests
app.use(function(req, res, next) {
	res.setHeader('Access-Control-Allow-Origin', '*');
	res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
	res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type, Authorization');
	next();
});

// Log all requests to the console
app.use(morgan('dev'));
mongoose.connect('mongodb://localhost/myGame'); 

// Use the index.html file and the images folder
app.get('/',function(req, res) {
    res.sendFile(__dirname + '/client/index.html');
});
app.use('/client',express.static(__dirname + '/client'));

// Register routes for accessing the API
app.use('/api', apiRouter);

// Declare an empty socket list
var SOCKET_LIST = {};

// A player
var Player = function(param) {
	var self = {
		x:Math.random() * 1000,
		y:Math.random() * 500,
		spdX:0,
		spdY:0,
		id:"",
		map:'1',
	}
	
	self.number = "" + Math.floor(10 * Math.random());
	self.pressingRight = false;
	self.pressingLeft = false;
	self.pressingUp = false;
	self.pressingDown = false;
	self.pressingAttack = false;
	self.mouseAngle = 0;
	self.maxSpd = 10;
	self.healthBar = 10;
	self.healthBarMax = 10;
	self.score = 0;
	self.kills = 0;
	self.username = param.username;
	
	if (param) {
		if (param.x) {
			self.x = param.x;
		}
		if (param.y) {
			self.y = param.y;
		}
		if (param.map) {
			self.map = param.map;
		}
		if (param.id) {
			self.id = param.id;
		}
	}
	
	// Update the player
	self.update = function() {
		self.updateSpd();
		self.updatePosition();
		
		if (self.pressingAttack) {
			self.shootBullet(self.mouseAngle);
		}
	}
	
	// Get the player's distance from a point
	self.getDistance = function(pt) {
		return Math.sqrt(Math.pow(self.x-pt.x,2) + Math.pow(self.y-pt.y,2));
	}
	
	// Shoot a bullet
	self.shootBullet = function(angle) {
		Bullet({
			parent:self.id,
			angle:angle,
			x:self.x,
			y:self.y,
			map:self.map,
		});
	}
	
	// Update the player's speed
	self.updateSpd = function() {
		if (self.pressingRight)
			self.spdX = self.maxSpd;
		else if (self.pressingLeft)
			self.spdX = -self.maxSpd;
		else
			self.spdX = 0;
		if (self.pressingUp)
			self.spdY = -self.maxSpd;
		else if (self.pressingDown)
			self.spdY = self.maxSpd;
		else
			self.spdY = 0;
	}
	
	// Update the player's position
	self.updatePosition = function() {
		if ((self.x + self.spdX > 0) && (self.x + self.spdX < 1000) && (self.y + self.spdY < 500) && (self.y + self.spdY > 0))  {
			self.x += self.spdX;
			self.y += self.spdY;
		}
	}
	
	// Initialisation pack
	self.getInitPack = function() {
		return {
			id:self.id,
			x:self.x,
			y:self.y,
			number:self.number,
			healthBar:self.healthBar,
            healthBarMax:self.healthBarMax,
            score:self.score,
			kills:self.kills,
			map:self.map,
		};
	}
	
	// Update pack
	self.getUpdatePack = function() {
		return {
			id:self.id,
			x:self.x,
			y:self.y,
			healthBar:self.healthBar,
			score:self.score,
			kills:self.kills,
			map:self.map,
		}
	}
	
	// Spawn a fish every 3 seconds
	self.spawnFish = function() {
		Fish({
			parent:self.id,
			id:self.id,
			map:self.map,
		});
	}
	
	setInterval(function() {
		self.spawnFish();
	}, 3000);
	
	// Push the players into the intialisation pack
	Player.list[self.id] = self;
	initPack.player.push(self.getInitPack());
	return self;
}

// Create a player list
Player.list = {};

// Connect a player
Player.onConnect = function(socket, username) {
	// Declare the initial map
	var map = '1';

	// Declare a player
	var player = Player({
		username:username,
		id:socket.id,
		map:map,
	});
	
	// Key presses
	socket.on('keyPress', function(data) {
		if (data.inputId === 'left')
			player.pressingLeft = data.state;
		else if (data.inputId === 'right')
			player.pressingRight = data.state;
		else if (data.inputId === 'up')
			player.pressingUp = data.state;
		else if (data.inputId === 'down')
			player.pressingDown = data.state;
		else if (data.inputId === 'attack')
			player.pressingAttack = data.state;
		else if (data.inputId === 'mouseAngle')
			player.mouseAngle = data.state;
	});
	
	// Move the player to level 2
	socket.on('level2', function(data) {
		if (player.map === '1') {
			player.map = '2';
			player.score += 20;
		}
	});
	
	// Move the player to level 3
	socket.on('level3', function(data) {
		if (player.map === '2') {
			player.map = '3';
			player.score += 30;
		}
	});
	
	// The player wins
	socket.on('win', function(data) {
		if (player.map === '3') {
			player.map = 'win';
			player.score += 60;
		}
	});
	
	// Send a message
	socket.on('sendMsgToServer', function(data) {
		for (var i in SOCKET_LIST) {
			SOCKET_LIST[i].emit('addToChat', player.username + " (level " + player.map + ") : " + data);
		}
	});
	
	// Run the initialisation socket
	socket.emit('init', {
		selfId:socket.id,
		player:Player.getAllInitPack(),
		bullet:Bullet.getAllInitPack(),
		fish:Fish.getAllInitPack(),
	})
}

// Get all players
Player.getAllInitPack = function() {
	var players = [];
	
	for (var i in Player.list) {
		players.push(Player.list[i].getInitPack());
	}
	return players;
}

// Disconnect a player
Player.onDisconnect = function(socket) {
	delete Player.list[socket.id];
	delete Fish.list[socket.id];
	removePack.player.push(socket.id);
	removePack.fish.push(socket.id);
}

// Update a player
Player.update = function() {
	var pack = [];
	for (var i in Player.list) {
		var player = Player.list[i];
		player.update();
		pack.push(player.getUpdatePack());
	}
	return pack;
}

// A bullet
var Bullet = function(param) {
	var self = {
		x:Math.random() * 1000,
		y:Math.random() * 500,
		spdX:0,
		spdY:0,
		id:"",
		map:'map',
	}
	
	self.id = Math.random();
	self.angle = param.angle;
	self.spdX = Math.cos(param.angle/180*Math.PI) * 10;
	self.spdY = Math.sin(param.angle/180*Math.PI) * 10;
	self.parent = param.parent;
	self.timer = 0;
	self.toRemove = false;
	
	if (param) {
		if (param.x) {
			self.x = param.x;
		}
		if (param.y) {
			self.y = param.y;
		}
		if (param.map) {
			self.map = param.map;
		}
		if (param.id) {
			self.id = param.id;
		}
	}
	
	// Update the bullet
	self.update = function() {
		self.updatePosition();
	}
	
	// Update the bullet's position
	self.updatePosition = function() {
		self.x += self.spdX;
		self.y += self.spdY;
	}
	
	// Get the bullet's distance from a point
	self.getDistance = function(pt) {
		return Math.sqrt(Math.pow(self.x-pt.x,2) + Math.pow(self.y-pt.y,2));
	}
	
	var super_update = self.update;
	self.update = function(){
		// Remove the bullet
		if(self.timer++ > 100)
			self.toRemove = true;
		super_update();
		
		for(var i in Player.list){
			var p = Player.list[i];
			
			// If the bullet collides with a player
			if(self.map === p.map && self.getDistance(p) < 32 && self.parent !== p.id){
				
				// Decrease the health bar, depending on which map the player is in
				if (p.map === '1') {
					p.healthBar -= 1;
				}
				
				if (p.map === '2') {
					p.healthBar -= 0.5;
				}
				
				if (p.map === '3') {
					p.healthBar -= 0.1;
				}
				
				// If the player's health bar reaches 0
				if(p.healthBar <= 0) {
					var shooter = Player.list[self.parent];
					
					// Increase the shooter's score and kill count
					if(shooter) {
						shooter.kills += 1;
						shooter.score += 1;
					}
					
					// Reset the health bar
					p.healthBar = p.healthBarMax;
					
					// Spawn the player to a random location
					p.x = Math.random() * 1000;
					p.y = Math.random() * 500;
					
					// Decrease the player's score
					if (p.score > 0) {
						p.score -= 1;
					}
				}
				self.toRemove = true;
			}
		}
	}
	
	// Initialisation pack
	self.getInitPack = function() {
		return {
			id:self.id,
			x:self.x,
			y:self.y,
			map:self.map,
		};
	}
	
	// Update pack
	self.getUpdatePack = function() {
		return {
			id:self.id,
			x:self.x,
			y:self.y,		
		};
	}
	
	// Push the bullets into the initialisation pack
	Bullet.list[self.id] = self;
	initPack.bullet.push(self.getInitPack());
	return self;
}

// Create a bullet list
Bullet.list = {};

// Update a bullet
Bullet.update = function(){
	var pack = [];
	for(var i in Bullet.list){
		var bullet = Bullet.list[i];
		bullet.update();
		if(bullet.toRemove){
			delete Bullet.list[i];
			removePack.bullet.push(bullet.id);
		} else
			pack.push(bullet.getUpdatePack());		
	}
	return pack;
}

// Get all bullets
Bullet.getAllInitPack = function(){
	var bullets = [];
	for(var i in Bullet.list)
		bullets.push(Bullet.list[i].getInitPack());
	return bullets;
}

// A fish
var Fish = function(param) {
	var self = {
		x:Math.random() * 1000,
		y:Math.random() * 500,
		id:"",
		map:'map',
	}
	
	self.toRemove = false;
	self.id = Math.random();
	self.parent = param.parent;
	
	if (param) {
		if (param.x) {
			self.x = param.x;
		}
		if (param.y) {
			self.y = param.y;
		}
		if (param.map) {
			self.map = param.map;
		}
		if (param.id) {
			self.id = param.id;
		}
	}
	
	// Get the fish's distance from a point
	self.getDistance = function(pt) {
		return Math.sqrt(Math.pow(self.x-pt.x,2) + Math.pow(self.y-pt.y,2));
	}
	
	// Update the fish
	self.update = function(){
		for(var i in Player.list){
			var p = Player.list[i];
			
			// If the player collides with a fish
			if(self.map === p.map && self.getDistance(p) < 32){
				// Increase the player's score
				p.score += 1;
				self.toRemove = true;
			}
		}
	}
	
	// Initialisation pack
	self.getInitPack = function(){
		return {
			id:self.id,
			x:self.x,
			y:self.y,
			map:self.map,
		};
	}
	
	// Update pack
	self.getUpdatePack = function(){
		return {
			id:self.id,
			x:self.x,
			y:self.y,		
		};
	}
	
	// Push the fish into the initialisation pack
	Fish.list[self.id] = self;
	initPack.fish.push(self.getInitPack());
	return self;
}

// Create a fish list
Fish.list = {};

// Update a fish
Fish.update = function(){
	var pack = [];
	
	for(var i in Fish.list){
		var fish = Fish.list[i];
		fish.update();
		if(fish.toRemove){
			delete Fish.list[i];
			removePack.fish.push(fish.id);
		} else
			pack.push(fish.getUpdatePack());	
	}
	return pack;
}

// Get all fish
Fish.getAllInitPack = function(){
	var fishes = [];
	for(var i in Fish.list)
		fishes.push(Fish.list[i].getInitPack());
	return fishes;
}

// Check the database if the password entered matches the username
var isValidPassword = function(data, cb) {
	db.users.find({username:data.username, password:data.password},(function(err, res) {
		if (res.length > 0)
			cb(true);
		else
			cb(false);
	}));
}

// Check the database if a username exists
var isUsernameTaken = function(data, cb) {
	db.users.find({username:data.username}, function(err, res) {
		if (res.length > 0) {
			cb(true);
		}
		else {
			cb(false);
		}
	});
}

// Add a user to the database
var addUser = function(data, cb) {
	db.users.insert({username:data.username, password:data.password, score:data.score}, function(err) {
		cb();
	});
}

// Update the user's score in the database if it's greater than their previous
var saveScore = function(data, cb) {
	db.users.update({username:data.username},{$max:{score:data.score}}, function(err) {
		cb();
	});
}

// Sockets
var io = require('socket.io')(serv, {});
io.sockets.on('connection', function(socket) {
	
	socket.id = Math.random();
	SOCKET_LIST[socket.id] = socket;
	
	// Sign in
	socket.on('signIn', function(data) {
		
		// If the password is valid
		isValidPassword(data, function(res) {
			if (res) {
				// Run a successful sign in response
				Player.onConnect(socket, data.username);
				socket.emit('signInResponse', {success:true});
			}
			else {
				// Run a failed sign in response
				socket.emit('signInResponse', {success:false});
				
			}
		});
	});
	
	// Sign up
	socket.on('signUp', function(data) {
		// If the username is taken
		isUsernameTaken(data, function(res) {
			if (res) {
				// Run a failed sign up response
				socket.emit('signUpResponse', {success:false});
			}
			else {
				// Add the user
				addUser(data, function() {
					// Run a successful sign up response
					socket.emit('signUpResponse', {success:true});
				});
			}
		});
	});
	
	// Save score
	socket.on('saveScore', function(data) {
		saveScore(data, function() {
		});
	});
	
	// Disconnect
	socket.on('disconnect', function(data) {
		delete SOCKET_LIST[socket.id];
		Player.onDisconnect(socket);
	});
});

// Create an initialisation pack and remove pack
var initPack = {player:[], bullet:[], fish:[]};
var removePack = {player:[], bullet:[], fish:[]};

// 4x per second...
setInterval(function() {
	var pack = {
		player:Player.update(),
		bullet:Bullet.update(),
		fish:Fish.update(),
	}
	
	for (var i in SOCKET_LIST) {
		var socket = SOCKET_LIST[i];
		socket.emit('init', initPack);
		socket.emit('update', pack);
		socket.emit('remove', removePack);
	}
	
	initPack.player = [];
	initPack.bullet = [];
	initPack.fish = [];
	removePack.player = [];
	removePack.bullet = [];
	removePack.fish = [];
},1000/25);

// Display leaderboard
apiRouter.route('/users').get(function(req, res) {
	User.find(function(err, users) {
		if (err) {
			return res.send(err);
		}

		res.json(users);
	});
});
// Sonos Server:
// Copyright (C) 2016  David Ulrich (http://github.com/dulrich)
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as
// published by the Free Software Foundation, version 3 of the License.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

var mysql = require('mysql');

var sonos = require("sonos");

var config = require('./config.json');

require("./fn.js")(global);

if (!config || typeof config !== 'object') {
	process.exit(1);
}

config.host = config.host || '127.0.0.1';
config.port = config.port || 1400;

var s = new sonos.Sonos(config.host, config.port);

var cur_track = null;

function compare(a, b) {
	return (
		(a.title === b.title) &&
		(a.artist === b.artist) &&
		(a.album === b.album) &&
		(a.duration === b.duration)
	);
}

function get_track(timed) {
	s.currentTrack(function(err, track) {
		var diff, duration, position;
		
		if (err) {
			console.log(err);
			return;
		}
		else if (track) {
			if (!cur_track || !compare(track, cur_track)) {
				if (cur_track) console.log('...');
				
				log_track(track);
			}
			
			cur_track = track;
		}
		
		diff = cur_track.duration - cur_track.position;
		if (!timed && (diff < 60)) {
			setTimeout(function() {
				get_track(true);
			}, (diff + 3) * 1000);
		}
	});
}

function log_track(track) {
	console.log('['
		+ ('0' + (track.duration / 60).toFixed(0)).slice(-2)
		+ ':'
		+ ('0' + (track.duration % 60).toFixed(0)).slice(-2)
		+ '] '
		+ track.artist + ' : ' + track.title
	);
	
	query(db, {
		query : `INSERT IGNORE INTO song
			(songTitle, songArtist, songAlbum, songDuration)
		VALUES (?title, ?artist, ?album, ?duration)`,
		param : track
	}, function(err, res) {
		if (err) return console.error(err);
		
		query(db, {
			query : `SELECT
				songID AS id
			FROM song
			WHERE songTitle = ?title
				AND songArtist = ?artist
				AND songAlbum = ?album
				AND songDuration = ?duration`,
			param : track
		}, function(err, res) {
			var param = res[0];
			
			if (err) return console.error(err);
			
			query(db, {
				query : `SELECT
					count(*) AS plays
				FROM song_log
				WHERE songID = ?id
					AND songLogTime BETWEEN DATE_ADD(NOW(), INTERVAL -60 HOUR) AND DATE_ADD(NOW(), INTERVAL -?duration SECOND)`,
				param : {
					id       : param.id,
					duration : track.duration + 60
				}
			}, function(err, res) {
				if (err) return console.error(err);
				
				if (res[0].plays > 0) {
					s.next(function() {
						// nothing
					});
					
					console.log("Skipping... " + track.artist + ' : ' + track.title);
					
					query(db, {
						query : `INSERT INTO song_log (songID, songSkip) VALUES (?id, 1)`,
						param : param
					}, function(err, res) {
						if (err) return console.error(err);
						
						// nothing
					});
					
					setTimeout(function() {
						get_track(false);
					}, 2 * 1000);
					
					return;
				}
				
				query(db, {
					query : `SELECT
						count(*) AS plays
					FROM song_log
					WHERE songID = ?id
						AND songSkip = 0
						AND songLogTime > DATE_ADD(NOW(), INTERVAL -?duration SECOND)`,
					param : {
						id       : param.id,
						duration : track.duration + 60
					}
				}, function(err, res) {
					if (err) return console.log(err);
					
					if (res[0].plays > 0) return;
					
					query(db, {
						query : `INSERT INTO song_log (songID) VALUES (?id)`,
						param : param
					}, function(err, res) {
						if (err) return console.error(err);
						
						// nothing
					});
				});
			});
		});
	});
}

setInterval(function() {
	get_track(false);
}, 60 * 1000);


var db;
function init_db() {
	return mysql.createConnection({
		host        : config.db_host,
		database    : config.db_name,
		user        : config.db_user,
		password    : config.db_pass,
		dateStrings : true
	});
}

db = init_db();

db.on("error", function(err) {
	if (err.code === "PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR") {
		err.fatal = true;
	}
	
	if (!err.fatal) return;
	
	if (db) db.end();
	db = init_db();
});

get_track(false);

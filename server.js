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

var sonos = require("sonos");

var config = require('./config.json');

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
		(a.albun === b.albun) &&
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
				console.log(track.artist + ' : ' + track.title);
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

setInterval(function() {
	get_track(false);
}, 60 * 1000);

get_track(false);

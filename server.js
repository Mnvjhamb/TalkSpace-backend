require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const router = require('./routes');
const PORT = process.env.PORT || 5500;

const cors = require('cors');
const cookieParser = require('cookie-parser');

const server = require('http').createServer(app);
const { ACTIONS } = require('./actions');
const io = require('socket.io')(server, {
	cors: {
		origin: 'https://talkspacee.netlify.app/',
		// origin: 'https://talkspacee.netlify.app',
		methods: ['GET', 'POST']
	}
});

app.use(cookieParser());

// const corsOption = {
// 	origin: 'https://talkspacee.netlify.app/',
// 	credentials: true,
// 	methods: ['GET', 'POST', 'HEAD', 'PUT', 'PATCH', 'DELETE'],
// 	allowedHeaders: ['Content-Type'],
// 	exposedHeaders: ['Content-Type']
// };

app.use(cors());

app.use('/storage', express.static('storage'));

const dbConnect = require('./db');
dbConnect();

app.use(
	express.json({
		limit: '8mb'
	})
);

app.use(express.static(path.join(__dirname, 'build')));

app.get('/', function (req, res) {
	res.sendFile(path.join(__dirname, 'build', 'index.html'));
});
app.use(router);

// sockets

const socketUserMapping = {};
io.on('connection', (socket) => {
	console.log('new connection', socket.id);

	socket.on(ACTIONS.JOIN, ({ roomId, user }) => {
		socketUserMapping[socket.id] = user;
		const clients = Array.from(io.sockets.adapter.rooms.get(roomId) || []);

		clients.forEach((clientId) => {
			io.to(clientId).emit(ACTIONS.ADD_PEER, {
				peerId: socket.id,
				createOffer: false,
				user
			});
			socket.emit(ACTIONS.ADD_PEER, {
				peerId: clientId,
				createOffer: true,
				user: socketUserMapping[clientId]
			});
		});

		socket.join(roomId);
	});

	// handle relay ice
	socket.on(ACTIONS.RELAY_ICE, ({ peerId, icecandidate }) => {
		io.to(peerId).emit(ACTIONS.ICE_CANDIDATE, {
			peerId: socket.id,
			icecandidate
		});
	});

	// handle relay sdp (session description)
	socket.on(ACTIONS.RELAY_SDP, ({ peerId, sessionDescription }) => {
		io.to(peerId).emit(ACTIONS.SESSION_DESCRIPTION, {
			peerId: socket.id,
			sessionDescription
		});
	});

	// handle mute/unmute

	socket.on(ACTIONS.MUTE, ({ roomId, userId }) => {
		const clients = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
		clients.forEach((clientId) => {
			io.to(clientId).emit(ACTIONS.MUTE, {
				peerId: socket.id,
				userId
			});
		});
	});

	socket.on(ACTIONS.UN_MUTE, ({ roomId, userId }) => {
		const clients = Array.from(io.sockets.adapter.rooms.get(roomId) || []);

		clients.forEach((clientId) => {
			io.to(clientId).emit(ACTIONS.UN_MUTE, {
				peerId: socket.id,
				userId
			});
		});
	});

	//leaving the room

	const leaveRoom = ({ roomId }) => {
		const { rooms } = socket;
		Array.from(rooms).forEach((roomId) => {
			const clients = Array.from(
				io.sockets.adapter.rooms.get(roomId) || []
			);

			clients.forEach((clientId) => {
				io.to(clientId).emit(ACTIONS.REMOVE_PEER, {
					peerId: socket.id,
					userId: socketUserMapping[socket.id]?.id
				});
				socket.emit(ACTIONS.REMOVE_PEER, {
					peerId: clientId,
					userId: socketUserMapping[clientId]?.id
				});
			});

			socket.leave(roomId);
		});

		delete socketUserMapping[socket.id];
	};
	socket.on(ACTIONS.LEAVE, leaveRoom);
	socket.on('disconnecting', leaveRoom);
});

server.listen(PORT, () => {
	console.log(`Listening on port ${PORT}`);
});

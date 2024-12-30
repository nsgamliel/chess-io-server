import { createServer } from "http";
import { Server } from "socket.io";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, getDoc, setDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCOWM63LckefIs4PFbDvGcJkzKl-FVNqb8",
  authDomain: "chess-io-server.firebaseapp.com",
  projectId: "chess-io-server",
  storageBucket: "chess-io-server.firebasestorage.app",
  messagingSenderId: "861991732155",
  appId: "1:861991732155:web:b0f5f0328218af8cf8ba9e",
  measurementId: "G-PFDNJKQMZQ"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const gamesRef = collection(db, "games");

const PORT = 3000;

const httpServer = createServer();
const io = new Server(httpServer, {
	cors: {
		origin: "*"
	}
});


const chars = 'abcdefghijklmnopqrstuvqxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const createRoomName = () => {
	let str = '';
	for (let i=0;i<4;i++) {
		const idx = Math.floor(Math.random() * 62);
		const digit = chars.substring(idx, idx+1);
		str += digit;	
	}
	// console.log(str);
	return str;
};

const createGame = async (socket) => {
	console.log(socket.id, "create new game");
	let roomId;
	let roomSnap;
	do {
		roomId = createRoomName();
		roomSnap = await getDoc(doc(gamesRef, roomId));
	} while (roomSnap.exists());
	console.log(roomId);

	const color = ['white', 'black'][Math.floor(Math.random() * 2)];
	await setDoc(doc(gamesRef, roomId), {
		id: roomId,
		player1: {
			id: socket.id,
			color: color
		},
		player2: null,
		boards: []
	});
	socket.join(roomId);
	socket.emit("joinedRoom", roomId, null, color);
};

const joinRoom = async (socket, roomId, prevId) => {
	console.log(socket.id, "join room", roomId);
	const roomSnap = await getDoc(doc(gamesRef, roomId));
	
	if (roomSnap.exists()) {
		let data = roomSnap.data();
		
		if (prevId && (data.player1 && data.player1.id === prevId || data.player2 && data.player2.id === prevId)) {
			if (data.player1) data.player1.id = data.player1.id === prevId ? socket.id : data.player1.id;
			if (data.player2) data.player2.id = data.player2.id === prevId ? socket.id : data.player2.id;
			await setDoc(doc(gamesRef, roomId), data);
			socket.join(roomId);
			const player = data.player1 && data.player1.id === socket.id ? data.player1 : data.player2;
			const oppId = data.player1 && data.player1.id === socket.id ? data.player2 ? data.player2.id : null : data.player1.id;
			socket.emit("joinedRoom", roomId, oppId, player.color);
			socket.broadcast.to(roomId).emit("newUser", socket.id);
		}

		else if (data.player1 && !data.player2) {
			data.player2 = {
				id: socket.id,
				color: data.player1.color === 'black' ? 'white': 'black'
			};
			await setDoc(doc(gamesRef, roomId), data);
			socket.join(roomId);
			socket.emit("joinedRoom", roomId, data.player1.id, data.player2.color);
			socket.to(roomId).emit("newUser", socket.id);
		}

		else {
			console.log("Error assigning", socket.id, "to room", roomId);
		}
	} 
	// else {
	// 	createGame(socket);
	// }
};

const movePiece = async (socket, roomId, board, rcft) => {
	console.log("move piece");
	const roomSnap = await getDoc(doc(gamesRef, roomId));
	
	if (roomSnap.exists()) {
		let data = roomSnap.data();
		// data.boards.push(board);
		socket.broadcast.to(roomId).emit("oppMove", board, rcft);
		await setDoc(doc(gamesRef, roomId), data);
	}
}

io.on("connection", (socket) => {

	// in progress: will need to conduct async user setup/room joining 

	console.log(socket.id, "added to server");

	socket.on("createGame", () => createGame(socket));
	socket.on("joinRoom", (roomId, prevId) => joinRoom(socket, roomId, prevId));
	socket.on("movePiece", (roomId, board, rcft) => movePiece(socket, roomId, board, rcft));

});

httpServer.listen(PORT, () => {
	console.log(`server listening on port ${PORT}`);
});
const mongoose = require('mongoose');
const DbConnect = () => {
	const DB_URL = process.env.DB_URL;
	// const DB_URL = 'mongodb://localhost:27017/clubhouse';

	mongoose.connect(DB_URL, {
		useNewUrlParser: true,
		useUnifiedTopology: true
	});

	const db = mongoose.connection;
	db.on('error', console.error.bind(console, 'connection error:'));
	db.once('open', () => {
		console.log('DB connected....');
	});
};

module.exports = DbConnect;

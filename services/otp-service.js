const crypto = require('crypto');
const hashService = require('./hash-service');
const nodemailer = require('nodemailer');

const smsSid = process.env.SMS_SID;
const smsAuthToken = process.env.SMS_AUTH_TOKEN;

const twilio = require('twilio')(smsSid, smsAuthToken, {
	lazyLoading: true
});

// create reusable transporter object using the default SMTP transport
var transporter = nodemailer.createTransport({
	service: 'gmail',
	auth: {
		user: 'mnv2813@gmail.com',
		pass: 'gjjrfrsawcbpjeaq'
	},
	port: 465,
	host: 'smtp.gmail.com',
	secure: false
});

class OtpService {
	async generateOtp() {
		const otp = await crypto.randomInt(1000, 9999);
		return otp;
	}

	async sendBySms(phone, otp) {
		let res = {};
		try {
			res = await twilio.messages.create({
				to: phone,
				from: process.env.SMS_FROM_NUMBER,
				body: `Your TalkSpace OTP is ${otp}`
			});

			return res;
		} catch (e) {
			console.log(e);
			return e;
		}
	}

	async sendByMail(email, otp) {
		let res = {};
		try {
			let res = await transporter.sendMail({
				from: 'mnv2813@gmail.com', // sender address
				to: email, // list of receivers
				subject: 'TalkSpace OTP', // Subject line
				text: `Your TalkSpace OTP is ${otp}`
			});

			// res = await twilio.messages.create({
			// 	to: phone,
			// 	from: process.env.SMS_FROM_NUMBER,
			// 	body: `Your clubhouse OTP is ${otp}`
			// });

			return res;
		} catch (e) {
			console.log(e);
			return e;
		}
	}

	async verifyOtp(hashedOtp, data) {
		const hash = await hashService.hashOtp(data);
		return hash === hashedOtp;
	}
}

module.exports = new OtpService();

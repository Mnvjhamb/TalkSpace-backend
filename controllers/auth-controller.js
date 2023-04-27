const { hashOtp } = require('../services/hash-service');
const hashService = require('../services/hash-service');
const otpService = require('../services/otp-service');
const tokenService = require('../services/token-service');
const userService = require('../services/user-service');
const UserDto = require('../dtos/user-dto');
const { storeRefreshToken } = require('../services/token-service');
class AuthController {
	async sendOtp(req, res) {
		const { phone, email } = req.body;
		if (!phone && !email)
			return res.status(400).json({
				message: 'Phone/Email field is required!'
			});

		// generate otp
		const otp = await otpService.generateOtp();

		// hash otp
		const ttl = 1000 * 60 * 2; // 2 min expire time;
		const expires = Date.now() + ttl;
		const data = `${phone || email}.${otp}.${expires}`;

		const hash = hashService.hashOtp(data);

		// send otp
		try {
			if (phone) {
				await otpService.sendBySms(phone, otp);
			} else {
				await otpService.sendByMail(email, otp);
			}

			return res.json({
				hash: `${hash}.${expires}`,
				phone,
				email,
				otp // remove this
			});
		} catch (error) {
			console.log(error);
			return res.status(500).json({
				message: 'message sending failed'
			});
		}
	}

	async verifyOtp(req, res) {
		const { otp, hash, phone, email } = req.body;
		if (!otp || !hash || (!phone && !email))
			return res.status(400).json({
				message: 'All fields are required'
			});

		const [hashedOtp, expires] = hash.split('.');
		if (Date.now() > +expires)
			res.status(400).json({
				message: 'Otp expired'
			});

		const data = `${phone || email}.${otp}.${expires}`;

		const isValid = await otpService.verifyOtp(hashedOtp, data);

		if (!isValid)
			return res.status(400).json({
				message: 'Invalid Otp'
			});

		let user;

		try {
			if (phone) {
				user = await userService.findUser({ phone });
				if (!user) user = await userService.createUser({ phone });
			} else {
				user = await userService.findUser({ email });
				if (!user) user = await userService.createUser({ email });
			}
		} catch (error) {
			console.log(err);
			res.status(500).json({
				message: 'Db error'
			});
		}

		// token
		const { accessToken, refreshToken } = tokenService.generateTokens({
			_id: user._id,
			activated: false
		});

		await storeRefreshToken(refreshToken, user._id);

		res.cookie('refreshToken', refreshToken, {
			maxAge: 1000 * 60 * 60 * 24 * 30,
			httpOnly: true
		});

		res.cookie('accessToken', accessToken, {
			maxAge: 1000 * 60 * 60 * 24 * 30,
			httpOnly: true
		});

		const userDto = new UserDto(user);
		res.json({ user: userDto, auth: true });
	}

	async refresh(req, res) {
		// get refresh token from cookie
		const { refreshToken: refreshTokenFromCookie } = req.cookies;

		// check if refresh token is valid

		let userData;
		try {
			userData = await tokenService.verifyRefreshToken(
				refreshTokenFromCookie
			);
		} catch (error) {
			return res.status(401).json({
				message: 'invalid token-1'
			});
		}

		// check if token is in db
		try {
			const token = await tokenService.findRefreshToken(
				userData._id,
				refreshTokenFromCookie
			);
			if (!token) {
				return res.status(401).json({
					message: 'invalid token2'
				});
			}
		} catch (error) {
			return res.status(500).json({
				message: 'invalid token3'
			});
		}

		// check if valid user
		let user;
		try {
			user = await userService.findUser({ _id: userData._id });
			console.log(user);
			if (!user) {
				return res.status(401).json({
					message: 'user not found'
				});
			}
		} catch (error) {
			return res.status(500).json({
				message: 'db error'
			});
		}

		// generate new tokens(access and refresh)
		const { refreshToken, accessToken } = tokenService.generateTokens({
			_id: userData._id
		});

		// update refresh token
		try {
			await tokenService.updateRefreshToken(userData._id, refreshToken);
		} catch (error) {
			return res.status(500).json({
				message: 'db error'
			});
		}

		// add token to cookie
		res.cookie('refreshToken', refreshToken, {
			maxAge: 1000 * 60 * 60 * 24 * 30,
			httpOnly: true
		});

		res.cookie('accessToken', accessToken, {
			maxAge: 1000 * 60 * 60 * 24 * 30,
			httpOnly: true
		});

		const userDto = new UserDto(user);
		res.json({ user: userDto, auth: true });
	}

	async logout(req, res) {
		// delete refresh token
		const { refreshToken } = req.cookies;

		try {
			await tokenService.removeToken(refreshToken);
		} catch (error) {
			res.status(500).json({
				message: 'db error'
			});
		}

		// delete cookies
		res.clearCookie('refreshToken');
		res.clearCookie('accessToken');

		res.json({
			user: null,
			isAuth: false
		});
	}
}

module.exports = new AuthController();

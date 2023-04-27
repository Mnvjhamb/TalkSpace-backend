const Jimp = require('jimp');
const path = require('path');
const UserDto = require('../dtos/user-dto');
const { findUser } = require('../services/user-service');

class ActivateController {
	async activate(req, res) {
		const { name, profile } = req.body;
		if (!name || !profile) {
			return res.status(400).json({
				message: 'All fields are required'
			});
		}

		const buffer = Buffer.from(
			profile.replace(/^data:image\/(png|jpg|jpeg);base64,/, ''),
			'base64'
		);

		const imagepath = `${Date.now()}-${Math.round(
			Math.random() * 1e9
		)}.jpg`;
		// 1234567-2345678765432.png

		try {
			Jimp.read(buffer)
				.then((image) => {
					image
						.resize(150, Jimp.AUTO)
						.write(
							path.resolve(__dirname, `../storage/${imagepath}`)
						);
				})
				.catch((e) => {
					console.log('eer', e);
				});

			const jimpResp = await Jimp.read(buffer);
			jimpResp
				.resize(150, Jimp.AUTO)
				.write(path.resolve(__dirname, `../storage/${imagepath}`));
		} catch (error) {
			console.log(error);
			return res.status(500).json({
				message: 'Could not process the image'
			});
		}

		// update user
		try {
			const userId = req.user._id;
			const user = await findUser({ _id: userId });

			if (!user) {
				return res.status(404).json({
					message: 'User not found'
				});
			}

			user.activated = true;
			user.name = name;
			user.profile = `/storage/${imagepath}`;

			await user.save();

			return res.json({
				user: new UserDto(user),
				auth: true
			});
		} catch (error) {
			return res.status(500).json({
				message: 'Something went wrong'
			});
		}
	}
}

module.exports = new ActivateController();

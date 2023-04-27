class UserDto {
	_id;
	phone;
	email;
	name;
	profile;
	activated;
	createdAt;

	constructor(user) {
		this.id = user._id;
		this.phone = user.phone;
		this.email = user.email;
		this.activated = user.activated;
		this.createdAt = user.createdAt;
		this.name = user.name;
		this.profile = user.profile ? `${user.profile}` : null;
	}
}

module.exports = UserDto;

module.exports = {
    friendlyName: 'Update profile member',
  
    fn: async function () {
        // upload file
        let result = await uploadFileAndUpdateProfile(this.req);
        let userData = await sails.sendNativeQuery(`
            SELECT *
            FROM members
            WHERE id = $1
        `, [this.req.headers['member-id']]);

        let data = {
            id: userData.rows[0].id,
            email: userData.rows[0].email,
            first_name: userData.rows[0].first_name,
            last_name: userData.rows[0].last_name,
            phone: userData.rows[0].phone,
            city: userData.rows[0].city,
            date_of_birth: await sails.helpers.convertDate(userData.rows[0].date_of_birth),
            photo: sails.config.sailsImagePath + userData.rows[0].photo
        };
        if (result == 'success') {
            return await sails.helpers.convertResult(1, 'Profile successfully updated.', data, this.res);
        } else if (result == 'input empty') {
            return await sails.helpers.convertResult(0, 'Profile update failed, please check your inputs.', null, this.res);
        } else if (result == 'email duplicate') {
            return await sails.helpers.convertResult(0, 'Email address already exist.', null, this.res);
        }
    }
};

async function uploadFileAndUpdateProfile(input) {
    return new Promise((resolve, reject) => {
        let memberId = input.headers['member-id'];
        var currentDate = new Date();
        var currentDateString = currentDate.getDate().toString() < 10 ? '0'+currentDate.getDate().toString() : currentDate.getDate().toString();
        var month = currentDate.getMonth() + 1;
        var currentMonth = month < 10 ? '0'+month : month;
        let fileName = 'profile_'+memberId+'_'+currentDateString + currentMonth.toString() + currentDate.getFullYear().toString() + currentDate.getTime();
        let asssetImagePath = require('path').resolve(sails.config.appPath, 'assets/images/');
        input.file('file').upload({
            dirname: asssetImagePath + '/profile',
            saveAs: async function(file, callback) {
                let allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
                if (allowedTypes.indexOf(file.headers['content-type']) !== -1) {
                    callback(null, fileName + '.' + file.headers['content-type'].replace('image/', ''));
                } else {
                    sails.log('File type not supported.');
                }
            },
            maxBytes: 5 * 1024 * 1024
        }, async function (err, uploadedFiles) {
            if (err) {
                sails.log(err.message);
            }

            // if inputs are null
            if (
                input.body.first_name == '' || input.body.last_name == '' || input.body.phone == '' || input.body.date_of_birth == '' || input.body.city == '' || 
                input.body.first_name == null || input.body.last_name == null || input.body.phone == null || input.body.date_of_birth == null || input.body.city == null
            ) {
                resolve("input empty");
            } else {
                var flag = true;
                // check unique email
                if (input.body.email != null && input.body.email != '') {
                    let userEmail = await sails.sendNativeQuery(`
                        SELECT email
                        FROM members
                        WHERE email = $1 AND id NOT IN ($2)
                    `, [input.body.email, memberId]);

                    if (userEmail.rows.length > 0) {
                        flag = false;
                        resolve("email duplicate");
                    }
                }

                if (flag) {
                    if (uploadedFiles.length > 0) {
                        // Delete the old image
                        let userPhoto = await sails.sendNativeQuery(`
                            SELECT photo
                            FROM members
                            WHERE id = $1
                        `, [memberId]);
                        const fs = require('fs');
                        fs.unlink(asssetImagePath + '/' + userPhoto.rows[0].photo, (err) => {
                            if (err) {
                                sails.log(err);
                                return;
                            }
                            sails.log('File deleted successfully');
                        });
                        let image = 'profile/'+fileName+'.'+uploadedFiles[0].type.replace('image/', '');
                        await sails.sendNativeQuery(`
                            UPDATE members
                            SET first_name = $1,
                                last_name = $2,
                                phone = $3,
                                date_of_birth = $4,
                                city = $5,
                                email = $6,
                                photo = $7,
                                updated_by = $8,
                                updated_at = $9
                            WHERE id = $8
                        `, [
                            input.body.first_name, input.body.last_name, input.body.phone, 
                            input.body.date_of_birth, input.body.city.toUpperCase(), (input.body.email ? input.body.email : null),
                            image, memberId, new Date()
                        ]);
                    } else {
                        await sails.sendNativeQuery(`
                            UPDATE members
                            SET first_name = $1,
                                last_name = $2,
                                phone = $3,
                                date_of_birth = $4,
                                city = $5,
                                email = $6,
                                updated_by = $7,
                                updated_at = $8
                            WHERE id = $7
                        `, [
                            input.body.first_name, input.body.last_name, input.body.phone, 
                            input.body.date_of_birth, input.body.city.toUpperCase(), (input.body.email ? input.body.email : null), 
                            memberId, new Date()
                        ]);
                    }
                    resolve("success");
                }
            }
        });
    });
}
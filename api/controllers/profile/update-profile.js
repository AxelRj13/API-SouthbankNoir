module.exports = {
    friendlyName: 'Update profile member',
  
    fn: async function () {
        // upload file
        let result = await uploadFileAndUpdateProfile(this.req);
        if (result) {
            return result;
        } else {
            return sails.helpers.convertResult(0, 'Profile update failed, please check your file upload.');
        }
    }
};

async function uploadFileAndUpdateProfile(input) {
    return new Promise((resolve, reject) => {
        let memberId = input.headers['member-id'];
        let currentDate = new Date();
        let fileName = 'profile_'+memberId+'_'+currentDate.getDate()+(currentDate.getMonth()+1)+currentDate.getFullYear()+currentDate.getHours()+currentDate.getMinutes();
        input.file('file').upload({
            dirname: require('path').resolve(sails.config.appPath, 'assets/images/profile'),
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
            if (uploadedFiles) {
                sails.log(uploadedFiles[0]);
                await sails.sendNativeQuery(`
                    UPDATE members
                    SET first_name = $1,
                        last_name = $2,
                        phone = $3,
                        date_of_birth = $4,
                        city = $5,
                        gender = $6,
                        photo = $7,
                        updated_by = $8,
                        updated_at = $9
                    WHERE id = $8
                `, [
                    input.body.first_name, input.body.last_name, input.body.phone, 
                    input.body.date_of_birth, input.body.city.toUpperCase(), input.body.gender.toUpperCase(), 
                    'profile/'+fileName+'.'+uploadedFiles[0].type.replace('image/', ''), memberId, new Date()
                ]);
    
                resolve( await sails.helpers.convertResult(1, 'Profile successfully updated.'));
            }
        });
    });
}
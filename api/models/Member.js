/**
 * A member who can login to southbank noir mobile application
 */
module.exports = {
    tableName: 'members',
    attributes: {
      email: {
        type: 'string',
        unique: true,
        isEmail: true,
        maxLength: 100
      },
      first_name: {
        type: 'string',
        maxLength: 50
      },
      last_name: {
        type: 'string',
        maxLength: 50
      },
      phone: {
        type: 'string',
        maxLength: 20
      },
      gender: {
        type: 'string',
        maxLength: 10
      },
      city: {
        type: 'string'
      },
      date_of_birth: {
        type: 'string',
        columnType: 'date'
      },
      photo: {
        type: 'string'
      },
      status: {
        type: 'number'
      },
      password: {
        type: 'string',
        required: true,
        protect: true
      },
      created_by: {
        type: 'number'
      },
      updated_by: {
        type: 'number'
      }
    }
  };
  
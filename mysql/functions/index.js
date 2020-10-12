'use strict';

const mysql = require('serverless-mysql')({
    config: {
        host: process.env.HOST,
        port: process.env.PORT,
        database: process.env.DATABASE,
        // 需要填写真实的用户名与密码
        user: 'xxx',
        password: 'xxx'
    }
})

exports.main = async (event, context, callback) => {
    let res
    try {
        res = await mysql.query('SELECT * FROM mysql_test')
    } catch (e) {
        console.error(e)
    }

    context.callbackWaitsForEmptyEventLoop = false

    return {
        res,
        code: 200
    }
}
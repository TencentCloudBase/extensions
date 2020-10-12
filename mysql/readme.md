##  简介

本扩展是为了解决云开发用户业务中对MySQL的诉求，搭配腾讯云数据库MySQL和云开发云函数满足开发者的业务需求，并提供相关示例代码。

[腾讯云数据库MySQL](https://cloud.tencent.com/document/product/236/5147)是腾讯云基于开源数据库 MySQL 专业打造的高性能分布式数据存储服务，让用户能够在云中更轻松地设置、操作和扩展关系数据库。云数据库 MySQL 主要特点如下:
-   云存储服务，是腾讯云平台提供的面向互联网应用的数据存储服务。
-   完全兼容 MySQL 协议，适用于面向表结构的场景；适用 MySQL 的地方都可以使用云数据库。
-   提供高性能、高可靠、易用、便捷的 MySQL 集群服务，数据可靠性能够达到99.9996%。
-   整合了备份、扩容、迁移等功能，同时提供新一代数据库工具 DMC ，用户可以方便地进行数据库的管理。


##  推荐使用场景

云开发的数据库满足不了业务的需求，需要使用到MySQL。

已有的业务使用了MySQL，业务迁移到云开发中，希望继续使用MySQL。


##  背景知识

####    私有网络VPC

在云函数中，开发者如果需要访问腾讯云的`Redis、云数据库`等资源，推荐使用`私有网络`来确保数据安全及连接安全。关于私有网络、以及如果建立私有网络和云函数加入私有网络，可以参考[如何在云开发中使用 Redis](https://developers.weixin.qq.com/community/develop/article/doc/000ee2573a4ec8ed72a9199da51c13)和[为云数据库MySQL创建私有网络](https://cloud.tencent.com/document/product/236/8468)中的相关章节。


####    云函数的运行机制

`运行环境`
云函数运行在云端 Linux 环境中，一个云函数在处理并发请求的时候会创建多个云函数实例，每个云函数实例之间相互隔离，没有公用的内存或硬盘空间。云函数实例的创建、管理、销毁等操作由平台自动完成。每个云函数实例都在 /tmp 目录下提供了一块 512MB 的临时磁盘空间用于处理单次云函数执行过程中的临时文件读写需求，需特别注意的是，这块临时磁盘空间在函数执行完毕后可能被销毁，不应依赖和假设在磁盘空间存储的临时文件会一直存在。如果需要持久化的存储，请使用云存储功能。

`无状态函数`
云函数应是无状态的，幂等的，即一次云函数的执行不依赖上一次云函数执行过程中在运行环境中残留的信息。

为了保证负载均衡，云函数平台会根据当前负载情况控制云函数实例的数量，并且会在一些情况下重用云函数实例，这使得连续两次云函数调用如果都由同一个云函数实例运行，那么两者会共享同一个临时磁盘空间，但因为云函数实例随时可能被销毁，并且连续的请求不一定会落在同一个实例，因此云函数不应依赖之前云函数调用中在临时磁盘空间遗留的数据。总的原则即是云函数代码应是无状态的。

`事件模型`
云函数的调用采用事件触发模型，每一次调用即触发了一次云函数调用事件，云函数平台会新建或复用已有的云函数实例来处理这次调用。同理，因为云函数间也可以相互调用，因此云函数间相互调用也是触发了一次调用事件。

`自动扩缩容`
开发者无需关心云函数扩容和缩容的问题，平台会根据负载自动进行扩缩容。


####    云函数并发数 & MySQL连接数

在[云开发控制台-环境总览](https://console.cloud.tencent.com/tcb/env/overview)中可以看到当前环境所允许的云函数并发数的最大值，最大并发数也是云函数的最大实例。

关于MySQL连接，推荐阅读MySQL官方博客的博文[MySQL Connection Handling and Scaling](https://mysqlserverteam.com/mysql-connection-handling-and-scaling/)。

MySQL连接数的相关参数配置，可以在[云数据库TencentDB](https://console.cloud.tencent.com/cdb)控制台 -> `MySQL` -> `数据库管理` -> `参数设置`中配置。

云函数中使用MySQL，每个云函数实例与MySQL Server都会有连接，那么此云函数与MySQL的最大连接数是，单个实例的最大连接数*实际运行的最大并发数；在配置MySQL的`max_connections`的时候，此参数应该大于，使用此数据库的所有云函数的最大连接数之和。

因此，在云函数中使用MySQL，建议您将使用到同一个数据库，不仅仅是同一张表，的所有读写MySQL的代码集中到一个云函数中，这样做有两个好处

-   云函数出现冷启动的概率比较低
-   MySQL的最大连接数较小


####    云函数 Node.js runtime 异步特性

云函数 Node.js runtime 中，不同版本的 Node.js 的的异步特性不尽相同。

在 Node.js 10.15 及 12.16 的 runtime 中，同步流程处理并返回后，代码中的异步逻辑可以继续执行和处理，直到异步事件执行完成后，云函数的实际执行过程才完成和退出。参考文档[Node.js runtime](https://cloud.tencent.com/document/product/583/11060)中的`Node.js 10.15 及 12.16 的异步特性` 和 `关闭事件循环等待`章节.

建议您在云函数中添加

```js
context.callbackWaitsForEmptyEventLoop = false
```

##  Usage

如果你的原有业务代码中使用了MySQL连接池，在云函数中可能就不需要连接池了，每个请求都会分发到不同的云函数实例中，通常情况下，一个云函数有一个MySQL连接就可以。

根据用户的实际情况，推荐使用[mysql](https://www.npmjs.com/package/mysql)和[serverless-mysql](https://www.npmjs.com/package/serverless-mysql)。

默认情况下，`serverless-mysql`是`mysql`的一个封装，它添加连接管理相关的功能，与MySQL Server只有一个连接；如果在云函数中需要使用连接池，推荐使用`mysql`。

使用`serverless-mysql`的时候，注意MySQL的`max_user_connections`和`max_connections`的配置。



`demo`

```javascrpit
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
```


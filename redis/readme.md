##  简介

本扩展是为了解决云开发用户业务中对Redis的诉求，搭配腾讯云数据库Redis和云开发云函数满足开发者的业务需求，并提供相关示例代码。

[腾讯云数据库Redis](https://cloud.tencent.com/document/product/239/3205)云数据库 Redis（TencentDB for Redis）是由腾讯云提供的兼容 Redis 协议的缓存数据库，具备高可用、高可靠、高弹性等特征。云数据库 Redis 服务兼容 Redis 2.8、Redis 4.0、Redis 5.0 版本协议，提供标准版和集群版两大架构版本。最大支持4TB的存储容量，千万级的并发请求，可满足业务在缓存、存储、计算等不同场景中的需求。


##  推荐使用场景

云开发的数据库满足不了业务的需求，需要使用到Redis。

已有的业务使用了Redis，业务迁移到云开发中，希望继续使用Redis。


##  背景知识

####    私有网络VPC

在云函数中，开发者如果需要访问腾讯云的`Redis、云数据库`等资源，推荐使用`私有网络`来确保数据安全及连接安全。关于私有网络、以及如果建立私有网络和云函数加入私有网络，可以参考[如何在云开发中使用 Redis](https://developers.weixin.qq.com/community/develop/article/doc/000ee2573a4ec8ed72a9199da51c13)和[云数据库Redis配置网络](https://cloud.tencent.com/document/product/239/30910)中的相关章节。


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


####    云函数并发数 & Redis连接数

在[云开发控制台-环境总览](https://console.cloud.tencent.com/tcb/env/overview)中可以看到当前环境所允许的云函数并发数的最大值，最大并发数也是云函数的最大实例。

关于Redis连接，推荐阅读Redis官方博客的博文[Redis Clients Handling](https://redis.io/topics/clients)。

Redis连接数的配置参数`maxclients`，默认是10000，如果需要修改请联系客服。

云函数中使用Redis，每个云函数实例与Redis Server都会有连接，那么此云函数与Redis的最大连接数是，单个实例的最大连接数*实际运行的最大并发数；在配置Redis的`maxclients`的时候，此参数应该大于，使用此数据库的所有云函数的最大连接数之和。

因此，在云函数中使用Redis，建议您将使用到同一个Redis实例的所有读写Redis的代码集中到一个云函数中，这样做有两个好处

-   云函数出现冷启动的概率比较低
-   Redis的最大连接数较小，减少连接数多内存的占用


####    云函数 Node.js runtime 异步特性

云函数 Node.js runtime 中，不同版本的 Node.js 的的异步特性不尽相同。

在 Node.js 10.15 及 12.16 的 runtime 中，同步流程处理并返回后，代码中的异步逻辑可以继续执行和处理，直到异步事件执行完成后，云函数的实际执行过程才完成和退出。参考文档[Node.js runtime](https://cloud.tencent.com/document/product/583/11060)中的`Node.js 10.15 及 12.16 的异步特性` 和 `关闭事件循环等待`章节.

建议您在云函数中添加

```js
context.callbackWaitsForEmptyEventLoop = false
```

##  Usage

根据用户的实际情况，推荐使用[redis](https://www.npmjs.com/package/redis)和[ioredis](https://www.npmjs.com/package/ioredis)。



`demo`

```javascrpit

'use strict';

const redis = require('redis')

let client = redis.createClient({
    host: '172.17.16.4',
    password: 'redis_test'
})

exports.main = async (event, context, callback) => {

    let res = await new Promise((resolve, reject) => {
        client.get('test', function (err, reply) {
            if (err) {
                resolve({
                    err
                })
            }
            resolve({
                data: reply.toString()
            }）
        })
    })

    context.callbackWaitsForEmptyEventLoop = false

    return {
        res
    }
}

```


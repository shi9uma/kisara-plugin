import { segment } from 'icqq'
import { URL } from 'url'

import path from 'path'
import fetch from "node-fetch"
import axios from 'axios'

import plugin from '../../../lib/plugins/plugin.js'
import tools from '../utils/tools.js'

const cd = 2    //所有命令的 cd，默认单位是小时
const pluginName = tools.getPluginName()
const apis = JSON.parse(tools.readFile(`./plugins/${pluginName}/data/apitoken.json`))

const tags = {
    title: '标题',
    pixiv_id: 'pixiv id',
    member_name: 'pixiv 作者名',
    member_id: 'pixiv 作者id',
    danbooru_id: 'danbooru 索引id',
    gelbooru_id: 'gelbooru 索引id',
    creator: '作者',
    material: '主题',
    characters: '角色',
    source: '图片来源',
}

// 舔狗日志
export class tiangou extends plugin {
    constructor() {
        super({
            name: '舔狗日志',
            dsc: '舔狗日志',
            event: 'message',
            priority: 5000,
            rule: [
                {
                    reg: "^#?(舔狗日志|舔狗日记|舔狗|天狗|沸羊羊)$",
                    reg: "^#?(舔狗日志|舔狗日记|舔狗|天狗|沸羊羊)$",
                    fnc: 'tiangou'
                }
            ]
        })

        this.prefix = `[+] ${this.name}`
    }

    async tiangou() {
        let checkRedisResult = await tools.checkRedis(this.e, 'g', cd, { getKey: true })
        if (checkRedisResult[0]) {
            await this.e.reply(`${this.prefix}\ncd 剩余 ${parseInt(await tools.ttlRedis(checkRedisResult[1]) / 60)} 分钟`, true)
            return
        }
        // let apiUrl = 'https://apis.tianapi.com/tiangou/index?key=' + apis.tiangou
        let apiUrl = 'https://cloud.qqshabi.cn/api/tiangou/api.php'
        let response = await axios.get(apiUrl).catch(async (err) => {
            await this.e.reply(`${this.prefix}\n${err}`)
            return
        })

        if (response.status != '200') {
            await this.e.reply(`${this.prefix}\n${res.msg}`, true)
            return
        }

        let res = response.data
        await this.e.reply(`${this.prefix}\n${res}`, true)
        return
    }
}

// 识图
export class saucenao extends plugin {
    constructor() {
        super({
            name: '识图',
            dsc: '利用 saucenao.com 的 api 接口来识图',
            event: 'message',
            priority: 5000,
            rule: [
                {
                    reg: '^#?(识图|搜图|出处|来源)(.*)$',
                    fnc: 'saucenaoCheckType'
                }
            ]
        })
        this.prefix = '[+] saucenao 识图'
        this.defaultSimilarityRate = 70
    }

    async saucenaoSearch(similarityRate = this.defaultSimilarityRate, numres = 3) {

        if (apis.saucenao == '') {
            await this.e.reply('未提供有效的 api_key，需要到 saucenao.com 获取 api_key')
            return
        }

        let saucenaoUrl = 'https://saucenao.com/search.php'
        let imgUrl = this.e.img[0]
        let response = await axios.get(
            saucenaoUrl,
            {
                params: {
                    url: imgUrl,
                    db: 999,
                    api_key: apis.saucenao,
                    output_type: 2,
                    numres: numres   // 返回多少个结果
                }
            }
        )

        if (response.status != 200) {
            await this.e.reply(`${this.prefix}\n树状图设计者无反应, 状态：${response.status}`, true, { recallMsg: 90 })
            return
        }

        let responseData = response.data.results ? response.data.results : response.data.header.message,
            isSelectArr = [],
            msg

        if (!responseData.includes('Specified file no longer exists on the remote server!')) {
            for (let obj1 of responseData) {
                if (obj1.header.similarity >= similarityRate) {
                    isSelectArr.push([obj1, obj1.header.similarity])
                }
            }
        }

        if (isSelectArr.length == 0) {
            msg = [
                `${this.prefix}\n` +
                `没有找到任何与提供图片相似度高于 ${similarityRate}% 的结果\n` +
                `您也可以通过这个链接来自行查找.\n` +
                `${saucenaoUrl + '?url=' + imgUrl}`
            ]
            await this.e.reply(msg, true)
            return
        }

        let forwardMsg = [],
            forwardMsgArr = []
        for (let obj2 of isSelectArr) {
            forwardMsg = [
                `[+] 识图结果 ${isSelectArr.indexOf(obj2) + 1}` + '\n'
            ]
            forwardMsg.push(`结果相似度: ${obj2[1]}%` + '\n')
            for (let objName in obj2[0].data) {
                if (objName == 'ext_urls') {
                    for (let url of obj2[0].data[objName]) {
                        forwardMsg.push(`当前识图结果链接 ${obj2[0].data[objName].indexOf(url) + 1}: ${url}` + '\n')
                    }
                }
                else {
                    if (tags[objName])
                        forwardMsg.push(`${tags[objName]}: ${obj2[0].data[objName]}` + '\n')
                    else
                        forwardMsg.push(`${objName}: ${obj2[0].data[objName]}` + '\n')
                }
            }
            forwardMsg.push(segment.image(`${obj2[0].header.thumbnail}`))
            forwardMsgArr.push(forwardMsg)
        }

        await this.e.reply(tools.makeForwardMsg(`${this.prefix}\n识图结果, 源链接：${saucenaoUrl + '?url=' + imgUrl}`, forwardMsgArr, `已列出所有相似度高于 ${similarityRate}% 的 ${isSelectArr.length} 条有效结果`, this.e, global.Bot))
        await this.e.reply('识图结果已发送完毕, 如果没有消息记录, 则表示识图内容被风控', true, { recallMsg: 60 })
        return
    }

    // 主要逻辑
    async saucenaoCheckType(e) {
        try {
            // 防止滥用
            if (!(this.e.isGroup || this.e.isMaster)) {
                await this.e.reply(`${this.prefix}\n为防止滥用, 已禁止私聊使用`)
                return
            }

            let similarityRate = Number(this.e.msg.match(/\d+/)?.[0])
            similarityRate = (similarityRate && (0 < similarityRate && similarityRate < 100)) ? similarityRate : this.defaultSimilarityRate

            if (!(this.e.img || this.e.source)) {   // 在更新了第三种查询方式后, 该控制语句应修改
                let msg = [
                    `${this.prefix}\n` +
                    `识图用法: \n` +
                    `1. 输入 '识图' + 图片\n` +
                    `2. 直接引用含有图片的消息, 并输入 '识图' \n` +
                    `3. 输入'识图数字', 可以指定相似度阈值, 默认 70`
                ]
                await this.e.reply(msg)
                return
            }

            // 1. 带图查询模式
            if (this.e.img) {
                this.saucenaoSearch(similarityRate)
                return
            }

            // 2. 引用回复查询模式
            if (this.e.source) {

                let targetSource
                if (this.e.isGroup) {
                    targetSource = (await this.e.group.getChatHistory(this.e.source.seq, 1)).pop()?.message
                } else {
                    targetSource = (await this.e.friend.getChatHistory(this.e.source.time, 1)).pop()?.message
                }

                if (targetSource) {
                    for (let obj of targetSource) {
                        if (obj.type == 'image') {
                            this.e.img = [obj.url]
                            break
                        }
                    }
                }

                if (!this.e.img) {
                    await this.e.reply(`${this.prefix}\n引用目标没有图片可供查询`, true)
                    return
                }

                this.saucenaoSearch(similarityRate)
                return
            }

            return

            // 3. 延时查询模式(未完成)
            let time
            if (this.e.isGroup) {
                time = 30
                this.reply(`请在 ${time}s 内发送想要识图的图片`)
            } else {
                time = 10
                this.reply(`请在 ${time}s 内发送想要识图的图片`)
            }

            /** 主循环计时 */
            setTimeout(() => {
                e.reply('操作超时已取消', true)
            }, time * 1000)
            return
        }
        catch (err) {
            logger.warn(err)
            await this.e.reply(`${this.prefix}\n程序出错, 请查看日志`)
            return
        }
    }
}

// 随机 pixiv 图片
export class randomPixivImg extends plugin {
    constructor() {
        super(
            {
                name: '随机图片',
                dsc: '随机 pixiv 图片',
                event: 'message',
                priority: 5000,
                rule: [
                    {
                        reg: '^#(来张壁纸|随机壁纸|壁纸|pixiv|p站|P站)$',
                        fnc: 'randomPixivImg'
                    }
                ]
            }
        )

        this.pluginName = tools.getPluginName()
        this.randomPixivImgDirPath = `./plugins/${this.pluginName}/data/randomPixivImg`
        this.prefix = `[+] ${this.dsc}`
        this.imgType = 'png'

    }

    async randomPixivImg() {

        let checkRedisResult = await tools.checkRedis(this.e, 'g', cd, { getKey: true, setRedis: false })
        if (checkRedisResult[0]) {
            await this.e.reply(`${this.prefix}\ncd 剩余 ${parseInt(await tools.ttlRedis(checkRedisResult[1]) / 60)} 分钟`, true)
            return
        }

        if (!tools.isDirValid(this.randomPixivImgDirPath)) {
            tools.makeDir(this.randomPixivImgDirPath)
        }

        await this.e.reply(`${this.prefix}\n已收到请求, 正在连接树状图设计者, 请勿重复尝试...`, true, { recallMsg: 30 })

        let url = 'https://api.lolicon.app/setu/v2',
            msg = [
                `${this.prefix}\n`
            ],
            headers = {
                'Content-Type': 'application/json'
            },
            io = axios.create({
                baseURL: url,
                headers: headers
            }),
            expireTime = 20 // second

        let data = {
            'r18': '0'
        }

        let response = await io.post('', data = data)

        if (response.status != 200) {   // status != 200, output debug info
            msg += [
                `response status with ${response.status} \n` +
                `contact with the manager plz..`
            ]
        } else {
            data = response?.data?.data[0] ? response?.data?.data[0] : false
            if (!data) {    // void response data
                msg += [
                    `void response data\n` +
                    `contact with the manager plz..`
                ]
            } else {

                let forwardMsg = [], forwardMsgArr = []

                forwardMsg = [
                    `pid: ${data?.pid ? data.pid : ''}\n` +
                    `uid: ${data?.uid ? data.uid : ''}\n` +
                    `title: ${data?.title ? data.title : ''}\n` +
                    `author: ${data?.author ? data.author : ''}\n` +
                    `imgUrl: ${data?.urls?.original ? data.urls.original : ''}`
                ]

                forwardMsgArr.push(forwardMsg)

                if (!data.r18) {    // be avoid of r18
                    let imgCount = tools.getDirFilesCount(this.randomPixivImgDirPath, this.imgType) + 1
                    let imgName = `${imgCount.toString().padStart(5, '0')}.${data?.pid ? data.pid : 'pid错误'}`
                    let headers = { 'Referer': 'www.pixiv.net' }
                    let endTime = Date.now() + expireTime * 1000
                    tools.saveUrlImg(data.urls.original, imgName, this.randomPixivImgDirPath, 'png', headers = headers)

                    let imgPath = `${this.randomPixivImgDirPath}/${imgName}.${this.imgType}`
                    while ((!tools.isFileValid(imgPath)) && (Date.now() < endTime)) {
                        await tools.wait(2)
                    }

                    if (tools.isFileValid(imgPath)) {
                        forwardMsgArr.push(segment.image(`file://${imgPath}`))
                    }
                }

                let forwardMsgArrHeader = `${this.prefix}\n从树状图设计者处获取资源成功`
                let forwardMsgArrTail = `若没有图片, 则表示图片被风控`

                await this.e.reply(tools.makeForwardMsg(forwardMsgArrHeader, forwardMsgArr, forwardMsgArrTail, this.e, global.Bot))
                await this.e.reply('随机 pixiv 图片结果已发送完毕, 如果没有消息记录, 则表示内容被风控', true, { recallMsg: 60 })
                await tools.checkRedis(this.e, 'g', cd)
                return
            }
        }

        await this.e.reply(msg, true)
        return
    }

}

// 点歌
export class shareMusic extends plugin {
    constructor() {
        super({
            name: '点歌',
            dsc: '点歌系统',
            event: 'message',
            priority: 5000,
            rule: [
                {
                    reg: "^#?(点歌|来首|听歌|点首|bgm|BGM)(.*)$",
                    fnc: 'shareMusic'
                }
            ]
        })

        this.prefix = `[+] ${this.name}`
    }

    async shareMusic() {
        let searchURL = "http://127.0.0.1:7895/search?keywords=paramsSearch"  // 网易云
        let argument = this.e.msg.replace(/#?(点歌|来首|听歌|点首|bgm|BGM)/g, "")
        let msg = [
            `${this.prefix}\n`
        ]

        if (argument == '') {
            msg += [
                '使用方法: 点歌 歌名\n'
            ]
            await this.e.reply(msg, true, { recallMsg: true })
        } else {
            try {
                argument = encodeURI(argument);
                let url = searchURL.replace("paramsSearch", argument);
                logger.info(url)
                let response = await fetch(url);
                let result = (await response.json()).result;
                let songList = result?.songs?.length ? result.songs : [];
                if (!songList[0]) {
                    msg += [
                        '没有在网易云曲库中找到相应歌曲'
                    ]
                    await this.e.reply(msg, true, { recallMsg: true })
                    return
                } else {
                    let songIndex = 0;
                    if (this.e.isPrivate) {
                        await this.e.friend.shareMusic("163", songList[songIndex].id);
                    }
                    else if (this.e.isGroup) {
                        await this.e.group.shareMusic("163", songList[songIndex].id);
                    }
                }
            }
            catch (error) {
                if (error) {
                    logger.warn(error)
                }
            }
            return
        }

        return
    }
}

// blue-archive 攻略
export class blueArchive extends plugin {
    constructor() {
        super({
            name: 'blueArchive',
            dsc: '蔚藍檔案攻略',
            event: 'message',
            priority: 5000,
            rule: [
                {
                    reg: "^#(ba|ba攻略)(.*)$",
                    fnc: 'blueArchive'
                }
            ]
        })

        this.pluginName = tools.getPluginName()
        this.localResourceBaseDir = `./plugins/${this.pluginName}/data/blue-archive`
        this.prefix = `[+] ${this.dsc}`
        this.imgType = 'png'

        this.axiosCd = 3    // seconds
    }

    async getResource(dataJson) {

        let isExpired = false

        let imgUrl = 'https://arona.cdn.diyigemt.com/image' + dataJson.data[0].path
        let hash = dataJson.data[0].hash

        let urlObject = new URL(imgUrl)
        let localResourcePath = tools.decode(path.join(this.localResourceBaseDir, urlObject.pathname))
        if (tools.isFileValid(localResourcePath)) {     // 检查文件哈希, 减少网络 io
            let localHash = (await tools.exec('md5sum', [localResourcePath]))[0].split(' ')[0]
            if (localHash != hash) {
                logger.warn(this.prefix, `文件 ${localResourcePath} hash 校验失败, 正在重新获取...`)
                tools.exec('rm', ['-f', localResourcePath])
                isExpired = true
            }
        }

        if (isExpired || !tools.isFileValid(localResourcePath)) {
            let imgName = tools.decode(path.basename(localResourcePath, path.extname(localResourcePath)))
            let saveDirPath = path.dirname(localResourcePath)
            tools.saveUrlImg(imgUrl, imgName, saveDirPath, this.imgType)
            await tools.wait(this.axiosCd)
        }

        return localResourcePath
    }

    async blueArchive() {

        let baseSearchUrl = 'https://arona.diyigemt.com/api/v1/image?name=argument'
        let argument = this.e.msg.replace(/#(ba攻略|ba)/g, '').replace(' ', '')
        let searchUrl = baseSearchUrl.replace('argument', argument)

        let msg = [
            `${this.prefix}\n`
        ]

        if (argument != '') {
            let headers = {
                'Content-Type': 'application/json'
            }
            let io = axios.create({
                baseURL: searchUrl,
                headers: headers
            })
            let response = await io.get('')

            if (response.status != 200) {
                msg += [
                    `response status with ${response.status} \n` +
                    `contact with the manager plz..`
                ]
            } else {
                let dataJson = response.data
                logger.info(dataJson)
                if (dataJson.status == 200) {
                    logger.info(dataJson.data)
                    let localResourcePath = await this.getResource(dataJson)
                    msg.push(segment.image(`file://${localResourcePath}`))
                } else {
                    msg += [
                        `当前攻略检索词 ${argument} 存在多个模糊匹配如下:\n`
                    ]

                    let tmpStrings = ''
                    dataJson.data.forEach((item, idx) => {
                        msg += [
                            `${idx + 1}. ${item.name}\n`
                        ]
                        tmpStrings = item.name
                    })

                    msg += [
                        `请重新输入正确的检索内容\n` +
                        `例如: #ba ${tmpStrings}`
                    ]
                }
            }
        } else {
            msg += [
                `蔚藍檔案攻略使用方法：\n` +
                `#ba 查询内容\n` +
                `例如: #ba mika`
            ]
        }

        await this.e.reply(msg, true)
        return
    }
}